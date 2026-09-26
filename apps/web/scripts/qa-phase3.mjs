/* Local browser QA. Uses existing Chrome + Vite, no added dependencies. */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

process.env.VITE_USE_MOCK_API = 'true';
process.env.VITE_USE_MOCK_CAMPAIGNS = 'true';
process.env.VITE_CAMPAIGN_MOCK_LATENCY = '40';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '../../../.qa-phase3');
mkdirSync(output, { recursive: true });
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  server: { port: 5198, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'blood-phase3-'));
const chrome = spawn(
  process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=9446',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);
const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
let ws;
try {
  let target;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      target = (
        await (await fetch('http://127.0.0.1:9446/json/list')).json()
      ).find((row) => row.type === 'page');
    } catch {
      /* Chrome starting */
    }
    if (target) break;
    await sleep(100);
  }
  if (!target) throw new Error('Chrome did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails.text);
    if (
      message.method === 'Runtime.consoleAPICalled' &&
      message.params.type === 'error'
    )
      errors.push(
        message.params.args
          .map((arg) => arg.value ?? arg.description)
          .join(' '),
      );
    const item = pending.get(message.id);
    if (item) {
      pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolveSend, reject) => {
      const key = ++id;
      pending.set(key, { resolve: resolveSend, reject });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          'Browser evaluation failed',
      );
    return result.result.value;
  };
  const wait = async (expression) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(`return Boolean(${expression});`)) return;
      await sleep(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5198/login' });
  await wait("document.querySelector('input[type=email]')");
  await evaluate(
    `const set=(selector,value)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('input[type=email]','coordinator@example.local');set('input[type=password]','Blood@123');document.querySelector('form').requestSubmit();`,
  );
  await wait("document.querySelector('.landing')");
  const report = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const route of [
      '/campaigns',
      '/campaigns/demo-1',
      '/campaigns/new',
      '/campaigns/demo-1/edit',
      '/campaigns/demo-1/timeslots',
      '/campaigns/demo-1/staff',
    ]) {
      await send('Page.navigate', { url: `http://127.0.0.1:5198${route}` });
      await wait(
        "document.querySelector('.campaign-page') && !document.querySelector('.campaign-loading')",
      );
      const geometry = await evaluate(
        `return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1').textContent,unlabelled:[...document.querySelectorAll('input,select,textarea')].filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')).length};`,
      );
      report.push({ width, route, ...geometry });
      if (geometry.scrollWidth > width + 1 || geometry.unlabelled)
        throw new Error(
          `Layout/accessibility failure: ${JSON.stringify(report.at(-1))}`,
        );
      if (width === 1440 || width === 390) {
        const screenshot = await send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
        });
        writeFileSync(
          join(output, `${width}-${route.replaceAll('/', '_')}.png`),
          Buffer.from(screenshot.data, 'base64'),
        );
      }
    }
  }
  await send('Page.navigate', {
    url: 'http://127.0.0.1:5198/campaigns/demo-1',
  });
  await wait(
    "[...document.querySelectorAll('button')].some(el=>el.textContent==='Đóng đăng ký')",
  );
  await evaluate(
    `const button=[...document.querySelectorAll('button')].find(el=>el.textContent==='Đóng đăng ký');button.focus();button.click();`,
  );
  await wait("document.querySelector('dialog[open]')");
  for (let i = 0; i < 5; i++) {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    if (
      !(await evaluate(
        "return document.querySelector('dialog').contains(document.activeElement);",
      ))
    )
      throw new Error('Modal focus escaped');
  }
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await wait("!document.querySelector('dialog')");
  if (
    (await evaluate('return document.activeElement.textContent;')) !==
    'Đóng đăng ký'
  )
    throw new Error('Focus did not return to trigger');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  writeFileSync(
    join(output, 'report.json'),
    JSON.stringify(
      { checks: report, modalFocus: 'passed', consoleErrors: errors },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${report.length} responsive route checks; modal keyboard containment + Escape + focus restoration; no console errors. Artifacts: ${output}`,
  );
} finally {
  ws?.close();
  chrome.kill();
  await server.close();
  await sleep(500);
  const resolvedProfile = resolve(profile);
  if (
    resolvedProfile.startsWith(resolve(tmpdir()) + sep) &&
    resolvedProfile.split(sep).at(-1).startsWith('blood-phase3-')
  ) {
    try {
      rmSync(resolvedProfile, { recursive: true, force: true });
    } catch {
      /* Chrome may still be releasing its own temporary profile. */
    }
  }
}
