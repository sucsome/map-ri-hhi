import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const APP = process.env.SMOKE_URL || 'http://localhost:8000/';
const ud = join(tmpdir(), 'opencode-chrome-smoke');

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

mkdirSync(ud, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-angle=swiftshader',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${ud}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch {}
    await sleep(step);
  }
  throw new Error('timeout');
}

let ws;
class CDP {
  constructor(socket) {
    this.s = socket;
    this.id = 0;
    this.pending = new Map();
    socket.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)(m);
        this.pending.delete(m.id);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.s.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  }
}

try {
  await waitFor(async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await r.json();
    const page = list.find((t) => t.type === 'page');
    return page;
  });
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: APP });

  await waitFor(() => cdp.eval(`document.getElementById('search-input') && !document.getElementById('search-input').disabled`));
  await sleep(800);

  check('variable selector has 4 options', await cdp.eval(`document.querySelectorAll('#variable option').length`) === 4);
  check('legend rendered for default variable', (await cdp.eval(`document.getElementById('legend').querySelector('h4')?.textContent`))?.includes('Racial HHI'));

  const choro = await cdp.eval(`(function(){
    const m = document.querySelector('.maplibregl-canvas-container');
    return !!m;
  })()`);
  check('map canvas mounted', choro);

  check('no visible toast error', (await cdp.eval(`document.getElementById('toast').classList.contains('show')`)) === false);

  // ---- search a county ----
  await cdp.eval(`(() => {
    const i = document.getElementById('search-input');
    i.value = 'providence county';
    i.dispatchEvent(new Event('input'));
  })()`);
  await sleep(400);
  const sug = await cdp.eval(`[...document.querySelectorAll('#search-suggestions .s-label')].map(e => e.textContent)`);
  check('county search returns suggestions', sug.length > 0, sug.join(' | '));

  await cdp.eval(`(() => {
    const item = [...document.querySelectorAll('#search-suggestions .s-item')].find(e => e.querySelector('.s-tag')?.textContent === 'COUNTY');
    if (item) item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  })()`);
  await sleep(900);
  check('panel opens for county selection', await cdp.eval(`document.getElementById('panel').classList.contains('open')`));
  check('panel title is county', (await cdp.eval(`document.getElementById('panel-title').textContent`)) === 'Providence County');
  check('panel shows block count summary', (await cdp.eval(`document.getElementById('tab-attrs').textContent`))?.includes('blocks'));

  // ---- search a block ----
  await cdp.eval(`(() => {
    const i = document.getElementById('search-input');
    i.value = 'block 2012';
    i.dispatchEvent(new Event('input'));
  })()`);
  await sleep(400);
  const blockSuggestions = await cdp.eval(`[...document.querySelectorAll('#search-suggestions .s-item')].length`);
  check('block search returns suggestions', blockSuggestions > 0);

  await cdp.eval(`(() => {
    const item = [...document.querySelectorAll('#search-suggestions .s-item')].find(e => e.querySelector('.s-tag')?.textContent === 'BLOCK');
    if (item) item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  })()`);
  await sleep(900);
  check('panel title is block name', (await cdp.eval(`document.getElementById('panel-title').textContent`)) === 'Block 2012');
  const attrs = await cdp.eval(`document.getElementById('tab-attrs').textContent`);
  check('attributes tab shows GEOID', attrs.includes('440070128032012'));
  check('attributes tab shows county', attrs.includes('Providence County'));
  check('attributes tab shows all sections (housing/area/year)', attrs.includes('Housing units') && attrs.includes('Land area') && attrs.includes('Census year'));
  const hero = await cdp.eval(`document.getElementById('tab-attrs').querySelector('.hero-num').textContent`);
  check('hero shows HHI value', hero === '2,959.2', hero);

  // ---- compare tab ----
  await cdp.eval(`document.querySelector('#panel-tabs button[data-tab="compare"]').click()`);
  await sleep(300);
  check('compare tab becomes active', await cdp.eval(`document.getElementById('tab-compare').classList.contains('active')`));
  check('attrs tab deactivates', (await cdp.eval(`document.getElementById('tab-attrs').classList.contains('active')`)) === false);
  check('compare tab renders histogram svg', (await cdp.eval(`document.querySelectorAll('#tab-compare svg').length`)) >= 1);
  check('compare tab shows state bar', (await cdp.eval(`document.getElementById('tab-compare').textContent`))?.includes('Rhode Island'));

  // ---- variable switch ----
  await cdp.eval(`(() => { const s = document.getElementById('variable'); s.value = 'total_pop'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(300);
  check('legend updates on variable switch', (await cdp.eval(`document.getElementById('legend').querySelector('h4')?.textContent`))?.includes('Total Population'));

  // ---- permalink ----
  const hash = await cdp.eval(`location.hash`);
  check('permalink written', hash.startsWith('#v/'), hash);
  await cdp.eval(`location.reload()`);
  await waitFor(() => cdp.eval(`document.getElementById('search-input') && !document.getElementById('search-input').disabled`));
  await sleep(1200);
  check('permalink restores panel after reload', await cdp.eval(`document.getElementById('panel').classList.contains('open')`));
  check('permalink restores variable', (await cdp.eval(`document.getElementById('legend').querySelector('h4')?.textContent`))?.includes('Total Population'));
  check('permalink restores selection', (await cdp.eval(`document.getElementById('panel-title').textContent`)) === 'Block 2012');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error('SMOKE ERROR:', err.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
}
