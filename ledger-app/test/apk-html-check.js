/**
 * 从 APK 里提取出来的 index.html，在真实浏览器引擎里跑一遍。
 *
 * 为什么值得单独测：这个文件就是 Android WebView 会执行的那一份东西。
 * 这里重点验证「装成 App 之后才有的行为」——物理返回键、数据持久化。
 *
 * 前置：先跑 android/tools/verify-apk.py（它负责把 HTML 从 APK 里提取出来）
 * 跑法：node test/apk-html-check.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const HTML = 'C:/Users/28731/AppData/Local/Temp/apkcheck/from-apk.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
const failed = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; failed.push(name); console.log('  ✗ ' + name + (extra ? '   ' + extra : '')); }
}
function head(t) { console.log('\n' + t); }

(async () => {
  if (!fs.existsSync(HTML)) {
    console.log('✗ 找不到 ' + HTML);
    console.log('  先跑：python android/tools/verify-apk.py');
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const external = [];
  const errors = [];
  page.on('request', r => {
    const u = r.url();
    if (!/^(file|data|blob):/.test(u)) external.push(u);
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log('═'.repeat(62));
  console.log(' APK 内置页面的行为验证');
  console.log('═'.repeat(62));

  // ── 1. 基本渲染 ─────────────────────────────────────────
  head('1. 页面本身');
  const basic = await page.evaluate(() => ({
    tabs: document.querySelectorAll('.tab').length,
    hasHome: !!document.getElementById('pageHome'),
    hasStats: !!document.getElementById('pageStats'),
    hasSettings: !!document.getElementById('pageSettings'),
    hasFab: !!document.getElementById('btnAdd'),
    quotes: (window.__ledger && window.__ledger.QUOTES_BUILTIN || []).length,
    specH: (window.__ledger && window.__ledger.THEME_SPEC || {}).h,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  ok('底部三个 tab 都在', basic.tabs === 3, '实际 ' + basic.tabs);
  ok('首页 / 统计 / 设置 三页都在', basic.hasHome && basic.hasStats && basic.hasSettings);
  ok('「记一笔」按钮在', basic.hasFab);
  ok('激励语库已加载（≥300 条）', basic.quotes >= 300, basic.quotes + ' 条');
  ok('主题图规格已加载（高 4520）', basic.specH === 4520, 'h=' + basic.specH);
  ok('页面横向不溢出', basic.scrollW === basic.clientW,
     basic.scrollW + ' vs ' + basic.clientW);

  // ── 2. 返回键钩子存在 ───────────────────────────────────
  head('2. 返回键钩子（Android 侧靠它决定「退到哪」）');
  const hasHook = await page.evaluate(() => typeof window.__ledgerBack === 'function');
  ok('window.__ledgerBack 是个函数', hasHook);
  if (!hasHook) {
    await browser.close();
    console.log('\n钩子都不在，后面不用测了');
    process.exit(1);
  }

  const idle = await page.evaluate(() => window.__ledgerBack());
  ok('首页 + 无浮层时返回 false（交给原生把 App 收到后台）', idle === false, String(idle));

  // ── 3. 返回键：关「记一笔」弹窗 ─────────────────────────
  head('3. 返回键逐层退：记一笔弹窗');
  await page.click('#btnAdd');
  await page.waitForTimeout(450);
  const sheetOpen = await page.evaluate(() =>
    document.getElementById('sheetLayer').classList.contains('is-on'));
  ok('点「＋」后弹窗打开', sheetOpen);

  let r = await page.evaluate(() => window.__ledgerBack());
  await page.waitForTimeout(400);
  const sheetClosed = await page.evaluate(() =>
    !document.getElementById('sheetLayer').classList.contains('is-on'));
  ok('返回键 → 返回 true', r === true, String(r));
  ok('返回键 → 弹窗被关掉', sheetClosed);

  // ── 4. 返回键：关主题浮层 ───────────────────────────────
  head('4. 返回键逐层退：主题浮层');
  await page.click('#btnTheme');
  await page.waitForTimeout(450);
  const popOpen = await page.evaluate(() =>
    document.getElementById('themePop').classList.contains('is-on'));
  ok('点主题按钮后浮层打开', popOpen);
  r = await page.evaluate(() => window.__ledgerBack());
  await page.waitForTimeout(400);
  const popClosed = await page.evaluate(() =>
    !document.getElementById('themePop').classList.contains('is-on'));
  ok('返回键 → 返回 true', r === true, String(r));
  ok('返回键 → 浮层被关掉', popClosed);

  // ── 5. 返回键：退二级页（全部明细）─────────────────────
  head('5. 返回键逐层退：二级页');
  await page.evaluate(() => window.openSub ? null : null);
  await page.click('#btnMoreRec');
  await page.waitForTimeout(500);
  const subOpen = await page.evaluate(() =>
    !!document.querySelector('.sub.is-on'));
  ok('点「更多」后二级页打开', subOpen);
  const subFilters = await page.evaluate(() => ({
    kw: !!document.getElementById('fKeyword'),
    range: !!document.getElementById('fTimeBtn'),
    list: document.querySelectorAll('#allList .rec').length,
  }));
  ok('二级页有关键词输入框', subFilters.kw);
  ok('二级页有时间范围筛选（下拉）', subFilters.range);
  r = await page.evaluate(() => window.__ledgerBack());
  await page.waitForTimeout(400);
  const subClosed = await page.evaluate(() => !document.querySelector('.sub.is-on'));
  ok('返回键 → 返回 true', r === true, String(r));
  ok('返回键 → 二级页退回', subClosed);

  // ── 6. 返回键：非首页 tab 回首页 ────────────────────────
  head('6. 返回键逐层退：从统计/设置 tab 回首页');
  await page.click('[data-tab="stats"]');
  await page.waitForTimeout(500);
  const onStats = await page.evaluate(() =>
    document.getElementById('pageStats').classList.contains('is-on'));
  ok('切到统计页', onStats);
  r = await page.evaluate(() => window.__ledgerBack());
  await page.waitForTimeout(500);
  const backHome = await page.evaluate(() =>
    document.getElementById('pageHome').classList.contains('is-on'));
  ok('返回键 → 返回 true', r === true, String(r));
  ok('返回键 → 回到首页', backHome);

  await page.click('[data-tab="settings"]');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => window.__ledgerBack());
  await page.waitForTimeout(500);
  const backHome2 = await page.evaluate(() =>
    document.getElementById('pageHome').classList.contains('is-on'));
  ok('设置页按返回 → 也回首页', r === true && backHome2);

  // ── 7. 数据持久化（WebView 里就是 localStorage）─────────
  head('7. 数据持久化');
  await page.click('#btnAdd');
  await page.waitForTimeout(450);
  await page.fill('#entryInput', '验证包子 12.5');
  await page.waitForTimeout(250);
  await page.click('#btnSave');
  await page.waitForTimeout(600);

  const savedNow = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ledger.v2') || '{}');
    return (db.records || []).some(x => (x.title || '').indexOf('包子') >= 0);
  });
  ok('记一笔之后立刻存在 localStorage', savedNow);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const afterReload = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ledger.v2') || '{}');
    const hit = (db.records || []).find(x => (x.title || '').indexOf('包子') >= 0);
    const shown = document.getElementById('recList').textContent.indexOf('包子') >= 0;
    return { persisted: !!hit, amount: hit ? hit.amount : null, shown: shown };
  });
  ok('重新打开后数据还在（不会丢账）', afterReload.persisted);
  ok('金额也存对了（12.5）', afterReload.amount === 12.5, String(afterReload.amount));
  ok('首页流水里能看到这一笔', afterReload.shown);

  // ── 8. 零外部请求 / 零报错 ──────────────────────────────
  head('8. 离线与洁净度');
  ok('整个过程零外部网络请求', external.length === 0,
     external.length ? external.slice(0, 3).join(' , ') : '0 个');
  const realErrors = errors.filter(e => !/favicon|net::ERR_FILE_NOT_FOUND/i.test(e));
  ok('无 JS 报错', realErrors.length === 0,
     realErrors.length ? realErrors.slice(0, 3).join(' | ') : '0 个');

  // ── 9. 主题上传通道（<input type=file> 在 WebView 里靠原生接管）──
  head('9. 上传通道的 DOM 前提');
  const upload = await page.evaluate(() => {
    const a = document.getElementById('fileAvatar');
    const t = document.getElementById('fileTheme');
    return {
      avatar: !!a, theme: !!t,
      avatarAccept: a ? (a.getAttribute('accept') || '') : '',
      themeAccept: t ? (t.getAttribute('accept') || '') : '',
    };
  });
  ok('头像上传控件在', upload.avatar, upload.avatarAccept);
  ok('主题图上传控件在', upload.theme, upload.themeAccept);
  ok('两个控件都声明了 image 类型', /image/.test(upload.avatarAccept) && /image/.test(upload.themeAccept));

  await browser.close();

  console.log('\n' + '═'.repeat(62));
  console.log(' 结果：' + pass + ' 项通过，' + fail + ' 项失败');
  if (failed.length) {
    console.log(' 失败项：');
    failed.forEach(f => console.log('   ✗ ' + f));
  }
  console.log('═'.repeat(62));
  process.exit(fail ? 1 : 0);
})();
