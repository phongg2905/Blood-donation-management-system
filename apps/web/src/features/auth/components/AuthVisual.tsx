/**
 * AuthVisual — blood donation themed illustration for the dark panel.
 *
 * Pure CSS + inline SVG — no external assets required.
 * Inspired by Ref 01 (3-D organic feel) and Ref 03 (glowing orb / visual panel).
 *
 * Renders a stylised blood drop with orbital rings, subtle floating dots, and
 * a pulse / heartbeat line. All decorative; hidden from screen readers.
 */
export function AuthVisual() {
  return (
    <div className="auth-blood-illustration" aria-hidden="true">
      {/* Orbital rings */}
      <span className="auth-blood-illustration__ring auth-blood-illustration__ring--1" />
      <span className="auth-blood-illustration__ring auth-blood-illustration__ring--2" />

      {/* Blood drop SVG — stylised teardrop */}
      <svg
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Outer drop — crimson fill with glow */}
        <defs>
          <radialGradient id="dropGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#e8475f" />
            <stop offset="60%" stopColor="#c0273f" />
            <stop offset="100%" stopColor="#8c0f21" />
          </radialGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(192 39 63 / 0.6)" />
            <stop offset="100%" stopColor="rgb(192 39 63 / 0)" />
          </radialGradient>
          <filter id="dropShadow">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="10"
              floodColor="rgb(192 39 63 / 0.6)"
            />
          </filter>
        </defs>

        {/* Glow platform */}
        <ellipse cx="50" cy="112" rx="30" ry="8" fill="url(#glowGrad)" />

        {/* Main blood drop shape */}
        <path
          d="M50 8 C50 8 18 52 18 72 C18 90 32 102 50 102 C68 102 82 90 82 72 C82 52 50 8 50 8Z"
          fill="url(#dropGrad)"
          filter="url(#dropShadow)"
        />

        {/* Shine highlight (Ref 01 3-D feel) */}
        <path
          d="M38 36 C38 36 30 52 30 62 C30 68 33 72 36 72"
          stroke="rgb(255 255 255 / 0.35)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Inner pulse line */}
        <path
          d="M30 72 L38 72 L42 60 L46 84 L50 68 L54 76 L58 72 L70 72"
          stroke="rgb(255 255 255 / 0.55)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Floating cross marks */}
        <g opacity="0.4">
          <line
            x1="88"
            y1="28"
            x2="88"
            y2="36"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="84"
            y1="32"
            x2="92"
            y2="32"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        <g opacity="0.25">
          <line
            x1="10"
            y1="75"
            x2="10"
            y2="81"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="7"
            y1="78"
            x2="13"
            y2="78"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* Floating ambient dots */}
      <span className="auth-float-dot auth-float-dot--1" />
      <span className="auth-float-dot auth-float-dot--2" />
      <span className="auth-float-dot auth-float-dot--3" />

      {/* Ambient glow under the drop */}
      <span className="auth-blood-illustration__glow" />
    </div>
  );
}
