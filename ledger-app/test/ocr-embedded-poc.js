/* ============================================================
   内嵌版 OCR 可行性原型 v2（IndexedDB 版）
   ------------------------------------------------------------
   v1 的结论：
     · 主脚本内嵌        → OK
     · core 拼进 worker  → OK（时间线里没有 "loading tesseract core"，
                            证明 TesseractCore 预定义让它跳过了下载）
     · worker 起来了     → OK（initializing tesseract 0→1 过了）
     · 语言包            → FAIL：worker 里 fetch 主线程创建的
                            blob:null/... 被拒（跨执行上下文访问 file:// blob）

   v2 改成：主线程把语言包二进制写进 IndexedDB，
            worker 内 patch 全局 fetch，命中 *.traineddata 时
            从 IndexedDB 读出来返回 Response。
            —— 数据只存一份，且不经过跨上下文的 blob URL。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/ocr-embedded-poc.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { chromium } = require('playwright-core');

const ENG_DIR = path.join(__dirname, '..', 'tools', 'ocr-engine');
const rd = f => fs.readFileSync(path.join(ENG_DIR, f));
const rdTxt = f => rd(f).toString('utf8');

const TESS_JS  = rdTxt('tesseract.min.js');
const CORE_JS  = rdTxt('core-simd-lstm.wasm.js');
const WORKER_JS= rdTxt('worker.min.js');
const CHI_B64  = rd('chi_sim.traineddata.gz').toString('base64');
const ENG_B64  = rd('eng.traineddata.gz').toString('base64');

const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OCR 内嵌 PoC v2</title></head>
<body>
<script>${TESS_JS}</script>
<script type="text/plain" id="oCore">${CORE_JS}</script>
<script type="text/plain" id="oWorker">${WORKER_JS}</script>
<script type="text/plain" id="oLangChi">${CHI_B64}</script>
<script type="text/plain" id="oLangEng">${ENG_B64}</script>
<script>
window.__poc = { done: false, results: {}, log: [] };
var R = window.__poc.results, L = window.__poc.log;
var t0 = Date.now();
var stamp = function(){ return ((Date.now() - t0) / 1000).toFixed(1) + 's'; };
function txt(id){ return document.getElementById(id).textContent; }
function b64ToBytes(b64){
  var bin = atob(b64.replace(/\\s+/g, ''));
  var u8 = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function idbOpen(name){
  return new Promise(function(res, rej){
    var rq = indexedDB.open(name, 1);
    rq.onupgradeneeded = function(){
      var db = rq.result;
      if (!db.objectStoreNames.contains('k')) db.createObjectStore('k');
    };
    rq.onsuccess = function(){ res(rq.result); };
    rq.onerror = function(){ rej(rq.error); };
  });
}
function idbPut(db, key, val){
  return new Promise(function(res, rej){
    var tx = db.transaction('k', 'readwrite');
    tx.objectStore('k').put(val, key);
    tx.oncomplete = function(){ res(); };
    tx.onerror = function(){ rej(tx.error); };
  });
}

var DB_NAME = 'ocr_lang_db';
var KEYS = { chi_sim: 'lang_chi_sim', eng: 'lang_eng' };

(async function(){
  try {
    R.tesseract_global = typeof window.Tesseract;

    var db = await idbOpen(DB_NAME);
    var chi = b64ToBytes(txt('oLangChi'));
    var eng = b64ToBytes(txt('oLangEng'));
    R.step1_decode = 'OK ' + stamp() + '  (chi=' + (chi.length/1048576).toFixed(2) + 'MB eng=' + (eng.length/1048576).toFixed(2) + 'MB)';

    await idbPut(db, KEYS.chi_sim, chi);
    await idbPut(db, KEYS.eng, eng);
    R.step2_idb_write = 'OK ' + stamp();

    var interceptor =
      'self.__OCR_KEYS=' + JSON.stringify(KEYS) + ';' +
      'self.__OCR_DB=' + JSON.stringify(DB_NAME) + ';' +
      '(function(){' +
      'function get(k){return new Promise(function(res,rej){' +
      'var rq=indexedDB.open(self.__OCR_DB,1);' +
      'rq.onupgradeneeded=function(){var d=rq.result;if(!d.objectStoreNames.contains("k"))d.createObjectStore("k");};' +
      'rq.onsuccess=function(){var g=rq.result.transaction("k","readonly").objectStore("k").get(k);' +
      'g.onsuccess=function(){res(g.result);};g.onerror=function(){rej(g.error);};};' +
      'rq.onerror=function(){rej(rq.error);};});}' +
      'var _f=self.fetch.bind(self);' +
      'self.fetch=function(u,o){' +
      'if(typeof u==="string"){' +
      'for(var k in self.__OCR_KEYS){' +
      'if(u.indexOf(k+".traineddata")>=0){' +
      'var key=self.__OCR_KEYS[k];' +
      'return get(key).then(function(b){' +
      'if(!b)throw new Error("lang missing in idb");' +
      'return new Response(b,{status:200,statusText:"OK"});});}}}' +
      'return _f(u,o);};})();';

    var workerCode = interceptor + ';' + txt('oCore') + ';' + txt('oWorker');
    R.worker_code_mb = (workerCode.length / 1048576).toFixed(2) + ' MB';
    var workerURL = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
    R.step3_worker_blob = 'OK ' + stamp();

    var worker = await Tesseract.createWorker('chi_sim+eng', 1, {
      workerPath: workerURL,
      workerBlobURL: false,
      langPath: 'https://embedded.invalid/',
      logger: function(m){ if (m && m.status) L.push(stamp() + ' ' + m.status + ' ' + (m.progress != null ? m.progress : '')); },
      errorHandler: function(e){ L.push(stamp() + ' WORKER-ERROR ' + e); }
    });
    R.step4_createWorker = 'OK ' + stamp();

    var c = document.createElement('canvas');
    c.width = 460; c.height = 150;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 460, 150);
    ctx.fillStyle = '#000000';
    ctx.font = '42px sans-serif';
    ctx.fillText('ETC 128.50', 16, 58);
    ctx.font = '34px sans-serif';
    ctx.fillText('HELLO 2026', 16, 112);

    var out = await worker.recognize(c);
    R.step5_recognize = 'OK ' + stamp();
    R.text = JSON.stringify(String(out.data.text).trim());
    await worker.terminate();
    R.final = 'SUCCESS';
  } catch (e) {
    R.error = e.name + ' | ' + e.message;
    R.final = 'FAILED';
  }
  window.__poc.done = true;
})();
</script>
</body></html>`;

(async () => {
  const file = path.join(os.tmpdir(), 'ocr_embedded_poc.html');
  fs.writeFileSync(file, HTML, 'utf8');
  console.log('内嵌 HTML: ' + (Buffer.byteLength(HTML, 'utf8') / 1048576).toFixed(2) + ' MB');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  const url = 'file:///' + file.replace(/\\/g, '/');
  const T0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  console.log('file:// 打开耗时 ' + ((Date.now() - T0) / 1000).toFixed(1) + 's，等待识别…');
  try {
    await page.waitForFunction('window.__poc && window.__poc.done', null, { timeout: 90000 });
  } catch (e) {
    console.log('!! 等待超时（90s）');
  }
  const r = await page.evaluate(() => window.__poc.results);
  const log = await page.evaluate(() => window.__poc.log);

  console.log('\n========== 内嵌 v2 结果 ==========');
  for (const k of Object.keys(r)) console.log('  ' + k.padEnd(20) + ' = ' + r[k]);
  if (errs.length) console.log('  pageerror'.padEnd(22) + ' = ' + errs.join(' | '));
  console.log('\n  引擎状态时间线（' + log.length + ' 条）：');
  let lastRec = '';
  for (const l of log) {
    if (/recognizing/.test(l)) { if (l === lastRec) continue; lastRec = l; }
    console.log('    ' + l);
  }
  console.log('\n  总耗时 ' + ((Date.now() - T0) / 1000).toFixed(1) + 's');
  await browser.close();
})();
