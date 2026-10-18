import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

// Simplex-style procedural noise functions
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Normalized mouse interaction
    vec2 mouse = (u_mouse.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float distMouse = length(p - mouse);
    
    float t = u_time * 0.45;

    // Layered organic fluid noise
    float n1 = snoise(p * 1.5 + vec2(t * 0.25, -t * 0.35));
    float n2 = snoise(p * 3.0 - vec2(t * 0.4, t * 0.15) + vec2(n1 * 0.6));
    float n3 = snoise(p * 5.5 + vec2(n2 * 0.8, -t * 0.5));
    
    // Combined fluid perturbation
    float fluid = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
    
    // Mouse repulsion / ripple
    float mouseWave = sin(distMouse * 14.0 - u_time * 3.0) * exp(-distMouse * 2.8) * 0.35;
    fluid += mouseWave;

    // Center pulsating droplet shape & organic edge
    float r = length(p + vec2(fluid * 0.25));
    
    // Heartbeat cadence (systole / diastole double-thump)
    float beatPhase = mod(u_time * 1.2, 1.0);
    float beat = sin(beatPhase * 3.14159 * 2.0) * exp(-beatPhase * 4.0);
    float targetRadius = 0.58 + beat * 0.055;
    
    // Soft droplet mask with cellular edge
    float droplet = smoothstep(targetRadius + 0.32, targetRadius - 0.15, r);
    float cellRim = smoothstep(targetRadius + 0.05, targetRadius - 0.02, r) - smoothstep(targetRadius - 0.02, targetRadius - 0.12, r);

    // Deep organic red chromatic palette
    vec3 deepRed    = vec3(0.38, 0.02, 0.06); // #61050f
    vec3 arterial   = vec3(0.85, 0.08, 0.16); // #d91429
    vec3 crimsonGlow= vec3(0.98, 0.22, 0.30); // #fa384d
    vec3 darkPlasma = vec3(0.08, 0.01, 0.03); // #140207
    vec3 ambientBg   = vec3(0.02, 0.008, 0.012); // Deep dark canvas

    // Color gradient distribution
    vec3 col = mix(ambientBg, darkPlasma, smoothstep(1.3, 0.3, r));
    col = mix(col, deepRed, droplet * 0.85);
    col = mix(col, arterial, smoothstep(0.4, 0.0, r) * 0.75 + fluid * 0.2);
    col += crimsonGlow * max(cellRim * 0.65, 0.0);
    col += crimsonGlow * pow(max(0.0, 1.0 - distMouse), 3.0) * 0.45;

    // Specular highlight / bioluminescence
    float spec = pow(max(0.0, 1.0 - length(p - vec2(-0.15, 0.2) + fluid * 0.1)), 4.0);
    col += vec3(1.0, 0.75, 0.8) * spec * 0.35;

    // Subtle edge vignette
    col *= smoothstep(1.8, 0.5, length(p));

    gl_FragColor = vec4(col, 1.0);
}
`;

export interface BloodDropletShaderProps {
  className?: string;
  style?: React.CSSProperties;
}

export function BloodDropletShader({ className, style }: BloodDropletShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    function createShader(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    syncSize();

    let animationFrameId: number;
    let isVisible = true;
    const targetMouse = { x: canvas.width * 0.5, y: canvas.height * 0.5 };
    const currentMouse = { x: canvas.width * 0.5, y: canvas.height * 0.5 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouse.x = e.clientX - rect.left;
      targetMouse.y = canvas.height - (e.clientY - rect.top);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // IntersectionObserver to freeze GPU loop when Hero is not in viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncSize();
      });
      resizeObserver.observe(canvas);
    }

    function render(timestamp: number) {
      if (isVisible && gl && canvas) {
        syncSize();
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Smooth mouse lerp
        currentMouse.x += (targetMouse.x - currentMouse.x) * 0.12;
        currentMouse.y += (targetMouse.y - currentMouse.y) * 0.12;

        if (uTime) gl.uniform1f(uTime, timestamp * 0.001);
        if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);
        if (uMouse) gl.uniform2f(uMouse, currentMouse.x, currentMouse.y);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    // Cleanup GPU resources & listeners on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();

      if (gl) {
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
