/* ============================================================
   记一笔 · 本次新功能专项测试
   ------------------------------------------------------------
   覆盖：多账本（切换/新建/编辑/删除）、统筹账本、
        类目筛选、统计页「支出构成」点击跳转
   跑法：node test/new-features-check.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = path.join(__dirname, '..');
const rd  = f => fs.readFileSync(path.join(DIR, f), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else    { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '   → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');

const html = rd('index.html').replace(
  /<link[^>]*href=["']style\.css["'][^>]*>/i,
  '<style>\n' + rd('style.css') + '\n</style>'
);

const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const doc  = window.document;
const $    = id => doc.getElementById(id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const ev    = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const typeIn = (el, v) => { el.value = v; ev(el, 'input'); };
const change = (el, v) => { el.value = v; ev(el, 'change'); };

window.confirm = () => true;
try{ window.localStorage.clear(); }catch(e){}
window.eval(rd('quotes.js') + '\n' + rd('app.js'));

const L = window.__ledger;
const nowMonth = new Date().toISOString().slice(0, 7);
const today = new Date();
const dstr = d => today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');


/* ══════════════════════════════════════════════════════════
   1. 老数据迁移
   ══════════════════════════════════════════════════════════ */
head('1. 账本迁移');
ok('启动后自动建了「日常账本」', L.DB.books.length === 1 && L.DB.books[0].name === '日常账本');
ok('示例数据全部归进了账本', L.DB.records.every(r => r.book === 'main'));


/* ══════════════════════════════════════════════════════════
   2. 新建账本 + 数据隔离
   ══════════════════════════════════════════════════════════ */
head('2. 新建账本');
click($('btnBook'));
ok('点右上角弹出账本浮层', $('bookPop').classList.contains('is-on'));
ok('列表里列出了 1 本账', $('bookPopList').querySelectorAll('.book-row').length === 1);

click($('btnNewBook'));
ok('弹出新建浮层', $('bookAddPop').classList.contains('is-on'));
typeIn($('newBookName'), '家庭统筹');
click($('newBookKind').querySelector('[data-k="pool"]'));
typeIn($('newBookNote'), '黄金等资产变动');
click($('newBookOk'));
ok('创建后自动切到新账本', L.curBook().name === '家庭统筹');
ok('类型是统筹', L.isPoolBook() === true);
ok('新账本是空的', L.bookRecs().length === 0);
ok('首页右上角按钮名字变了', $('bookName').textContent === '家庭统筹');
ok('统筹模式下首页显示资产卡', !$('poolCard').hidden && $('budgetCard').hidden);

/* 统筹账本里记一笔（买黄金） */
click($('btnAdd'));
ok('记一笔弹窗打开', $('sheetLayer').classList.contains('is-on'));
ok('统筹模式下日期按钮隐藏', $('btnDate').hidden === true);
typeIn($('entryInput'), '购买黄金 3000');
click($('btnSave'));
ok('记进去了', L.bookRecs().length === 1);
ok('记录归属了统筹账本', L.bookRecs()[0].book === L.curBook().id);
ok('资产卡显示投入 3000', $('poolOut').textContent.indexOf('3,000') >= 0, $('poolOut').textContent);

/* 卖出一部分 */
click($('btnAdd'));
typeIn($('entryInput'), '卖出黄金 1200');
click($('typeSeg').querySelector('[data-type="income"]'));
click($('btnSave'));
ok('回收 1200', $('poolIn').textContent.indexOf('1,200') >= 0, $('poolIn').textContent);
ok('结余 = 回收 − 投入 = -1800', $('poolNet').textContent.indexOf('1,800') >= 0, $('poolNet').textContent);

/* 统筹下流水不按天分组，每条带日期 */
ok('统筹流水是平铺卡片（一天一卡结构不存在）',
   $('recList').querySelectorAll('.day-head').length === 0);
ok('每条都带日期行', $('recList').querySelectorAll('.rec-sub').length >= 2);

/* 统筹下统计页：隐藏每日/月度对比 */
click($('btnBook'));
click($('bookPopList').querySelector('[data-book="main"]'));
ok('切回日常账本', L.curBook().name === '日常账本');
ok('日常模式显示预算卡', !$('budgetCard').hidden && $('poolCard').hidden);
doc.querySelector('[data-tab="stats"]').click();
ok('统计页正常显示每日对比', $('cardDaily').style.display !== 'none');


/* ══════════════════════════════════════════════════════════
   3. 统筹账本的统计页
   ══════════════════════════════════════════════════════════ */
head('3. 统筹账本统计页');
click($('btnBook'));
click($('bookPopList').querySelectorAll('.book-row')[1]);
doc.querySelector('[data-tab="stats"]').click();
ok('切到统筹后统计页隐藏每日对比', $('cardDaily').style.display === 'none');
ok('隐藏月度对比', $('cardMonthly').style.display === 'none');
ok('标题带「全部」', $('stTitle').textContent.indexOf('全部') >= 0, $('stTitle').textContent);
ok('支出构成有数据（其他/未分类都能出）', $('stCatList').textContent.length > 0);


/* ══════════════════════════════════════════════════════════
   4. 全部明细：类目筛选（第二轮已改为下拉，这里走下拉路径）
   ══════════════════════════════════════════════════════════ */
head('4. 全部明细 · 类目筛选');
// 统筹账本下明细不按日期看，筛选路径切回日常账本测
click($('btnBook'));
click($('bookPopList').querySelector('[data-book="main"]'));
doc.querySelector('[data-tab="home"]').click();
click($('btnMoreRec'));
click($('fCatBtn'));
ok('全部明细页打开', $('subAll').classList.contains('is-on'));
click($('fCatBtn'));
const foodItem = [...$('fCatList').querySelectorAll('.dd-item')].find(c => c.textContent.indexOf('餐饮') >= 0);
ok('类目下拉里有「餐饮」', !!foodItem);
click(foodItem);
ok('筛选餐饮后计数变少或为 0',
   $('allCount').textContent !== L.bookRecs().length + ' 笔', $('allCount').textContent);
const allBefore = L.bookRecs().length;
click($('fCatBtn'));
click($('fCatList').querySelector('[data-ddv="cat:"]'));
ok('点「全部类目」恢复', $('allCount').textContent === allBefore + ' 笔',
   $('allCount').textContent + ' vs ' + allBefore);
click($('subAll').querySelector('[data-back]'));


/* ══════════════════════════════════════════════════════════
   5. 支出构成 → 类目明细页
   ══════════════════════════════════════════════════════════ */
head('5. 支出构成点击跳转');
doc.querySelector('[data-tab="stats"]').click();
// 切回日常账本再看（当前在统筹）
click($('btnBook'));
click($('bookPopList').querySelector('[data-book="main"]'));
doc.querySelector('[data-tab="stats"]').click();

const row = $('stCatList').querySelector('.cat-row');
ok('支出构成有可点的行', !!row);
click(row);
ok('跳到了类目明细页', $('subCat').classList.contains('is-on'));
ok('标题带类目名和月份', $('subCatTitle').textContent.indexOf('·') >= 0, $('subCatTitle').textContent);
ok('类目下拉按钮显示自动带入的类目',
   $('cCatLabel').textContent.indexOf('·') < 0 &&
   $('cCatLabel').textContent.length > 0 && $('cCatLabel').textContent !== '全部类目',
   $('cCatLabel').textContent);
ok('时间筛选自动选了月份', $('cTimeLabel').textContent.indexOf('月') >= 0, $('cTimeLabel').textContent);
ok('底部合计在统计', $('catPageSum').textContent.indexOf('支出') >= 0);
// 在类目页里改关键字筛选
typeIn($('cKeyword'), '不存在的词xyz');
ok('关键字筛选生效 → 空态', $('catPageList').textContent.indexOf('没有符合') >= 0);
typeIn($('cKeyword'), '');
click($('cReset'));
ok('重置后恢复', $('catPageList').querySelectorAll('.rec').length >= 0);
click($('subCat').querySelector('[data-back]'));
ok('返回后回到统计页（不是首页）',
   !$('subCat').classList.contains('is-on') && $('pageStats').classList.contains('is-on'));


/* ══════════════════════════════════════════════════════════
   6. 账本编辑 / 删除
   ══════════════════════════════════════════════════════════ */
head('6. 账本编辑与删除');
doc.querySelector('[data-tab="settings"]').click();
ok('设置页有账本列表', $('bookManageList').querySelectorAll('.set-row').length === 2);
// 当前账本不能删（防手滑），先切回日常账本再操作统筹那本
click($('btnBook'));
click($('bookPopList').querySelector('[data-book="main"]'));
doc.querySelector('[data-tab="settings"]').click();
click($('bookManageList').querySelector('[data-manage-book="b1"]') ||
      $('bookManageList').querySelectorAll('[data-manage-book]')[1]);
ok('点账本弹出编辑浮层', $('bookEditPop').classList.contains('is-on'));
typeIn($('bookNameInput'), '家庭资产账');
click($('bookSaveBtn'));
ok('改名成功', L.DB.books.some(b => b.name === '家庭资产账'));
ok('设置页刷新了', $('bookManageList').textContent.indexOf('家庭资产账') >= 0);

// 删除有记录的账本（统筹那本有 2 条）
const poolBook = L.DB.books.find(b => b.kind === 'pool');
const nBefore = L.DB.records.length;
click($('bookManageList').querySelector('[data-manage-book="' + poolBook.id + '"]'));
click($('bookDelBtn'));
ok('删除后账本 -1', L.DB.books.length === 1);
ok('账本里的记录一起删了', L.DB.records.length === nBefore - 2, L.DB.records.length + ' vs ' + nBefore);
ok('编辑浮层关了', !$('bookEditPop').classList.contains('is-on'));


/* ══════════════════════════════════════════════════════════
   结果
   ══════════════════════════════════════════════════════════ */
console.log('\n' + '─'.repeat(46));
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('─'.repeat(46));
process.exit(fail ? 1 : 0);
