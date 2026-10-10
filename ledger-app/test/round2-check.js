/* ============================================================
   第二轮优化专项测试
   ------------------------------------------------------------
   覆盖：
   ① 预算条分段填色（占比正确）
   ② 账本 icon（迁移默认 / 新建选 icon / 快捷删除）
   ③ 明细筛选改下拉（时间选项生成 / applyTimeVal / 类目下拉联动）
   ④ 统筹卡数字自适应 fitNum
  
   跑法：node test/round2-check.js
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
const doc = window.document;
const $   = id => doc.getElementById(id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const ev  = (el, t) => el.dispatchEvent(new window.Event(t, { bubbles: true }));

window.confirm = () => true;
try{ window.localStorage.clear(); }catch(e){}
window.eval(rd('quotes.js') + '\n' + rd('app.js'));
const L = window.__ledger;
const Y = new Date().getFullYear();
const M = new Date().getMonth() + 1;

/* ══════════════════════════════════════════════════════════
   3. 时间下拉：选项生成 + applyTimeVal
   ══════════════════════════════════════════════════════════ */
head('3. 时间下拉');
const tOpts = L.timeDDOptions();
ok('有「全部时间 / 今年 / 近30 / 近90」', ['all','year','l30','l90'].every(v => tOpts.some(o => o.v === v)));
ok('最近 12 个月都列出来了', tOpts.filter(o => o.v && o.v[0] === 'm').length === 12);
ok('有「自定义区间…」入口', tOpts.some(o => o.v === 'custom'));

// applyTimeVal 走真实 DOM 控件
const fUI = { label: $('fTimeLabel'), customRow: $('fCustomRow'), from: $('fFrom'), to: $('fTo') };
const flt = { range:'all', month:'', from:'', to:'', dd:'all' };
window.eval('undefined');   // no-op
// 直接借页面上的函数（挂在 app.js 顶层，非导出）→ 通过事件路径验证：
click($('fTimeBtn'));
ok('点「全部时间 ▾」展开下拉浮层', !$('fTimeList').hidden);
const monthItem = [...$('fTimeList').children].find(b => b.dataset && b.dataset.ddv === 'm' + Y + '-0' + Math.min(M,9));
ok('浮层里有月份选项', !!monthItem);
if(monthItem){ click(monthItem); }
ok('选月份后浮层收起', $('fTimeList').hidden);
ok('按钮文案变成月份', $('fTimeLabel').textContent.indexOf('月') >= 0, $('fTimeLabel').textContent);

/* ══════════════════════════════════════════════════════════
   4. 类目下拉：选项分组 + 联动
   ══════════════════════════════════════════════════════════ */
head('4. 类目下拉');
click($('btnMoreRec'));                      // 打开全部明细
click($('fCatBtn'));
ok('类目下拉展开', !$('fCatList').hidden);
ok('有「支出」「收入」分组标题',
   [...$('fCatList').children].filter(c => c.classList.contains('dd-group')).length === 2);
const petItem = [...$('fCatList').children].find(b => b.dataset && b.dataset.ddv === 'cat:e:pet');
ok('宠物类目在列表里', !!petItem);
if(petItem) click(petItem);
ok('选宠物后按钮显示「🐱 宠物」', $('fCatLabel').textContent.indexOf('宠物') >= 0, $('fCatLabel').textContent);
ok('只看支出 chip 自动亮起',
   [...doc.querySelectorAll('#subAll .f-chip')].find(c => c.dataset.kind === 'expense').classList.contains('is-on'));
const petCount = L.DB.records.filter(r => r.book === 'main' && r.type === 'expense' && r.cat === 'pet').length;
ok('筛选结果行数 = 宠物支出笔数',
   $('allCount').textContent.indexOf(String(petCount)) >= 0, $('allCount').textContent + ' vs ' + petCount);
click($('fReset'));
ok('重置后类目按钮回到「全部类目」', $('fCatLabel').textContent === '全部类目');
ok('重置后时间按钮回到「全部时间」', $('fTimeLabel').textContent === '全部时间');

/* ══════════════════════════════════════════════════════════
   5. 账本 icon：迁移默认 + 新建选择 + 快捷删除
   ══════════════════════════════════════════════════════════ */
head('5. 账本 icon 与快捷删除');
ok('icon 表至少 10 个可选', L.BOOK_ICONS.length >= 10, L.BOOK_ICONS.length);
ok('老账本迁移出默认图标', !!L.DB.books[0].icon);

// 新建一本带 icon 的统筹账本
click($('btnBook'));
click($('btnNewBook'));
ok('新建浮层里有 icon 九宫格', $('newBookIcons').querySelectorAll('.icon-cell').length >= 10);
const cell = [...$('newBookIcons').children].find(c => c.dataset.icon === '💎');
click(cell);
ok('点了 💎 后选中态跟上', cell.classList.contains('is-on'));
$('newBookName').value = '黄金';
$('newBookKind').querySelector('[data-k="pool"]').click();
click($('newBookOk'));
const gold = L.DB.books.find(b => b.name === '黄金');
ok('账本建出来且 icon 是 💎', gold && gold.icon === '💎', gold && gold.icon);
ok('新建后自动切到了新账本', L.DB.curBook === gold.id);

// 新账本是当前账本 → 没有快捷删除（防手滑）；切回日常后再看
click($('btnBook'));
click($('bookPopList').querySelector('[data-book="main"]'));
click(doc.querySelector('[data-tab="settings"]'));
ok('设置页账本行显示 💎 图标', $('bookManageList').textContent.indexOf('💎') >= 0);
const delBtn2 = $('bookManageList').querySelector('[data-del-book="' + gold.id + '"]');
ok('黄金账本有快捷删除按钮', !!delBtn2);
if(delBtn2){
  click(delBtn2);
  ok('快捷删除后账本没了', !L.DB.books.some(b => b.id === gold.id));
  ok('当前账本没被误删', !!L.DB.curBook && L.DB.books.some(b => b.id === L.DB.curBook));
}

/* ══════════════════════════════════════════════════════════
   6. fitNum：长数字自适应
   ══════════════════════════════════════════════════════════ */
head('6. fitNum');
const netEl = $('poolNet');
L.fitNum(netEl);
ok('短数字不挂档位', !netEl.dataset.len, netEl.dataset.len);
netEl.textContent = '90,388.00';
L.fitNum(netEl);
ok('9 位挂 long', netEl.dataset.len === 'long', netEl.dataset.len);
netEl.textContent = '9,020,000.00';
L.fitNum(netEl);
ok('12 位挂 xlong', netEl.dataset.len === 'xlong', netEl.dataset.len);

/* ══════════════════════════════════════════════════════════
   8. 预算条分段填色
   ══════════════════════════════════════════════════════════ */
head('8. 预算条分段');
ok('当前在日常账本（前面已切回）', L.DB.curBook === 'main');
click(doc.querySelector('[data-tab="home"]'));
click($('btnSetBudget'));
$('askInput').value = '10000';
click($('askOk'));
const segs = $('budBar').querySelectorAll('i');
ok('设了预算后进度条出现且分段', segs.length >= 1, segs.length);
const segTotalW = [...segs].reduce((s, x) => s + parseFloat(x.style.width || 0), 0);
ok('分段宽度 ≤ 100%（不超过预算线）', segTotalW <= 100.5, segTotalW.toFixed(1));
ok('各段颜色互不相同（多类目时）',
   segs.length < 2 || new Set([...segs].map(s => s.style.background)).size > 1);

console.log('\n──────────────────────────────');
console.log(fail ? ('有失败项：' + pass + ' 通过，' + fail + ' 失败') : ('全部通过：' + pass + ' 项'));
process.exit(fail ? 1 : 0);
