/* ============================================================
   记账数据救援页 · 集成测试
   ------------------------------------------------------------
   场景：用户旧版记账数据存在浏览器的 file:// 本地存储里，
        需要把它原样取出来（导出成能导入新版的备份 JSON）。

   在真实 Chrome 里跑，全程 file://：
     1. 用一个临时页面写入 ledger.v1（老版结构）
     2. 打开救援页 —— 它应该能读到同一份存储（file:// 共享）
     3. 检查诊断信息（条数 / 日期范围 / 金额合计）
     4. 检查导出的文本是合法的新版备份结构
     5. 检查「就地升级」把数据写成了 ledger.v2

   跑法：
     NODE_PATH=... node test/rescue-check.js
   ============================================================ */
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { chromium } = require('playwright-core');

const CHROME   = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RESCUE   = 'C:/Users/28731/Desktop/记账数据救援.html';
const TMP      = path.join(os.tmpdir(), 'rescue-' + Date.now());
fs.mkdirSync(TMP, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else    { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '   → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');
const url  = f => 'file:///' + f.replace(/\\/g, '/');

/* 老版本（v1）的真实存储结构：只有 seeded + records */
const OLD_DATA = {
  v: 1,
  seeded: true,
  records: [
    { id:'r1', date:'2026-08-01', type:'expense', amount:2550,  cat:'餐饮',  title:'午饭',   ts:1 },
    { id:'r2', date:'2026-08-03', type:'expense', amount:12800, cat:'购物',  title:'鞋',     ts:2 },
    { id:'r3', date:'2026-08-11', type:'income',  amount:500000, cat:'工资', title:'八月工资', ts:3 }
  ]
};

const seeder = path.join(TMP, 'seed.html');
fs.writeFileSync(seeder, '<!doctype html><meta charset="utf-8"><body>seed</body>');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  head('① 写入旧版数据（模拟用户之前那一版的环境）');
  await page.goto(url(seeder));
  await page.evaluate(`localStorage.clear(); localStorage.setItem('ledger.v1', ${JSON.stringify(JSON.stringify(OLD_DATA))});`);
  const written = await page.evaluate("localStorage.getItem('ledger.v1') !== null");
  ok('旧数据已写入 file:// 本地存储', written);

  head('② 打开救援页，看它能不能读到');
  await page.goto(url(RESCUE));
  await page.waitForTimeout(300);

  const diagText = await page.textContent('#diag');
  ok('页面无 JS 报错', errors.length === 0, errors.join(' | '));
  ok('识别到数据键 ledger.v1', /ledger\.v1/.test(diagText));
  ok('显示记录条数 3 条', /3\s*条/.test(diagText), diagText.replace(/\s+/g, ' ').slice(0, 160));
  ok('显示时间范围', /2026-08-01/.test(diagText) && /2026-08-11/.test(diagText));
  ok('显示金额合计 ¥5153.50', /5,?153\.50/.test(diagText), diagText.replace(/\s+/g, ' ').slice(0, 200));
  ok('判定为「可以」导出', /可以/.test(diagText));

  const actionsVisible = await page.evaluate("!document.getElementById('actions').hidden");
  ok('操作区已显示', actionsVisible);

  head('③ 导出的文本结构对不对');
  await page.click('#btnShow');
  await page.waitForTimeout(150);
  const out = await page.inputValue('#out');
  let bak = null;
  try{ bak = JSON.parse(out); }catch(e){}
  ok('导出文本是合法 JSON', bak !== null);
  ok('是 v3 备份结构', bak && bak.v === 3);
  ok('records 完整带过来（3 条）', bak && bak.records && bak.records.length === 3, bak && bak.records && bak.records.length);
  ok('amount 单位未被改动', bak && bak.records[0].amount === 2550, bak && bak.records[0] && bak.records[0].amount);
  ok('类目保留', bak && bak.records[0].cat === '餐饮');
  ok('补上了 books 数组', bak && Array.isArray(bak.books) && bak.books.length >= 1);
  ok('每条记录都有账本归属', bak && bak.records.every(r => r.book && bak.books.some(b => b.id === r.book)));
  ok('补上了 curBook', bak && typeof bak.curBook === 'string' && bak.curBook);
  ok('补上了 budget 对象', bak && bak.budget && typeof bak.budget === 'object');

  head('④ 复制按钮');
  await page.evaluate(() => {
    window.__clip = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText(t){ window.__clip = t; return Promise.resolve(); } }
    });
  });
  await page.click('#btnCopy');
  await page.waitForTimeout(200);
  const clip = await page.evaluate('window.__clip');
  let clipOk = false;
  try{ clipOk = Array.isArray(JSON.parse(clip).records); }catch(e){}
  ok('剪贴板拿到完整备份', clipOk, String(clip).slice(0, 50));

  head('⑤ 就地升级：写成新版能读的结构');
  await page.click('#btnUpgrade');
  await page.waitForTimeout(200);
  const v2raw = await page.evaluate("localStorage.getItem('ledger.v2')");
  let v2 = null;
  try{ v2 = JSON.parse(v2raw); }catch(e){}
  ok('ledger.v2 已写入', v2 !== null);
  ok('v2 里有 3 条记录', v2 && v2.records && v2.records.length === 3);
  ok('v2 规格正确（有 books）', v2 && Array.isArray(v2.books) && v2.books.length >= 1);

  head('⑥ 新版账本打开后应该直接看到数据');
  const APP = 'C:/Users/28731/Desktop/记账本.html';
  await page.goto(url(APP));
  await page.waitForTimeout(700);
  const appState = await page.evaluate(`(function(){
    try{
      var d = JSON.parse(localStorage.getItem('ledger.v2'));
      return {
        count: (d.records || []).length,
        books: (d.books || []).length,
        titles: (d.records || []).map(function(r){ return r.title; })
      };
    }catch(e){ return { err: String(e) }; }
  })()`);
  ok('新版读到的记录数 = 3', appState.count === 3, JSON.stringify(appState));
  ok('记录标题完整带过来', appState.titles && appState.titles.indexOf('午饭') >= 0, JSON.stringify(appState.titles));
  ok('首页无 JS 报错', errors.length === 0, errors.join(' | '));

  // 注意：首页只显示「当月」流水，而上面那批旧数据是 8 月的，
  // 所以这里另插一条今天的记录，单独确认首页渲染链路是通的。
  await page.evaluate(`(function(){
    var t = new Date();
    var y = t.getFullYear();
    var m = ('0' + (t.getMonth() + 1)).slice(-2);
    var d = ('0' + t.getDate()).slice(-2);
    window.__ledger.importFromText(JSON.stringify({ v:3, records: [
      { id:'t-today', date: y + '-' + m + '-' + d, type:'expense', amount:3300, cat:'餐饮', title:'今日验证', ts: 99 }
    ]}));
  })()`);
  await page.waitForTimeout(300);
  const todayVisible = await page.evaluate("document.body.innerText.indexOf('今日验证') >= 0");
  ok('首页能显示当月记录（渲染链路通）', todayVisible);

  head('⑦ 空环境（没有旧数据时）的提示');
  await page.evaluate('localStorage.clear()');
  await page.goto(url(RESCUE));
  await page.waitForTimeout(250);
  const diag2 = await page.textContent('#diag');
  ok('明确提示没找到数据', /没找到账本数据/.test(diag2), diag2.replace(/\s+/g, ' ').slice(0, 120));
  ok('同时给出可能原因', /另一个浏览器/.test(diag2));

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });

  console.log('\n──────────────────────────────────────────────');
  console.log(fail === 0 ? ('全部通过：' + pass + ' 项') : ('通过 ' + pass + ' 项，失败 ' + fail + ' 项'));
  console.log('──────────────────────────────────────────────');
  process.exit(fail === 0 ? 0 : 1);
})();
