/* ============================================================
   单文件 HTML 专项验证
   ------------------------------------------------------------
   验证「发到手机上、用浏览器直接打开 file://」这个场景是否真的可用：
     ① 打开无报错
     ② 首页关键模块渲染正常（预算卡 / 按天卡片流水）
     ③ 记一笔 → 能用 localStorage 存住 → 刷新后还在  ← 离线用的命门
     ④ 截图留档

   跑法：
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       node test/single-file-check.js "路径/记账本.html"
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const FILE = process.argv[2] || path.resolve(__dirname, '..', '..', '记账本.html');
const SHOT = path.join(os.tmpdir(), 'ledger-single.png');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) { pass++; console.log('  ✓ ' + n); }
  else   { fail++; console.log('  ✗ ' + n + (extra ? '   → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');

(async () => {
  if (!fs.existsSync(FILE)) { console.error('找不到文件：' + FILE); process.exit(1); }
  console.log('被测文件：' + FILE + '  (' + (fs.statSync(FILE).size / 1024).toFixed(0) + ' KB)');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--allow-file-access-from-files']
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },   // iPhone 14 视口
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await ctx.newPage();

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  const url = 'file:///' + FILE.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  head('1. 打开无报错');
  ok('没有 JS 报错', errs.length === 0, errs.join(' | '));
  ok('页面标题正常', (await page.title()).length > 0, await page.title());

  head('2. 首页关键模块');
  const dom = await page.evaluate(() => ({
    budget: !!document.querySelector('.budget-card'),
    bar:    !!document.querySelector('.budget-bar'),
    cards:  document.querySelectorAll('.day-card').length,
    recs:   document.querySelectorAll('.rec').length,
    books:  !!document.getElementById('btnBook'),
    tabs:   document.querySelectorAll('#tabbar .tab').length
  }));
  ok('支出预算卡在', dom.budget);
  ok('预算进度条在', dom.bar);
  ok('流水是按天卡片（≥1 张）', dom.cards >= 1, dom.cards + ' 张');
  ok('卡片里有明细行', dom.recs >= 1, dom.recs + ' 条');
  ok('右上角是账本切换按钮', dom.books);
  ok('底部三个 tab', dom.tabs === 3, dom.tabs);

  head('3. 记一笔 → 刷新后还在（离线存储）');
  await page.click('#btnAdd');
  await page.waitForTimeout(350);
  await page.fill('#entryInput', 'etc 高速费 66');
  await page.waitForTimeout(250);
  await page.click('#btnSave');
  await page.waitForTimeout(500);

  const afterAdd = await page.evaluate(() => {
    const raw = localStorage.getItem('ledger.v2') || localStorage.getItem('ledger') || '';
    const txt = document.body.innerText;
    return { storage: raw.length, hasETC: txt.indexOf('66') >= 0 || txt.indexOf('ETC') >= 0 };
  });
  ok('localStorage 有数据', afterAdd.storage > 0, afterAdd.storage + ' 字节');
  ok('刚记的那笔出现在流水里', afterAdd.hasETC);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);
  const afterReload = await page.evaluate(() => document.body.innerText);
  ok('刷新后数据没丢', afterReload.indexOf('66') >= 0 || afterReload.indexOf('ETC') >= 0);

  head('3.5 账本切换 → 首页两张卡互斥（hidden 不被 CSS 顶掉）');
  // 当前日常账本：预算卡显示、资产卡隐藏
  const daily = await page.evaluate(() => ({
    budget: !document.getElementById('budgetCard').hidden &&
            getComputedStyle(document.getElementById('budgetCard')).display !== 'none',
    pool:   document.getElementById('poolCard').hidden ||
            getComputedStyle(document.getElementById('poolCard')).display === 'none'
  }));
  ok('日常账本：预算卡显示', daily.budget);
  ok('日常账本：资产卡隐藏', daily.pool);

  // 预置一个统筹账本并切过去，刷新生效
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ledger.v2'));
    if(!db.books.some(b => b.kind === 'pool'))
      db.books.push({ id: 'pooltest', name: '测试统筹', note: '', kind: 'pool' });
    db.curBook = 'pooltest';
    localStorage.setItem('ledger.v2', JSON.stringify(db));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);
  const pool = await page.evaluate(() => ({
    budget: document.getElementById('budgetCard').hidden ||
            getComputedStyle(document.getElementById('budgetCard')).display === 'none',
    pool:   !document.getElementById('poolCard').hidden &&
            getComputedStyle(document.getElementById('poolCard')).display !== 'none'
  }));
  ok('统筹账本：资产卡显示', pool.pool);
  ok('统筹账本：预算卡隐藏', pool.budget);

  // 切回日常，给后面的截图留个干净状态
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ledger.v2'));
    db.curBook = 'main';
    localStorage.setItem('ledger.v2', JSON.stringify(db));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);

  head('4. 截图');
  await page.screenshot({ path: SHOT, fullPage: false });
  console.log('  截图：' + SHOT);

  console.log('\n结果：' + pass + ' 项通过' + (fail ? '，' + fail + ' 项失败' : '，无失败'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
