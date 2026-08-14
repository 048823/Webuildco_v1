// Horizontal-overflow check for the marketing site.
//
// Screenshots can't answer "does this page overflow?" — `body { overflow-x: hidden }`
// hides the symptom and makes a broken page look fine. This drives the installed Chrome
// over CDP and asserts documentElement.scrollWidth === clientWidth at each width, twice:
// once as shipped, and once with the body clip forced off so a masked overflow still fails.
//
//   npm run serve            # in another shell (or point at any URL)
//   node tools/check-overflow.mjs [baseUrl] [widths] [paths...]
//
// Exits non-zero if any page overflows. Needs Chrome; skips (exit 0) if it isn't installed.
// ponytail: dev-only gate, deliberately NOT wired into `npm test` — CI has no Chrome.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const WIDTHS = (process.argv[3] || '320,375,414,768,1440').split(',').map(Number);
const PATHS = process.argv.slice(4).length ? process.argv.slice(4) : ['/'];

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);

if (!CHROME) {
  console.log('skip: no Chrome/Chromium found');
  process.exit(0);
}

const PORT = 9222 + (process.pid % 500);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=/tmp/ovf-${process.pid}`, '--hide-scrollbars',
  '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
if (!wsUrl) { chrome.kill(); console.error('chrome did not start'); process.exit(2); }

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  } else if (m.method) for (const l of listeners) l(m);
});
const send = (method, params = {}, sid) => new Promise((resolve, reject) => {
  const i = ++id; pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params, ...(sid ? { sessionId: sid } : {}) }));
});
const once = method => new Promise(r => {
  const l = m => { if (m.method === method) { listeners.delete(l); r(m.params); } };
  listeners.add(l);
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);

// `relax` strips the body clip so an overflow it was hiding still shows up.
const probe = relax => `(async () => {
  ${relax ? "document.documentElement.style.overflowX='visible';document.body.style.overflowX='visible';" : ''}
  try { await document.fonts.ready; } catch {}
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const vw = document.documentElement.clientWidth;
  const clipped = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
      if (getComputedStyle(p).overflowX !== 'visible') return true;
    return false;
  };
  const bad = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (el.closest('.sr-only')  || el.classList.contains('sr-only')) continue;
    const r = el.getBoundingClientRect();
    if ((r.width === 0 && r.height === 0) || clipped(el)) continue;
    const over = Math.max(r.right - vw, -r.left);
    if (over > 0.5) bad.push({ over: +over.toFixed(1), sel: el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').slice(0, 70) });
  }
  return JSON.stringify({ vw, scrollWidth: document.documentElement.scrollWidth, bad: bad.sort((a, b) => b.over - a.over).slice(0, 5) });
})()`;

let failures = 0;
for (const path of PATHS) {
  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 }, sessionId);
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: BASE + path }, sessionId);
    await loaded;
    await sleep(400);
    for (const relax of [false, true]) {
      const res = await send('Runtime.evaluate', { expression: probe(relax), awaitPromise: true, returnByValue: true }, sessionId);
      const { vw, scrollWidth, bad } = JSON.parse(res.result.value);
      const mode = relax ? 'clip-removed' : 'as-shipped ';
      if (scrollWidth !== vw || bad.length) {
        failures++;
        console.error(`FAIL ${path} @${width} (${mode}): scrollWidth=${scrollWidth} clientWidth=${vw}`);
        for (const b of bad) console.error(`       +${b.over}px  ${b.sel}`);
      } else {
        console.log(`ok   ${path} @${width} (${mode}): scrollWidth=${scrollWidth}`);
      }
    }
  }
}

ws.close();
chrome.kill();
console.log(failures ? `\n${failures} check(s) failed` : '\nno horizontal overflow');
process.exit(failures ? 1 : 0);
