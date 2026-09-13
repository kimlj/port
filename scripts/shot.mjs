#!/usr/bin/env node
/**
 * Drive a headless Chrome over the DevTools Protocol: screenshot a page,
 * measure it, click things, check both themes.
 *
 *     node scripts/shot.mjs <url> [options]
 *
 *     --out <file>          write a PNG (default: none, measurements only)
 *     --size <WxH>          viewport, default 1440x900
 *     --theme <light|dark>  set data-theme AND emulate prefers-color-scheme
 *     --reduced-motion      emulate prefers-reduced-motion: reduce
 *     --click <selector>    click it, repeatable, in the order given
 *     --eval <expression>   evaluate and print as JSON, repeatable
 *     --wait <ms>           settle time after load and after each click (250)
 *     --full                capture the whole scrollable page, not the fold
 *
 * WHY THIS EXISTS. Editing this file's layout is supposed to be checked in a
 * browser - most bugs in it are visual or layout-order problems a diff will not
 * show. The browser doing that was the owner's own Chrome, which means a tab
 * opening over whatever he was doing every time a check ran. That is a real
 * cost on a check that is supposed to be cheap enough to run often, and the
 * usual fate of a check with a cost like that is to stop being run.
 *
 * NO DEPENDENCIES, which is deliberate rather than austere. This repo has no
 * package.json and no build step; adding Playwright would give it both, plus a
 * browser download, to automate a browser already installed on the machine.
 * Node 24 ships a WebSocket client and Chrome ships the protocol, so the whole
 * driver is this file. A repo that already has a package.json should just use
 * Playwright - this is not an argument against it, only against a manifest
 * whose single entry exists to take screenshots.
 *
 * IT PRINTS scrollWidth VS clientWidth ON EVERY RUN, unasked. Horizontal
 * overflow is the one regression here that hides from a screenshot - the page
 * looks right and the phone scrolls sideways - so the check that catches it
 * should not be something you have to remember to ask for.
 *
 * A fresh profile in a temp directory each run, removed on exit: no history, no
 * extensions, nothing signed in. It sees what a stranger sees.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

function usage(message) {
  console.error(message + '\n\n  node scripts/shot.mjs <url> [--out f.png] ' +
    '[--size WxH] [--theme dark] [--reduced-motion] [--click sel] ' +
    '[--eval expr] [--wait ms] [--full]');
  process.exit(1);
}

// -- arguments ------------------------------------------------------------

const argv = process.argv.slice(2);
const opts = { size: '1440x900', wait: 250, clicks: [], evals: [] };
let url = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    if (i + 1 >= argv.length) usage(a + ' needs a value.');
    return argv[++i];
  };
  if (a === '--out') opts.out = next();
  else if (a === '--size') opts.size = next();
  else if (a === '--theme') opts.theme = next();
  else if (a === '--reduced-motion') opts.reducedMotion = true;
  else if (a === '--click') opts.clicks.push(next());
  else if (a === '--eval') opts.evals.push(next());
  else if (a === '--wait') opts.wait = Number(next());
  else if (a === '--full') opts.full = true;
  else if (a.startsWith('--')) usage('Unknown option ' + a + '.');
  else if (url === null) url = a;
  else usage('Only one URL.');
}

if (!url) usage('A URL is required.');
if (!CHROME) usage('No Chrome found. Edit the CHROME list in this file.');
const [width, height] = opts.size.split('x').map(Number);
if (!width || !height) usage('--size wants WxH, got ' + opts.size + '.');
if (opts.theme && opts.theme !== 'light' && opts.theme !== 'dark') {
  usage('--theme wants light or dark, got ' + opts.theme + '.');
}

// -- the protocol ---------------------------------------------------------

/*
  One socket to the browser, and every page command tagged with a sessionId.
  CDP replies carry back the id they were sent with, so a map of id -> resolver
  is the whole correlation logic; events arrive with a method and no id.
*/
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const waiters = [];
  let seq = 0;

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error.message));
      else entry.resolve(msg.result);
      return;
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].method === msg.method) waiters.splice(i, 1)[0].resolve(msg.params);
    }
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('Could not open the debugger socket.')), { once: true });
  });

  return {
    open,
    send(method, params = {}, sessionId) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    // Registered BEFORE the command that triggers it, or the event lands while
    // nothing is listening and the wait never resolves.
    once(method, ms = 15000) {
      return new Promise((resolve, reject) => {
        const w = { method, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) { waiters.splice(i, 1); reject(new Error('Timed out waiting for ' + method + '.')); }
        }, ms);
      });
    },
    close() { ws.close(); },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -- run ------------------------------------------------------------------

const profile = await mkdtemp(join(tmpdir(), 'shot-'));
let chrome;
let cdp;
let failed = false;

try {
  chrome = spawn(CHROME, [
    '--headless=new',
    // Port 0 means "pick one"; Chrome writes the port it picked into the
    // profile, which is the only way to learn it without risking a clash with
    // whatever else on this machine has taken 9222.
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    '--window-size=' + width + ',' + height,
  ], { stdio: 'ignore' });

  const portFile = join(profile, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 100 && port === null; i++) {
    await sleep(100);
    try {
      const [line] = (await readFile(portFile, 'utf8')).split('\n');
      if (line) port = Number(line);
    } catch { /* not written yet */ }
  }
  if (!port) throw new Error('Chrome did not report a debugging port.');

  const version = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
  cdp = connect(version.webSocketDebuggerUrl);
  await cdp.open;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => cdp.send(method, params, sessionId);

  await page('Page.enable');
  await page('Runtime.enable');
  await page('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });

  // Media emulation has to be in place before the document loads, or the page
  // renders once under the wrong query and only some of it re-renders.
  const features = [];
  if (opts.theme) features.push({ name: 'prefers-color-scheme', value: opts.theme });
  if (opts.reducedMotion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (features.length) await page('Emulation.setEmulatedMedia', { features });

  const loaded = cdp.once('Page.loadEventFired');
  await page('Page.navigate', { url });
  await loaded;
  await sleep(opts.wait);

  async function evaluate(expression) {
    const { result, exceptionDetails } = await page('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    }
    return result.value;
  }

  // The attribute as well as the media feature: this site's tokens key off
  // data-theme, and the media query is what its canvas code reads.
  if (opts.theme) {
    await evaluate('document.documentElement.setAttribute("data-theme", ' + JSON.stringify(opts.theme) + ')');
    await sleep(opts.wait);
  }

  for (const selector of opts.clicks) {
    const hit = await evaluate(
      '(() => { const el = document.querySelector(' + JSON.stringify(selector) + ');' +
      ' if (!el) return false; el.click(); return true; })()'
    );
    if (!hit) throw new Error('No element matched ' + selector + '.');
    await sleep(opts.wait);
  }

  for (const expression of opts.evals) {
    console.log(JSON.stringify(await evaluate(expression), null, 1));
  }

  if (opts.out) {
    const params = { format: 'png' };
    if (opts.full) {
      const { cssContentSize } = await page('Page.getLayoutMetrics');
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
    }
    const { data } = await page('Page.captureScreenshot', params);
    await writeFile(opts.out, Buffer.from(data, 'base64'));
    console.log('wrote ' + opts.out);
  }

  const overflow = await evaluate(
    '({ scrollWidth: document.documentElement.scrollWidth,' +
    '   clientWidth: document.documentElement.clientWidth })'
  );
  const clean = overflow.scrollWidth === overflow.clientWidth;
  console.log('overflow: scrollWidth ' + overflow.scrollWidth + ' / clientWidth ' +
    overflow.clientWidth + ' - ' + (clean ? 'clean' : 'SCROLLS SIDEWAYS'));
} catch (error) {
  console.error(String(error.message || error));
  failed = true;
} finally {
  cdp?.close();
  chrome?.kill();
  await sleep(200);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  process.exit(failed ? 1 : 0);
}
