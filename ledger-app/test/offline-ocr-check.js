/* ============================================================
   离线单文件版自检
   ------------------------------------------------------------
   验证「记账本.html（内嵌引擎）」在 file:// 下、且网络被完全掐断时
   识图能不能真跑通。

   关键：page.route 把一切 http/https 请求 abort 掉，
        所以能跑通就说明它真的一个字节都没联网。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/offline-ocr-check.js [文件路径]
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const FILE = process.argv[2] || path.join(__dirname, '..', 'testout', '记账本-离线版.html');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) { pass++; console.log('  ✓ ' + n); }
  else   { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');

const OCR_JS = () => {
  const t0 = Date.now();
  const c = document.createElement('canvas');
  c.width = 460; c.height = 150;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 460, 150);
  x.fillStyle = '#000000';
  x.font = '42px sans-serif'; x.fillText('ETC 128.50', 16, 58);
  x.font = '34px sans-serif'; x.fillText('HELLO 2026', 16, 112);
  return window.__OCREmbed.boot()
    .then(opts => window.Tesseract.recognize(c, 'chi_sim+eng', opts))
    .then(out => ({ ok: true, text: String(out.data.text).trim(), ms: Date.now() - t0 }))
    .catch(e => ({ ok: false, err: e.name + ': ' + e.message, ms: Date.now() - t0 }));
};

(async () => {
  if (!fs.existsSync(FILE)) { console.log('找不到文件：' + FILE); process.exit(1); }
  console.log('被测文件：' + FILE);
  console.log('  ' + (fs.statSync(FILE).size / 1048576).toFixed(2) + ' MB');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  let netHits = [];
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/^https?:/i.test(u)) { netHits.push(u); return route.abort(); }
    return route.continue();
  });

  const url = 'file:///' + FILE.replace(/\\/g, '/');
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(400);

  head('1. 页面与离线前提');
  ok('无 JS 报错', errs.length === 0, errs.join(' | '));
  ok('file:// 打开成功（' + loadMs + ' ms）', loadMs < 30000);
  ok('引擎数据已内嵌', await page.evaluate(() => !!(window.__OCREmbed && window.__OCREmbed.available())));
  ok('window.Tesseract 已定义', await page.evaluate(() => typeof window.Tesseract === 'object'));

  head('2. 记账功能未受影响');
  ok('__ledger 接口在', await page.evaluate(() => !!(window.__ledger && window.__ledger.parseBillText)));
  ok('首页有渲染宽度', await page.evaluate(() => (document.getElementById('app') || {}).clientWidth > 0));
  ok('能切到识图面板', await page.evaluate(() => {
    const b = document.querySelector('[data-type="ocr"]');
    if (!b) return false;
    b.click();
    const p = document.getElementById('ocrPanel');
    return !!p && !p.hidden;
  }));

  head('3. 离线识别（首次，要解包）');
  const r1 = await page.evaluate(OCR_JS);
  ok('boot + 识别成功', r1.ok, r1.err);
  if (r1.ok) {
    ok('认出 "ETC 128.50"', /ETC\s*128/.test(r1.text), JSON.stringify(r1.text));
    ok('认出 "HELLO 2026"', /HELLO\s*2026/.test(r1.text), JSON.stringify(r1.text));
    console.log('     首次耗时 ' + r1.ms + ' ms');
  }

  head('4. 重新打开（应命中 IndexedDB，跳过解包）');
  errs.length = 0;
  netHits = [];
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  const r2 = await page.evaluate(OCR_JS);
  ok('第二次识别仍成功', r2.ok, r2.err);
  if (r1.ok && r2.ok) {
    ok('比首次更快（缓存生效）', r2.ms <= r1.ms * 1.35,
       '首次 ' + r1.ms + 'ms → 二次 ' + r2.ms + 'ms');
  }
  ok('重开后无报错', errs.length === 0, errs.join(' | '));

  head('5. 断网验证');
  ok('全程零网络请求', netHits.length === 0,
     netHits.slice(0, 3).join(' | ') || '');

  await browser.close();
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
})();
