/* ============================================================
   离线版 · 真实账单截图集成测试
   ------------------------------------------------------------
   走完整 UI 链路：切到「📷 识图」→ 选图 → 等识别 → 看明细，
   全程断网（http/https 一律 abort）。
   覆盖 offline-ocr-check.js 没覆盖的部分：runOcrFile 的调用链、
   进度文案、以及真实账单的解析质量。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/ocr-ui-check.js [记账本.html]
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const APP = process.argv[2] || 'C:/Users/28731/Desktop/记账本.html';
const SHOTS = [
  ['微信账单',   'C:/Users/28731/Desktop/微信账单.jpg'],
  ['支付宝账单', 'C:/Users/28731/Desktop/支付宝账单.jpg']
];

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) { pass++; console.log('  ✓ ' + n); }
  else   { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');

(async () => {
  if (!fs.existsSync(APP)) { console.log('找不到：' + APP); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const net = [];
  await page.route('**/*', r => {
    const u = r.request().url();
    if (/^https?:/i.test(u)) { net.push(u); return r.abort(); }
    return r.continue();
  });

  await page.goto('file:///' + APP.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.waitForTimeout(400);

  head('准备');
  ok('切到识图面板', await page.evaluate(() => {
    document.querySelector('[data-type="ocr"]').click();
    return !document.getElementById('ocrPanel').hidden;
  }));
  const note = await page.evaluate(() => document.getElementById('ocrNote').textContent.trim());
  ok('提示文案说明引擎已内置', /内置/.test(note), note);
  console.log('     文案：' + note);

  for (const [name, file] of SHOTS) {
    if (!fs.existsSync(file)) { console.log('\n  跳过 ' + name + '（文件不存在）'); continue; }
    head('识图：' + name + '  (' + (fs.statSync(file).size / 1024).toFixed(0) + ' KB)');

    const seen = [];
    const poll = setInterval(async () => {
      try {
        const s = await page.evaluate(() => document.getElementById('ocrStatus').textContent.trim());
        if (s && s !== seen[seen.length - 1]) seen.push(s);
      } catch (e) {}
    }, 400);

    const t0 = Date.now();
    await page.setInputFiles('#fileOcr', file);
    try {
      await page.waitForFunction(() => {
        const r = document.getElementById('ocrResult');
        const e = document.getElementById('ocrEmpty');
        const n = document.getElementById('ocrNote').textContent;
        return (r && !r.hidden) || (e && !e.hidden && /失败|没认出/.test(n));
      }, null, { timeout: 120000 });
    } catch (e) {
      console.log('     （等待超时）');
    }
    clearInterval(poll);
    const ms = Date.now() - t0;

    const st = await page.evaluate(() => {
      const list = document.getElementById('ocrList');
      const rows = list ? Array.from(list.children) : [];
      return {
        shown: !document.getElementById('ocrResult').hidden,
        note: document.getElementById('ocrNote').textContent.trim(),
        status: document.getElementById('ocrStatus').textContent.trim(),
        rows: rows.length,
        sample: rows.slice(0, 4).map(el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 70))
      };
    });

    ok('识别出结果（' + (ms / 1000).toFixed(1) + 's）', st.shown, st.note + ' | ' + st.status);
    if (st.shown) {
      ok('解析出明细（' + st.rows + ' 条）', st.rows > 0);
      st.sample.forEach(s => console.log('      · ' + s));
    }
    console.log('     进度文案轨迹：' + (seen.length ? seen.join(' → ') : '（没抓到）'));

    await page.evaluate(() => {
      document.getElementById('ocrResult').hidden = true;
      document.getElementById('ocrEmpty').hidden = false;
      document.getElementById('ocrList').innerHTML = '';
    });
  }

  head('收尾');
  ok('全程零网络请求', net.length === 0, net.slice(0, 2).join(' | '));
  ok('无 JS 报错', errs.length === 0, errs.join(' | '));

  await browser.close();
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
})();
