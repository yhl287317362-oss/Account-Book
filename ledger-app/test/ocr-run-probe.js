/* ============================================================
   file:// 下完整跑一次 Tesseract 识别（终极验证）
   ------------------------------------------------------------
   ocr-env-probe.js 已经证明 file:// 下 blob Worker / IndexedDB /
   跨域 fetch / 脚本加载 全部可用。本文件再往前一步：
   真的加载引擎、真的跑一次 OCR，看到底卡在哪一环。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/ocr-run-probe.js
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { chromium } = require('playwright-core');

const TESS_JS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

const PROBE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>ocr run probe</title></head><body>
<script>
window.__probe = { done: false, results: {}, log: [] };
const R = window.__probe.results;
const L = window.__probe.log;
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

async function run(){
  R.origin = String(location.origin);

  // 1) 加载引擎脚本
  try {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '${TESS_JS}';
      s.onload = res;
      s.onerror = () => rej(new Error('script load error'));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('script load TIMEOUT 20s')), 20000);
    });
    R.step1_script = 'OK @' + stamp();
  } catch (e) { R.step1_script = 'FAIL:' + e.message + ' @' + stamp(); R.final = 'aborted at step1'; window.__probe.done = true; return; }

  R.Tesseract_global = typeof window.Tesseract;

  // 2) 造一张带文字的图
  const c = document.createElement('canvas');
  c.width = 420; c.height = 120;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 420, 120);
  ctx.fillStyle = '#000000'; ctx.font = '52px sans-serif';
  ctx.fillText('HELLO 123', 18, 82);
  R.step2_canvas = 'OK';

  // 3) 跑识别，把引擎每一个状态都记下来
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => { if (m && m.status) L.push(stamp() + ' ' + m.status + ' ' + (m.progress != null ? m.progress : '')); },
      errorHandler: e => L.push(stamp() + ' WORKER-ERROR ' + e)
    });
    R.step3_createWorker = 'OK @' + stamp();
    const { data } = await worker.recognize(c);
    R.step4_recognize = 'OK @' + stamp();
    R.text = JSON.stringify(String(data.text).trim());
    await worker.terminate();
    R.final = 'SUCCESS';
  } catch (e) {
    R.step3_createWorker = R.step3_createWorker || 'PENDING';
    R.step4_recognize = 'FAIL:' + e.name + ' | ' + e.message + ' @' + stamp();
    R.final = 'FAILED';
  }

  window.__probe.done = true;
}
run();
</script></body></html>`;

(async () => {
  const tmp = path.join(os.tmpdir(), 'ocr_run_probe.html');
  fs.writeFileSync(tmp, PROBE_HTML, 'utf8');
  const fileUrl = 'file:///' + tmp.replace(/\\/g, '/');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
  console.log('Chrome: ' + browser.version());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  const T0 = Date.now();
  await page.goto(fileUrl, { waitUntil: 'load' });
  console.log('已在 file:// 下加载探测页，等待识别完成…');
  try {
    await page.waitForFunction('window.__probe && window.__probe.done', null, { timeout: 180000 });
  } catch (e) {
    console.log('!! 等待超时：' + e.message);
  }
  const r = await page.evaluate(() => window.__probe.results);
  const log = await page.evaluate(() => window.__probe.log);

  console.log('\n========== file:// 完整识别结果 ==========');
  for (const k of Object.keys(r)) console.log('  ' + k.padEnd(20) + ' = ' + r[k]);
  if (errs.length) console.log('  pageerror'.padEnd(22) + ' = ' + errs.join(' | '));
  console.log('\n  引擎状态时间线（共 ' + log.length + ' 条）：');
  const seen = [];
  for (const l of log) {
    const key = l.replace(/^[\\d.]+s /, '');
    if (seen.includes(key) && !/recognizing/.test(l)) continue;
    seen.push(key);
    if (/recognizing/.test(l) && log.filter(x => /recognizing/.test(x)).indexOf(l) % 20 !== 0) continue;
    console.log('    ' + l);
  }
  console.log('\n  总耗时 ' + ((Date.now() - T0) / 1000).toFixed(1) + 's');

  await browser.close();
})();
