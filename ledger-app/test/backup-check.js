/* ============================================================
   备份 / 恢复 三条通道专项测试
   ------------------------------------------------------------
   背景：
     WebView 里 Blob + <a download> 完全不生效（点了没反应也不报错），
     所以 Android 壳必须提供原生落盘能力；网页侧要能识别并切换到原生通道。
     另外为了「不传文件也能搬数据」，新增了复制 / 粘贴这条通道。

   覆盖：
   ① 备份结构（backupPayload）合法且完整
   ② mergeBackup 合并语义（按 id 去重、不丢、补归属）
   ③ 粘贴导入 importFromText（合法 / 非法文本）
   ④ 设置页入口与浮层交互
   ⑤ exportData 通道选择：有 LedgerNative 走原生 / 没有则走下载
   ⑥ 原生回调 __ledgerExportDone
   ⑦ 备份文件落点：路径记忆、原生选择器、打开文件夹
   ⑧ 壳把选中的备份文件读成文本后回调 __ledgerImportText

   跑法：node test/backup-check.js
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

window.confirm = () => true;
try{ window.localStorage.clear(); }catch(e){}
window.eval(rd('quotes.js') + '\n' + rd('app.js'));
const L = window.__ledger;

/* ══════════════════════════════════════════════════════════
   ① 备份结构
   ══════════════════════════════════════════════════════════ */
head('① 备份结构');

const payload = L.backupPayload();
let parsed = null;
try{ parsed = JSON.parse(payload); }catch(e){}
ok('backupPayload 是合法 JSON', parsed !== null);
ok('含 records 数组', parsed && Array.isArray(parsed.records));
ok('含 books 数组', parsed && Array.isArray(parsed.books));
ok('含 budget 对象', parsed && parsed.budget && typeof parsed.budget === 'object');
ok('含 curBook', parsed && typeof parsed.curBook === 'string' && parsed.curBook);
ok('带版本号与导出时间', parsed && parsed.v === 3 && typeof parsed.exportedAt === 'string');
ok('带 theme', parsed && typeof parsed.theme === 'string');

/* ══════════════════════════════════════════════════════════
   ② mergeBackup 合并语义
   ══════════════════════════════════════════════════════════ */
head('② 合并导入语义');

const baseCount = L.DB.records.length;

// 新记录 → 应该被追加
const bak1 = {
  v:3, records:[
    { id:'t-in-1', date:'2026-01-05', type:'expense', amount:1000, cat:'餐饮', title:'测试甲', ts:1 },
    { id:'t-in-2', date:'2026-01-06', type:'income',  amount:5000, cat:'工资', title:'测试乙', ts:2 }
  ],
  books:[{ id:'t-book', name:'测试账本', kind:'daily', icon:'📗' }],
  budget:{ '2026-01': 100000 },
  curBook:'t-book',
  quotes:{ off:[], custom:[{ text:'测试语录' }] }
};
const n1 = L.mergeBackup(JSON.parse(JSON.stringify(bak1)));
ok('导入条数返回正确', n1 === 2, n1);
ok('新记录被加入', L.DB.records.length === baseCount + 2, L.DB.records.length);
ok('新记录类目保留', (L.DB.records.find(r => r.id === 't-in-1') || {}).cat === '餐饮');
ok('新账本被加入', L.DB.books.some(b => b.id === 't-book'));
ok('未标账本的记录归到备份声明的当前账本',
   (L.DB.records.find(r => r.id === 't-in-1') || {}).book === 't-book',
   (L.DB.records.find(r => r.id === 't-in-1') || {}).book);
ok('预算被合并', L.DB.budget['2026-01'] === 100000);
ok('语录被合并', L.DB.quotes.custom.some(q => q.text === '测试语录'));

// 记录自己标了账本 → 必须保留原归属，不能被改成当前账本
L.mergeBackup({ v:3, records:[
  { id:'t-keep', date:'2026-01-07', type:'expense', amount:100, cat:'餐饮', book:'main', ts:4 }
], curBook:'t-book' });
ok('记录自带账本时保留原归属',
   (L.DB.records.find(r => r.id === 't-keep') || {}).book === 'main',
   (L.DB.records.find(r => r.id === 't-keep') || {}).book);

// 同一个包再导一次 → 不应该重复
const afterAll = L.DB.records.length;
L.mergeBackup(JSON.parse(JSON.stringify(bak1)));
ok('重复导入不产生重复记录', L.DB.records.length === afterAll, L.DB.records.length);
ok('重复导入不产生重复账本', L.DB.books.filter(b => b.id === 't-book').length === 1);
ok('重复导入不产生重复语录', L.DB.quotes.custom.filter(q => q.text === '测试语录').length === 1);

// 内含同 id 的记录 → 以导入的为准，数量不变
const bak2 = { v:3, records:[{ id:'t-in-1', date:'2026-02-01', type:'expense', amount:9999, cat:'交通', ts:3 }] };
L.mergeBackup(bak2);
ok('同 id 记录按导入包更新', (L.DB.records.find(r => r.id === 't-in-1') || {}).amount === 9999);

const before = L.DB.records.length;
let threw = false;
try{ L.mergeBackup({ v:3 }); }catch(e){ threw = true; }
ok('缺 records 的包会被拒绝', threw);
ok('拒绝时不动数据', L.DB.records.length === before);

/* ══════════════════════════════════════════════════════════
   ③ 粘贴导入
   ══════════════════════════════════════════════════════════ */
head('③ 粘贴导入');

const nPaste = L.DB.records.length;
L.importFromText(JSON.stringify({ v:3, records:[
  { id:'t-paste-1', date:'2026-03-01', type:'expense', amount:2000, cat:'购物', title:'粘贴来的', ts:9 }
]}));
ok('合法文本能导入', L.DB.records.some(r => r.id === 't-paste-1'));
ok('导入后条数 +1', L.DB.records.length === nPaste + 1, L.DB.records.length);

const nBad = L.DB.records.length;
L.importFromText('这不是备份内容是随便打的字');
ok('乱文本不写库', L.DB.records.length === nBad);
L.importFromText('');
ok('空文本不写库', L.DB.records.length === nBad);
L.importFromText(null);
ok('null 不写库', L.DB.records.length === nBad);
L.importFromText('   \n  ' + JSON.stringify({ v:3, records:[{ id:'t-paste-2', date:'2026-03-02', type:'expense', amount:300, ts:10 }] }) + '  \n ');
ok('前后带空白也能导入', L.DB.records.some(r => r.id === 't-paste-2'));

/* ══════════════════════════════════════════════════════════
   ④ 设置页入口与浮层
   ══════════════════════════════════════════════════════════ */
head('④ 设置页入口与浮层');

ok('设置页有「备份文本」入口', !!$('setBackupText'));
ok('备份文本浮层存在', !!$('backupPop'));
ok('复制按钮存在', !!$('backupCopy'));
ok('粘贴框存在', !!$('backupPaste'));
ok('导入按钮存在', !!$('backupImport'));
ok('浮层默认不显示', !$('backupPop').classList.contains('is-on'));

click($('setBackupText'));
ok('点入口后浮层打开', $('backupPop').classList.contains('is-on'));

click($('backupPop').querySelector('[data-pop-close]'));
ok('点 ✕ 后浮层关闭', !$('backupPop').classList.contains('is-on'));

// 走一遍「粘进去 → 点导入」
click($('setBackupText'));
$('backupPaste').value = JSON.stringify({ v:3, records:[
  { id:'t-ui-1', date:'2026-04-01', type:'expense', amount:1200, ts:11 }
]});
click($('backupImport'));
ok('界面按钮能完成导入', L.DB.records.some(r => r.id === 't-ui-1'));
ok('导入后浮层自动关闭', !$('backupPop').classList.contains('is-on'));

// 复制通道：优先走剪贴板 API
let clipText = null;
try{
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText(t){ clipText = t; return Promise.resolve(); } }
  });
}catch(e){}
let copyThrew = false;
try{ click($('backupCopy')); }catch(e){ copyThrew = true; }
ok('点复制不报错', !copyThrew);
let clipJson = null;
try{ clipJson = JSON.parse(clipText); }catch(e){}
ok('复制进剪贴板的是合法备份 JSON',
   clipJson && Array.isArray(clipJson.records) && clipJson.records.length > 0,
   String(clipText).slice(0, 50));

// 剪贴板被禁用时，退回老式 execCommand
let execUsed = false;
try{
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
}catch(e){}
doc.execCommand = () => { execUsed = true; return true; };
let fallbackThrew = false;
try{ click($('backupCopy')); }catch(e){ fallbackThrew = true; }
ok('剪贴板不可用时不报错', !fallbackThrew);
ok('剪贴板不可用时退回 execCommand', execUsed);

/* ══════════════════════════════════════════════════════════
   ⑤ exportData 通道选择
   ══════════════════════════════════════════════════════════ */
head('⑤ 导出通道选择');

// —— 无原生桥：应走浏览器下载 ——
window.URL.createObjectURL = () => 'blob:mock';   // jsdom 不实现 Blob URL，补个假的
window.URL.revokeObjectURL = () => {};
let downloadHit = null;
const origCreate = doc.createElement.bind(doc);
doc.createElement = function(tag){
  const el = origCreate(tag);
  if(String(tag).toLowerCase() === 'a'){
    el.click = function(){ downloadHit = el.download; };
  }
  return el;
};
L.exportData();
ok('浏览器环境走下载', downloadHit && /^记账备份_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(downloadHit), downloadHit);

// —— 有原生桥：应交给原生，且不触发下载 ——
downloadHit = null;
let nativeGot = null;
window.LedgerNative = {
  setStatusBar(){},
  platform(){ return 'android'; },
  saveBackup(json, name){ nativeGot = { json, name }; }
};
L.exportData();
ok('安卓环境走原生', nativeGot !== null);
ok('原生拿到文件名', nativeGot && /^记账备份_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(nativeGot.name), nativeGot && nativeGot.name);
ok('安卓环境不触发浏览器下载', downloadHit === null);
let nativeJson = null;
try{ nativeJson = JSON.parse(nativeGot.json); }catch(e){}
ok('原生拿到完整备份内容', nativeJson && Array.isArray(nativeJson.records) && nativeJson.records.length > 0);

doc.createElement = origCreate;
delete window.LedgerNative;

/* ══════════════════════════════════════════════════════════
   ⑥ 原生完成后回调网页
   ══════════════════════════════════════════════════════════ */
head('⑥ 原生完成回调');

ok('__ledgerExportDone 已挂到 window', typeof window.__ledgerExportDone === 'function');
let doneThrew = false;
try{
  window.__ledgerExportDone(true, '下载/记账备份_2026-09-20.json');
  window.__ledgerExportDone(false, '磁盘满了');
}catch(e){ doneThrew = true; }
ok('成功 / 失败两种回调都不报错', !doneThrew);
ok('回调后提示条有内容', $('toast') && $('toast').textContent.length > 0, $('toast') && $('toast').textContent);

/* ══════════════════════════════════════════════════════════
   ⑦ 备份文件的落点：路径记忆 + 原生选择器 + 打开文件夹
   ----------------------------------------------------------
   要解决的问题：导出的文件必须能"被找到"。
   做法：落点固定 + 文件带时分 + 把上次路径记下来常驻设置页。
   ══════════════════════════════════════════════════════════ */
head('⑦ 备份文件落点与定位');

ok('文件名带时分（连点两次不会重名）',
   /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(L.backupStamp()), L.backupStamp());

window.localStorage.removeItem(L.LAST_BACKUP_KEY);
L.rememberBackupPath('下载/记账本/记账备份_2026-09-20_1730.json');
const last = L.lastBackup();
ok('记下了上次导出路径', last && last.path === '下载/记账本/记账备份_2026-09-20_1730.json', JSON.stringify(last));
ok('能从路径推出所在文件夹', last && last.dir === '下载/记账本/', last && last.dir);
ok('设置页副标题显示「上次存到 …」',
   /上次存到 下载\/记账本\//.test($('setExportVal').textContent), $('setExportVal').textContent);
ok('「打开备份文件夹」那行显示文件夹',
   $('setFolderVal').textContent.trim() === '下载/记账本/', $('setFolderVal').textContent);

// Android 9 及以下走的是 App 外部目录，是反斜杠绝对路径，也要能推出文件夹
L.rememberBackupPath('C:\\Android\\data\\com.shouhu.ledger\\files\\Download\\记账本\\记账备份_x.json');
ok('反斜杠绝对路径也能推出文件夹',
   L.lastBackup().dir === 'C:\\Android\\data\\com.shouhu.ledger\\files\\Download\\记账本\\',
   L.lastBackup().dir);

// 壳里点「导入恢复」→ 走原生选择器（一打开就停在备份文件夹）
L.rememberBackupPath('下载/记账本/记账备份_2026-09-20_1730.json');
let picked = 0, folderOpened = 0;
window.LedgerNative = {
  setStatusBar(){}, platform(){ return 'android'; },
  pickBackup(){ picked++; },
  openBackupFolder(){ folderOpened++; }
};
click($('setImport'));
ok('点「导入恢复」→ 调原生选择器', picked === 1, 'picked=' + picked);
click($('setOpenFolder'));
ok('点「打开备份文件夹」→ 调原生打开', folderOpened === 1, 'folderOpened=' + folderOpened);

// 浏览器里没有原生桥 → 必须优雅退回
let fileInputClicked = 0;
$('fileImport').click = () => { fileInputClicked++; };
delete window.LedgerNative;
click($('setImport'));
ok('浏览器里退回 <input type=file>', fileInputClicked === 1, 'clicks=' + fileInputClicked);
let folderThrew = false;
try{ click($('setOpenFolder')); }catch(e){ folderThrew = true; }
ok('浏览器里点「打开备份文件夹」不报错（只给文案）', !folderThrew);

/* ══════════════════════════════════════════════════════════
   ⑧ 壳把选中的备份文件读成文本后回调
   ══════════════════════════════════════════════════════════ */
head('⑧ 壳读取文件后回调');

ok('__ledgerImportText 已挂到 window', typeof window.__ledgerImportText === 'function');
const beforeCount = L.DB.records.length;
const bakText     = L.backupPayload();
L.DB.records = L.DB.records.slice(0, Math.max(1, beforeCount - 1));   // 先删一条，导入后应补回
window.__ledgerImportText(bakText);
ok('导入后记录数回到原值', L.DB.records.length === beforeCount,
   L.DB.records.length + ' vs ' + beforeCount);

window.__ledgerImportText('这不是 json');
ok('选了非备份文件 → 提示「不是记账本导出的备份」',
   /不是记账本导出的备份/.test($('toast').textContent), $('toast').textContent);

let failThrew = false;
try{ window.__ledgerImportFail('被系统拦了'); }catch(e){ failThrew = true; }
ok('读取失败回调不报错且有提示',
   !failThrew && /读不了这个文件/.test($('toast').textContent), $('toast').textContent);

let cancelThrew = false;
try{ window.__ledgerImportCancel(); }catch(e){ cancelThrew = true; }
ok('用户取消回调不报错', !cancelThrew);

/* ══════════════════════════════════════════════════════════ */
setTimeout(() => {
  console.log('\n──────────────────────────────────────────────');
  console.log(fail === 0 ? '全部通过：' + pass + ' 项' : ('通过 ' + pass + ' 项，失败 ' + fail + ' 项'));
  console.log('──────────────────────────────────────────────');
  process.exit(fail === 0 ? 0 : 1);
}, 30);
