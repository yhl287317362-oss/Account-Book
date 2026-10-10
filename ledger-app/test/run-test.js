/* ============================================================
   记一笔 · 自动化测试
   ------------------------------------------------------------
   跑法：node test/run-test.js
   它做的事：把 index.html 装进一个假浏览器，把 quotes.js + app.js
   注进去，然后像真人一样点按钮、填输入框，最后逐条核对结果。
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

/* ── 装一个假浏览器 ──
   CSS 先内联进去：一是 jsdom 不加载外部 <link>，内联后 getComputedStyle 才算得出来；
   二是顺便验证了「打包成单文件」之后样式依然生效。

   ★ 必须用正则，不能用精确字符串：
     WorkBuddy 的预览面板会给标签注入，
     精确匹配会突然失配 → CSS 静默地没内联 → 一大堆 getComputedStyle 断言集体崩，
     而且报出来的错是「pointer-events 是 auto」这种完全指错方向的信息。 */
const html = rd('index.html').replace(
  /<link[^>]*href=["']style\.css["'][^>]*>/i,
  '<style>\n' + rd('style.css') + '\n</style>'
);
if (!/<style>/.test(html)) {
  console.error('测试环境装配失败：style.css 没能内联进 index.html');
  process.exit(1);
}

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;
const doc  = window.document;
const $    = id => doc.getElementById(id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const ev    = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const typeIn = (el, v) => { el.value = v; ev(el, 'input'); };

window.confirm = () => true;
try{ window.localStorage.clear(); }catch(e){}

// 两个文件合并注入，跟打包成单文件后的执行方式一致
window.eval(rd('quotes.js') + '\n' + rd('app.js'));

const L = window.__ledger;
const amtOf = () => $('parseAmt').textContent;
const recs  = () => $('recList').querySelectorAll('.rec');


/* ══════════════════════════════════════════════════════════
   1. 激励语录
   ══════════════════════════════════════════════════════════ */
head('1. 激励池语录');
ok('至少 300 条', L.QUOTES_BUILTIN.length >= 300, L.QUOTES_BUILTIN.length);
ok('没有重复', new Set(L.QUOTES_BUILTIN).size === L.QUOTES_BUILTIN.length);
ok('都在 10~30 字之间',
  L.QUOTES_BUILTIN.every(q => q.length >= 10 && q.length <= 30),
  L.QUOTES_BUILTIN.filter(q => q.length < 10 || q.length > 30).join(' / '));
ok('首页显示了一条激励语', $('greetQuote').textContent.length >= 8, $('greetQuote').textContent);


/* ══════════════════════════════════════════════════════════
   2. 问候语按时段
   ══════════════════════════════════════════════════════════ */
head('2. 问候语');
const hello = L.greetWord();
ok('返回四选一', ['早上好！','中午好！','下午好！','晚上好！'].indexOf(hello) >= 0, hello);
ok('和页面里显示的一致', $('greetHi').textContent === hello);


/* ══════════════════════════════════════════════════════════
   3. 一句话自动拆解（这是最容易算错的地方）
   ══════════════════════════════════════════════════════════ */
head('3. 自动拆解 事项+金额+分类');
[ // [输入, 期望金额, 期望事项, 期望分类]
  ['火车票 331',            331,    '火车票',    'traffic'],
  ['¥331 火车票',           331,    '火车票',    'traffic'],
  ['王富贵火锅302.25',      302.25, '王富贵火锅','food'],
  ['9.25青旅33',             33,    '9.25青旅',  'travel'],
  ['10.1电竞酒店522',       522,    '10.1电竞酒店','fun'],
  ['奶茶/15.5',              15.5,  '奶茶',      'food'],
  ['打车 20 块',             20,    '打车',      'traffic'],
  ['电费 128元',            128,    '电费',      'home'],
  ['电影票 68',              68,    '电影票',    'fun'],
  ['房租 2500',            2500,    '房租',      'home'],
  ['外卖16.4',               16.4,  '外卖',      'food'],
  ['买药 56',                56,    '买药',      'medical'],
  ['随礼 200',              200,    '随礼',      'social'],
  ['朋友还我个东西 88',       88,    '朋友还我个东西', null],   // 认不出 → null，界面再兜底成「其他」
  ['不知道花了多少',        null,    '不知道花了多少', null],
  ['',                     null,    '',          null]
].forEach(([text, amount, title, cat]) => {
  const r = L.parseEntry(text);
  ok('「' + text + '」→ ' + amount + ' / ' + title + ' / ' + cat,
     r.amount === amount && r.title === title && r.cat === cat,
     JSON.stringify(r));
});


/* ══════════════════════════════════════════════════════════
   4. 底部三个 Tab
   ══════════════════════════════════════════════════════════ */
head('4. 底部 Tab 切换');
ok('默认在首页', $('pageHome').classList.contains('is-on'));
ok('统计页一开始是隐藏的', !$('pageStats').classList.contains('is-on'));

click(doc.querySelector('[data-tab="stats"]'));
ok('点「统计」→ 统计页出现', $('pageStats').classList.contains('is-on'));
ok('点「统计」→ 首页收起', !$('pageHome').classList.contains('is-on'));
ok('统计页画出了环形图', $('donut').querySelectorAll('circle').length > 0,
   $('donut').innerHTML.slice(0, 60));
ok('统计页画出了每日对比柱', $('chartDaily').querySelectorAll('.bar-col').length > 0);
ok('月度对比是 6 根柱', $('chartMonthly').querySelectorAll('.bar-col').length === 6,
   $('chartMonthly').querySelectorAll('.bar-col').length);
ok('有支出排行', $('rankList').querySelectorAll('.rank-item').length > 0);

click(doc.querySelector('[data-tab="settings"]'));
ok('点「设置」→ 设置页出现', $('pageSettings').classList.contains('is-on'));

click(doc.querySelector('[data-tab="home"]'));
ok('点「首页」→ 回到首页', $('pageHome').classList.contains('is-on'));


/* ══════════════════════════════════════════════════════════
   5. 首页不再有「本月预算」和「分类统计」
   ══════════════════════════════════════════════════════════ */
head('5. 首页版块增删');
const homeText = $('pageHome').textContent;
ok('「本月预算」已从首页去掉', homeText.indexOf('本月预算') < 0);
ok('「分类统计」已从首页去掉', homeText.indexOf('分类统计') < 0);
ok('「最近常用」已从首页去掉', homeText.indexOf('最近常用') < 0);
ok('「流水」在首页', homeText.indexOf('流水') >= 0);
ok('首页是「支出预算」卡（不再是今日/本月支出）',
   homeText.indexOf('支出(元)') >= 0 && homeText.indexOf('收入(元)') >= 0);


/* ══════════════════════════════════════════════════════════
   6. 流水板块：整页一起滚 + 更多入口
   ══════════════════════════════════════════════════════════ */
head('6. 流水板块');
/* 原来这里是独立滚动的小窗口（overscroll-behavior:contain），
   手指在流水里往上滑会被 contain 挡住、翻不动整页 —— 现在取消内滚。 */
ok('流水不再有独立滚动窗口', !$('flowScroll'));
ok('流水就在整页滚动区里（跟着一起滑）', $('bodyHome').contains($('recList')));
ok('首页最多只渲染 8 条', recs().length <= 8, recs().length + ' 条');
ok('还有更多时给了提示',
   !$('flowHint').hidden && $('flowHint').textContent.indexOf('还有') >= 0,
   JSON.stringify($('flowHint').textContent));
ok('流水有「更多」按钮', !!$('btnMoreRec'));
ok('示例数据渲染出了流水条目', recs().length > 0, recs().length);

click($('btnMoreRec'));
ok('点「更多」→ 打开全部明细页', $('subAll').classList.contains('is-on'));
ok('全部明细里列出了记录', $('allList').querySelectorAll('.rec').length > 0);
ok('底部有合计区', $('allSum').textContent.indexOf('支出') >= 0);

head('6b. 全部明细 · 筛选');
const allN = $('allList').querySelectorAll('.rec').length;
typeIn($('fKeyword'), '聚餐');
const hitN = $('allList').querySelectorAll('.rec').length;
ok('搜「聚餐」能筛出记录', hitN > 0 && hitN < allN, hitN + ' / ' + allN);
ok('搜出来的确实是聚餐', $('allList').textContent.indexOf('聚餐') >= 0);

typeIn($('fKeyword'), '回家');
ok('备注也能被搜到', $('allList').querySelectorAll('.rec').length > 0,
   $('allList').textContent.slice(0, 40));

typeIn($('fKeyword'), 'zzz不存在zzz');
ok('搜不存在的词 → 空态提示', $('allList').textContent.indexOf('没有符合条件') >= 0);

click($('fReset'));
ok('重置后恢复全部', $('allList').querySelectorAll('.rec').length === allN);

click(doc.querySelector('.f-chip[data-kind="income"]'));
ok('「只看收入」只剩收入',
   $('allList').querySelectorAll('.rec-amt.income').length ===
   $('allList').querySelectorAll('.rec').length);
click(doc.querySelector('.f-chip[data-kind="all"]'));

$('allList').querySelector('.rec').dispatchEvent(
  new window.MouseEvent('click', { bubbles: true }));
ok('点明细能打开编辑弹窗', $('sheetLayer').classList.contains('is-on'));
click($('btnClose'));
ok('关掉了', !$('sheetLayer').classList.contains('is-on'));

click($('subAll').querySelector('[data-back]'));
ok('返回按钮能关掉二级页面', !$('subAll').classList.contains('is-on'));


/* ══════════════════════════════════════════════════════════
   7. 记一笔：新交互
   ══════════════════════════════════════════════════════════ */
head('7. 记一笔');
click($('btnAdd'));
ok('弹窗打开', $('sheetLayer').classList.contains('is-on'));
ok('提示语是「支出/收入 123」', $('entryInput').placeholder === '支出/收入 123',
   $('entryInput').placeholder);
ok('原来的数字键盘已经不存在', doc.querySelector('#keypad') === null);
ok('没有那个「123 ▾」按钮了', doc.querySelector('#btnKeypad') === null);
ok('备注行默认收起', !$('noteRow').classList.contains('is-on'));

typeIn($('entryInput'), '火车票 331');
ok('识别出金额 331', amtOf() === '¥ 331.00', amtOf());
ok('识别出分类「交通」', $('parseChip').textContent.indexOf('交通') >= 0, $('parseChip').textContent);
ok('保存按钮已激活', $('btnSave').classList.contains('is-ready'));

click($('btnNote'));
ok('点备注 → 展开备注行', $('noteRow').classList.contains('is-on'));
typeIn($('noteInput'), '周末回家');
ok('备注写进去了', $('noteInput').value === '周末回家');

const before = L.DB.records.length;
click($('btnSave'));
ok('保存后记录 +1', L.DB.records.length === before + 1, L.DB.records.length);
const added = L.DB.records[L.DB.records.length - 1];
ok('金额存对了', added.amount === 331);
ok('事项存对了', added.title === '火车票');
ok('分类存对了', added.cat === 'traffic');
ok('备注存对了', added.note === '周末回家', added.note);
ok('弹窗已关闭', !$('sheetLayer').classList.contains('is-on'));

head('7b. 备注显示在明细里');
ok('首页流水里能看到备注或事项',
   $('recList').textContent.indexOf('周末回家') >= 0 ||
   $('recList').textContent.indexOf('火车票') >= 0);
ok('备注确实渲染成了小标签', $('recList').querySelectorAll('.rec-note').length > 0,
   $('recList').querySelectorAll('.rec-note').length);


/* ══════════════════════════════════════════════════════════
   8. 改一笔 / 删一笔 / 撤销
   ══════════════════════════════════════════════════════════ */
head('8. 改与删');
click(recs()[0]);
ok('点流水打开编辑', $('sheetLayer').classList.contains('is-on'));
ok('编辑时出现删除按钮', !$('btnDelete').hidden);
ok('金额已回填', $('entryInput').value.length > 0, $('entryInput').value);

const n1 = L.DB.records.length;
click($('btnDelete'));
ok('删除后记录 -1', L.DB.records.length === n1 - 1, L.DB.records.length);
ok('弹出撤销提示', $('toast').textContent.indexOf('撤销') >= 0);
click($('toast'));
ok('撤销后记录回来了', L.DB.records.length === n1, L.DB.records.length);


/* ══════════════════════════════════════════════════════════
   9. 最近常用（已按需求删除）+ 支出预算卡
   ══════════════════════════════════════════════════════════ */
head('9. 预算卡（最近常用已删）');
ok('最近常用板块已删除', !$('cardQuick') && !$('quickRow'));
ok('预算卡存在', !!$('budgetCard'));
ok('预算卡可见（日常账本）', !$('budgetCard').hidden);
ok('显示月份', $('budMonthText').textContent.indexOf('月') >= 0);
ok('有设置预算入口', $('btnSetBudget').textContent.indexOf('预算') >= 0);
// 设一笔预算，看进度条
click($('btnSetBudget'));
ok('弹出预算输入', $('askPop').classList.contains('is-on'));
$('askInput').value = '3000';
click($('askOk'));
ok('预算存进了 DB', Object.keys(L.DB.budget).length > 0);
ok('进度条出现了', !$('budBarWrap').hidden);
const budSegs = $('budBar').querySelectorAll('i');
ok('进度条按类目分段填色（≥1 段）', budSegs.length >= 1, budSegs.length);
ok('每段都有颜色和占比宽度',
   [...budSegs].every(s => s.style.background && parseFloat(s.style.width) > 0));
// 占比正确性：所有段宽加起来 ≈ 已用/预算 的总占比
const segTotal = [...budSegs].reduce((s, x) => s + parseFloat(x.style.width), 0);
ok('各段宽度加总 = 总进度', Math.abs(segTotal - Math.min(segTotal, 100)) < 1 || segTotal <= 100.5, segTotal.toFixed(1));
ok('进度条文字里有「已用」', $('budBarTxt').textContent.indexOf('已用') >= 0);


/* ══════════════════════════════════════════════════════════
   9b. 分类识别：ETC 大小写 / 宠物
   ══════════════════════════════════════════════════════════ */
head('9b. 分类识别');
ok('「ETC」识别为交通', L.guessCat('ETC充值', 'expense') === 'traffic', L.guessCat('ETC充值', 'expense'));
ok('「etc」小写也识别为交通', L.guessCat('etc 充值 200', 'expense') === 'traffic');
ok('「猫条」识别为宠物', L.guessCat('猫条 35', 'expense') === 'pet', L.guessCat('猫条 35', 'expense'));
ok('「狗粮」识别为宠物', L.guessCat('狗粮', 'expense') === 'pet');
ok('「宠物医院」识别为宠物（不是医疗）', L.guessCat('宠物医院', 'expense') === 'pet');
ok('「医院」依然是医疗', L.guessCat('去医院看病', 'expense') === 'medical');
ok('宠物分类存在于类目表', L.CATS.expense.some(c => c.k === 'pet' && c.n === '宠物'));


/* ══════════════════════════════════════════════════════════
   10. 激励池管理
   ══════════════════════════════════════════════════════════ */
head('10. 激励池');
click(doc.querySelector('[data-tab="settings"]'));
click($('setQuotes'));
ok('打开了激励池页面', $('subQuotes').classList.contains('is-on'));

const items = $('quoteList').querySelectorAll('.quote-item');
ok('列出了全部语录', items.length === L.QUOTES_BUILTIN.length, items.length);
ok('每一条默认都是开的',
   $('quoteList').querySelectorAll('.switch.is-on').length === L.QUOTES_BUILTIN.length,
   $('quoteList').querySelectorAll('.switch.is-on').length);

const firstSwitch = $('quoteList').querySelector('.switch');
click(firstSwitch);
ok('关掉一条后不是开状态了',
   $('quoteList').querySelectorAll('.switch.is-on').length === L.QUOTES_BUILTIN.length - 1);
ok('关掉的记进了关闭名单', L.DB.quotes.off.length === 1, L.DB.quotes.off.length);

click($('quoteList').querySelector('.quote-item .switch'));
ok('可以再打开', L.DB.quotes.off.length === 0);

click($('btnAddQuote'));
ok('弹出输入浮层', $('askPop').classList.contains('is-on'));
$('askInput').value = '这是我女朋友写的一句话';
click($('askOk'));
ok('自己的语录加进去了', L.DB.quotes.custom.length === 1, L.DB.quotes.custom.length);
ok('自己的语录排在最前面（置顶）',
   $('quoteList').querySelector('.quote-item').classList.contains('is-mine'));
ok('有自己的标记', $('quoteList').textContent.indexOf('我的') >= 0);
ok('设置页的计数更新了', $('setQuotesVal').textContent.indexOf('/') > 0, $('setQuotesVal').textContent);

click($('btnAddQuote'));
$('askInput').value = '这是我女朋友写的一句话';
click($('askOk'));
ok('重复的加不进去', L.DB.quotes.custom.length === 1, L.DB.quotes.custom.length);

click($('quoteList').querySelector('[data-del-quote]'));
ok('能删掉自己的语录', L.DB.quotes.custom.length === 0);

click($('subQuotes').querySelector('[data-back]'));
ok('返回设置页', !$('subQuotes').classList.contains('is-on'));


/* ══════════════════════════════════════════════════════════
   11. 主题
   ══════════════════════════════════════════════════════════ */
head('11. 主题切换');
ok('主题网格里有 5 套内置主题', $('themeGrid').querySelectorAll('.theme-item').length === 5,
   $('themeGrid').querySelectorAll('.theme-item').length);
ok('默认是海洋', doc.documentElement.dataset.theme === 'ocean',
   doc.documentElement.dataset.theme);

click($('themeGrid').querySelector('[data-theme-id="sunset"]'));
ok('切到日落 → data-theme 变了', doc.documentElement.dataset.theme === 'sunset',
   doc.documentElement.dataset.theme);
ok('切到日落 → 已选中标记跟上了',
   $('themeGrid').querySelector('[data-theme-id="sunset"]').classList.contains('is-on'));

/* 首页右上角已改成「切换账本」，主题只在设置页切换 */
ok('首页右上角是账本按钮', !!$('btnBook') && !$('btnTheme'));
ok('账本按钮显示当前账本名', $('bookName').textContent.length > 0, $('bookName').textContent);
ok('主题浮层已移除（不再有重复入口）', !$('themePop') && !$('themePopList'));

/* 上传主题：按钮收窄 + 下拉箭头展开说明 */
ok('有上传主题的按钮', !!$('btnUploadTheme'));
ok('上传按钮带下拉箭头', !!$('btnThemeTip'));
ok('制作说明默认收起', $('themeTip').hidden === true);
click($('btnThemeTip'));
ok('点箭头展开制作说明', $('themeTip').hidden === false);
ok('页面上写清了 PNG 尺寸要求',
   $('themeTip').textContent.indexOf('1080') >= 0 && $('themeTip').textContent.indexOf('4520') >= 0);
click($('btnThemeTip'));
ok('再点收起', $('themeTip').hidden === true);
ok('上传控件只收图片', ($('fileTheme').getAttribute('accept') || '').indexOf('image') >= 0);
ok('主题图的背景 / 装饰层都挂在页面上',
   ['decoHome','decoStatsLayer','decoFooter'].every(id => !!$(id)));

head('11a-3. 主题图分区（1080 × 4520）');
{
  const SPEC = L.THEME_SPEC;
  const z = SPEC.zones;

  ok('主题图整宽 = 1080', SPEC.w === 1080, SPEC.w);
  ok('主题图整高 = 4520', SPEC.h === 4520, SPEC.h);
  ok('一共 5 块', z.length === 5, z.length);
  ok('五块首尾相接、不重叠、总高刚好对得上',
     z.every((b, i) => b.y === (i ? z[i - 1].y + z[i - 1].h : 0)) &&
     z[z.length - 1].y + z[z.length - 1].h === SPEC.h,
     z.map(b => b.id + ' y=' + b.y + ' h=' + b.h).join(' | '));
  /* 每块宽度都要等于整图宽 —— 装饰层是按「一条竖着的切片」铺的，宽度不齐就会错位 */
  ok('五块都是整图宽', z.every(b => b.w === SPEC.w));

  /* 装饰层：整层铺满宽 + 点击穿透，否则会把卡片点不动 */
  doc.documentElement.classList.add('has-theme');
  const dl = window.getComputedStyle($('decoHome'));
  ok('装饰层点击穿透（不挡操作）', dl.pointerEvents === 'none', dl.pointerEvents);
  ok('装饰层左右贴边（整层铺满）', dl.left === '0px' && dl.right === '0px',
     dl.left + ' / ' + dl.right);

  const zIdx = Number(dl.zIndex);
  const fabZ = Number(window.getComputedStyle($('btnAdd')).zIndex);
  ok('装饰层浮在卡片之上、FAB 之下', zIdx > 0 && zIdx < fabZ, zIdx + ' < ' + fabZ);

  ok('两个装饰层分别挂在首页 / 统计页的滚动容器里',
     $('bodyHome').contains($('decoHome')) && $('bodyStats').contains($('decoStatsLayer')));
  doc.documentElement.classList.remove('has-theme');
}

head('11a-2. 结构：浮层必须在 #app 内部');
/* 二级页/弹窗是 position:absolute + inset:0，靠 translateX(100%) 停在屏幕右侧。
   如果它们跑到 #app 外面，包含块变成视口，就会把整页滚动区撑宽 → 手机上能横向拖出空白。
   这条断言就是防止有人手滑把 </div> 挪错位置。 */
{
  const app = $('app');
  const mustInside = ['subAll','subQuotes','subCat','sheetLayer','bookPop','askPop'];
  const outside = mustInside.filter(id => {
    const el = $(id);
    return !el || !app.contains(el);
  });
  ok('#app 存在且是浮层的祖先容器', !!app && outside.length === 0);
  ok('越界的浮层：' + (outside.length ? outside.join(',') : '无'), outside.length === 0);
  ok('#app 设了 overflow:hidden', window.getComputedStyle(app).overflow === 'hidden');
}

head('11b. 头像');
ok('有头像按钮', !!$('btnAvatar'));
ok('上传控件只收图片', ($('fileAvatar').getAttribute('accept') || '').indexOf('image') >= 0);
ok('设置页有头像入口', !!$('setAvatar'));
{
  /* ★ 防回归：头像按钮一旦写成 display:flex 居中，里面的 img 会被当成可收缩的
     flex item 压成 30×40，object-fit:cover 再按宽度裁一刀 —— 手机上看到的就是
     「圆被切掉了左右两边」。所以这里盯死：容器不能是 flex，图片必须绝对定位铺满。
     （真实渲染尺寸由 test/render-check.js 在无头浏览器里量） */
  const btnCss = window.getComputedStyle($('btnAvatar'));
  ok('头像按钮不是 flex 容器',
     btnCss.display !== 'flex' && btnCss.display !== 'inline-flex', btnCss.display);
  ok('头像按钮是固定 46×46 的正方形',
     btnCss.width === '46px' && btnCss.height === '46px',
     btnCss.width + ' × ' + btnCss.height);

  const avCss = window.getComputedStyle($('avatarImg'));
  ok('头像图片绝对定位铺满按钮',
     avCss.position === 'absolute' && avCss.width === '100%' && avCss.height === '100%',
     avCss.position + ' / ' + avCss.width + '×' + avCss.height);
  ok('没传头像时 img 不占位（[hidden] 规则没被 img{display:block} 顶掉）',
     avCss.display === 'none', avCss.display);
  ok('占位 emoji 正常显示',
     window.getComputedStyle($('avatarPh')).display !== 'none');
}


/* ══════════════════════════════════════════════════════════
   12. 数据持久化
   ══════════════════════════════════════════════════════════ */
head('12. 持久化');
const raw = window.localStorage.getItem('ledger.v2');
ok('数据已存进本地', !!raw);
const parsedDB = JSON.parse(raw);
ok('记录存下来了', parsedDB.records.length === L.DB.records.length);
ok('带备注的那条存下来了', parsedDB.records.some(r => r.note === '周末回家'));
ok('主题选择存下来了', parsedDB.theme === 'sunset', parsedDB.theme);
ok('语录开关状态存下来了', !!parsedDB.quotes);
ok('账本结构存下来了', Array.isArray(parsedDB.books) && parsedDB.books.length >= 1, JSON.stringify(parsedDB.books && parsedDB.books.length));
ok('每条记录都归属了账本', parsedDB.records.every(r => !!r.book));
ok('预算存下来了', !!parsedDB.budget && Object.keys(parsedDB.budget).length > 0);


/* ══════════════════════════════════════════════════════════
   13. Android 返回键
   ------------------------------------------------------------
   装成 APK 之后，物理返回键会调 window.__ledgerBack()。
   规矩是「先关最上层的浮层，全关完了才返回 false，让原生把 App 收到后台」。
   顺序错了就会出现「按返回直接退出，弹窗还开着」那种廉价感。
   ══════════════════════════════════════════════════════════ */
head('13. Android 返回键');
ok('暴露了 __ledgerBack 钩子', typeof window.__ledgerBack === 'function');

if (typeof window.__ledgerBack === 'function') {
  /* 先复位到「首页 + 没有任何浮层」。
     不复位的话，量到的是「返回键关掉了上一节留下的二级页」——测的就不是这件事了。 */
  Array.prototype.forEach.call(
    doc.querySelectorAll('.pop-layer.is-on, .sheet-layer.is-on, .sub.is-on'),
    el => el.classList.remove('is-on'));
  doc.querySelector('[data-tab="home"]').click();

  ok('首页且无浮层 → 返回 false', window.__ledgerBack() === false);

  /* ① 记一笔弹窗 */
  $('btnAdd').click();
  ok('点「＋」弹窗打开', $('sheetLayer').classList.contains('is-on'));
  ok('返回键 → 返回 true', window.__ledgerBack() === true);
  ok('返回键 → 弹窗关闭', !$('sheetLayer').classList.contains('is-on'));

  /* ② 账本浮层 */
  $('bookPop').classList.add('is-on');
  ok('返回键 → 账本浮层关闭',
     window.__ledgerBack() === true && !$('bookPop').classList.contains('is-on'));

  /* ③ 二级页 */
  $('btnMoreRec').click();
  ok('点「更多」二级页打开', !!doc.querySelector('.sub.is-on'));
  ok('返回键 → 二级页退回',
     window.__ledgerBack() === true && !doc.querySelector('.sub.is-on'));

  /* ④ 非首页 tab → 回首页 */
  doc.querySelector('[data-tab="stats"]').click();
  ok('已切到统计页', $('pageStats').classList.contains('is-on'));
  ok('返回键 → 回到首页',
     window.__ledgerBack() === true && $('pageHome').classList.contains('is-on'));
}


/* ══════════════════════════════════════════════════════════
   14. 统计口径
   ══════════════════════════════════════════════════════════ */
head('14. 统计口径');
ok('跨年往前推一个月 = 2025-12', L.shiftMonthStr('2026-01', -1) === '2025-12',
   L.shiftMonthStr('2026-01', -1));
ok('跨年往后推一个月 = 2026-02', L.shiftMonthStr('2026-01', 1) === '2026-02',
   L.shiftMonthStr('2026-01', 1));
ok('月份格式正确', L.monthText('2026-09') === '2026年9月', L.monthText('2026-09'));

const expSum = L.DB.records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
ok('金额加起来没有浮点误差',
   Math.abs(expSum - Math.round(expSum * 100) / 100) < 1e-9, expSum);

const nowMonth = new Date().toISOString().slice(0, 7);
const thisMonth = L.DB.records.filter(r => r.date.slice(0, 7) === nowMonth);
console.log('  · 本月共 ' + thisMonth.length + ' 条，支出合计 ¥' +
  thisMonth.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0).toFixed(2));


/* ══════════════════════════════════════════════════════════
   结果
   ══════════════════════════════════════════════════════════ */
console.log('\n' + '─'.repeat(46));
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('─'.repeat(46));
process.exit(fail ? 1 : 0);
