/* ============================================================
   file:// 环境能力探测（OCR 引擎能不能在本地单文件里跑）
   ------------------------------------------------------------
   目的：Tesseract.js 需要 Web Worker + IndexedDB + 跨域下载。
        「把引擎内嵌进 HTML」这个方案成不成立，取决于
        file:// 页面下这几项能力到底有没有被浏览器掐掉。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/ocr-env-probe.js

   同一个探测页会分别以 file:// 和 http:// 加载，对照着看差异。
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { chromium } = require('playwright-core');

const TESS_JS  = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const TESS_PKG = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/package.json';

const PROBE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>ocr env probe</title></head><body>
<script>
window.__probe = { done: false, results: {} };
const R = window.__probe.results;
const race = (p, ms, tag) => Promise.race([p, new Promise(r => setTimeout(() => r(tag + '_TIMEOUT'), ms))]);

async function run(){
  R.protocol = location.protocol;
  R.origin = String(location.origin);

  try {
    const b = new Blob(['self.onmessage = function(e){ self.postMessage("pong") }'], { type: 'application/javascript' });
    const u = URL.createObjectURL(b);
    R.blob_url_prefix = u.slice(0, 20);
    const w = new Worker(u);
    R.blobWorker = await race(new Promise(res => {
      w.onmessage = e => res('OK:' + e.data);
      w.onerror = e => res('ERROR:' + (e.message || 'unknown'));
      w.postMessage('ping');
    }), 5000, 'blobWorker');
    w.terminate();
  } catch (e) { R.blobWorker = 'THROW:' + e.name + ' | ' + e.message; }

  try {
    const w = new Worker('${TESS_JS}');
    R.httpsWorker = 'CONSTRUCTED';
    w.terminate();
  } catch (e) { R.httpsWorker = 'THROW:' + e.name + ' | ' + e.message; }

  try {
    const src = 'try{importScripts("${TESS_PKG}");self.postMessage("OK")}catch(e){self.postMessage("ERR:"+e.message)}';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    R.blobWorkerImportScripts = await race(new Promise(res => {
      w.onmessage = e => res(e.data);
      w.onerror = e => res('ERROR:' + (e.message || 'unknown'));
    }), 15000, 'blobWorkerImportScripts');
    w.terminate();
  } catch (e) { R.blobWorkerImportScripts = 'THROW:' + e.name + ' | ' + e.message; }

  try {
    R.indexedDB = await race(new Promise(res => {
      const req = indexedDB.open('probe_db', 1);
      req.onsuccess = () => res('OK');
      req.onerror = () => res('ERROR');
      req.onblocked = () => res('BLOCKED');
    }), 5000, 'indexedDB');
  } catch (e) { R.indexedDB = 'THROW:' + e.name + ' | ' + e.message; }

  try {
    const r = await race(fetch('${TESS_PKG}'), 12000, 'fetchCross');
    if (typeof r === 'string') { R.fetch_cross = r; }
    else { const j = await r.json(); R.fetch_cross = 'OK:' + r.status + ' v' + j.version; }
  } catch (e) { R.fetch_cross = 'THROW:' + e.name + ' | ' + e.message; }

  try {
    await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0]));
    R.wasm = 'OK';
  } catch (e) { R.wasm = 'THROW:' + e.name; }

  try { localStorage.setItem('__p', '1'); R.localStorage = localStorage.getItem('__p') === '1' ? 'OK' : 'FAIL'; }
  catch (e) { R.localStorage = 'THROW:' + e.name; }

  R.scriptSrc_cross = await race(new Promise(res => {
    const s = document.createElement('script');
    s.src = '${TESS_JS}';
    s.onload = () => res('OK');
    s.onerror = () => res('ERROR');
    document.head.appendChild(s);
  }), 25000, 'scriptSrc_cross');
  R.Tesseract_global = typeof window.Tesseract;

  window.__probe.done = true;
}
run();
</script></body></html>`;

(async () => {
  const tmp = path.join(os.tmpdir(), 'ocr_env_probe.html');
  fs.writeFileSync(tmp, PROBE_HTML, 'utf8');
  const fileUrl = 'file:///' + tmp.replace(/\\/g, '/');

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PROBE_HTML);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });

  console.log('Chrome: ' + browser.version());

  for (const [label, url] of [
    ['file://  (local single-file)', fileUrl],
    ['http://  (served over network)', 'http://127.0.0.1:' + port + '/probe.html']
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction('window.__probe && window.__probe.done', null, { timeout: 120000 });
      const r = await page.evaluate(() => window.__probe.results);
      console.log('\n========== ' + label + ' ==========');
      for (const k of Object.keys(r)) console.log('  ' + k.padEnd(24) + ' = ' + r[k]);
      if (errs.length) console.log('  pageerror'.padEnd(26) + ' = ' + errs.join(' | '));
    } catch (e) {
      console.log('\n========== ' + label + ' ==========');
      console.log('  PROBE ABORTED: ' + e.message);
      const partial = await page.evaluate(() => window.__probe && window.__probe.results).catch(() => null);
      if (partial) for (const k of Object.keys(partial)) console.log('  ' + k.padEnd(24) + ' = ' + partial[k]);
    }
    await page.close();
  }

  await browser.close();
  server.close();
})();
