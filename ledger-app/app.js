/* ============================================================
   记一笔 · 逻辑
   ------------------------------------------------------------
   想改分类       → ① CATS
   想改自动识别   → ② KEYWORDS（决定「火车票」算哪一类）
   想改内置主题   → ③ THEMES
   想改存储       → ④ Store
   想改激励语     → 打开 quotes.js，直接在数组里加
   其余是界面渲染，一般不用动
   ============================================================ */


/* ────────────────────────────────────────────────────────────
   ① 分类定义
   k = 内部代号（改了历史账就认不出来，别动）
   n = 显示名字   i = 图标（emoji）   c = 这个分类的颜色
   ──────────────────────────────────────────────────────────── */
const CATS = {
  expense: [
    { k:'food',    n:'餐饮', i:'🍚', c:'#f59e0b' },
    { k:'traffic', n:'交通', i:'🚇', c:'#3b82f6' },
    { k:'home',    n:'居住', i:'🏠', c:'#8b5cf6' },
    { k:'shop',    n:'购物', i:'🛍️', c:'#ec4899' },
    { k:'fun',     n:'文娱', i:'🎬', c:'#06b6d4' },
    { k:'travel',  n:'旅游', i:'✈️', c:'#0d9488' },
    { k:'social',  n:'人情', i:'🎁', c:'#ef4444' },
    { k:'medical', n:'医疗', i:'💊', c:'#10b981' },
    { k:'pet',     n:'宠物', i:'🐱', c:'#b45309' },
    { k:'other',   n:'其他', i:'📦', c:'#94a3b8' }
  ],
  income: [
    { k:'salary',  n:'工资', i:'💰', c:'#16a34a' },
    { k:'refund',  n:'退款', i:'↩️', c:'#0ea5e9' },
    { k:'otherin', n:'其他', i:'✨', c:'#8b5cf6' }
  ]
};


/* ────────────────────────────────────────────────────────────
   ② 自动识别：看到这些词，就归到这类
   规则：从上往下找，谁先命中算谁的。所以越具体的放越上面。
        例：电竞酒店 → 先命中 fun 的「电竞」，所以算文娱。
   ──────────────────────────────────────────────────────────── */
const KEYWORDS = {
  expense: [
    /* 宠物要放在医疗前面：「宠物医院」含「医院」，先命中才算宠物 */
    { k:'pet',     w:['宠物','猫条','猫粮','狗粮','猫砂','猫抓板','猫窝','狗窝','逗猫棒','猫玩具','狗玩具','猫草','冻干','猫零食','狗零食','宠物店','宠物医院','猫砂盆','自动喂食','撸猫','吸猫','遛狗','狗绳','猫笼','航空箱'] },
    { k:'social',  w:['红包','份子','随礼','礼金','送礼','礼物','贺礼','伴手礼','压岁','人情'] },
    { k:'medical', w:['医疗','医院','挂号','看病','就诊','门诊','急诊','体检','药店','买药','药费','住院','口腔','牙科','洗牙','眼科','疫苗','推拿','针灸','康复'] },
    { k:'fun',     w:['电影','观影','演唱会','音乐会','livehouse','音乐节','话剧','展览','漫展','演出','球赛','游戏','点券','皮肤','月卡','KTV','唱歌','密室','剧本杀','桌游','网吧','台球','电竞','酒吧','周深','快闪','视频会员','文娱'] },
    { k:'travel',  w:['旅游','旅行','度假','酒店','民宿','青旅','客栈','住宿','景区','景点','门票','跟团','签证','护照','机票','航班','机场','导游','露营','滑雪','出海','迪士尼','环球影城','乐园'] },
    { k:'traffic', w:['交通','地铁','公交','打车','滴滴','出租','网约车','加油','油费','停车','过路','高速','车票','火车票','高铁','动车','单车','骑行','修车','保养','洗车','违章','罚款','ETC','年检','驾照','轮胎','前胎'] },
    { k:'home',    w:['居住','住房','房贷','房租','物业','水费','电费','燃气','天然气','取暖','暖气','宽带','网费','话费','家政','保洁','维修','家具','床品','被褥'] },
    { k:'shop',    w:['购物','淘宝','天猫','京东','拼多多','网购','快递','日用品','日用','洗发','沐浴','纸巾','抽纸','衣服','服装','鞋','外套','裤子','裙子','化妆品','护肤','面膜','口红','数码','手机','耳机','电脑','显示器','家电','冰箱','洗衣机','收纳','文具'] },
    { k:'food',    w:['餐饮','早餐','早饭','午餐','午饭','晚餐','晚饭','夜宵','宵夜','外卖','吃饭','聚餐','火锅','烧烤','烤肉','快餐','麦当劳','肯德基','星巴克','瑞幸','奶茶','咖啡','沙县','麻辣烫','面馆','食堂','菜市场','买菜','水果','零食','饮料','早点','下午茶','自助餐','日料','寿司','汉堡','披萨','米线','小吃','面包'] }
  ],
  income: [
    { k:'salary', w:['工资','薪水','薪酬','月薪','发薪','年终奖','奖金','津贴','补贴','底薪'] },
    { k:'refund', w:['退款','退钱','退货','报销','返还','退回'] }
  ]
};


/* ────────────────────────────────────────────────────────────
   ③ 内置主题
   ------------------------------------------------------------
   加一套主题：照抄一行，改名字和两个颜色即可。
   自制主题（上传 PNG）不在这里，在 App 里操作。
   ──────────────────────────────────────────────────────────── */
const THEMES = [
  { id:'ocean',   n:'海洋', a:'#7cc7ef', b:'#c3e7fa' },
  { id:'sunset',  n:'日落', a:'#f6a97e', b:'#fbd9c4' },
  { id:'forest',  n:'森林', a:'#78bd8d', b:'#c8e6d1' },
  { id:'starry',  n:'星空', a:'#4b4b9e', b:'#8f8fd6' },
  { id:'minimal', n:'简约', a:'#8a94a6', b:'#c9d1db' }
];

/* 自制主题图的约定（改这里的话，style.css 第 ⑤ 节的坐标也要一起改） */
const THEME_SPEC = {
  w: 1080, h: 4520,
  /* 分区表：一张 PNG 分 5 块。改这里 = 改契约，style.css 里的坐标要一起改 */
  zones: [
    { id:'①', name:'首页顶栏',   x:0, y:0,    w:1080, h:200,  note:'头像 / 问候语 / 主题按钮那一行' },
    { id:'②', name:'统计顶栏',   x:0, y:200,  w:1080, h:560,  note:'月份条 + 支出收入 + 总额' },
    { id:'③', name:'底部栏',     x:0, y:760,  w:1080, h:160,  note:'底部 Tab 栏整条' },
    { id:'④', name:'首页装饰层', x:0, y:920,  w:1080, h:1800, note:'透明底，整层浮在首页内容上方，随便画' },
    { id:'⑤', name:'统计装饰层', x:0, y:2720, w:1080, h:1800, note:'透明底，整层浮在统计页内容上方' },
  ]
};


/* ────────────────────────────────────────────────────────────
   ④ 把「火车票 331元」这样一句话，拆成 金额 / 事项 / 分类
   ──────────────────────────────────────────────────────────── */
const NUM = '\\d+(?:\\.\\d+)?';

function parseEntry(text){
  const raw = String(text == null ? '' : text).trim();
  if(!raw) return { amount: null, title: '', cat: null };

  // 1) 先找带单位的金额：「¥331」「331元」「331 块」，这种最不含糊
  const unit = raw.match(new RegExp('[¥￥]\\s*(' + NUM + ')'))
            || raw.match(new RegExp('(' + NUM + ')\\s*(?:元|块钱|块|圆)'));

  // 2) 没有单位就取最后一个数字（「9.25青旅33」→ 33，金额一般写在后面）
  const all = raw.match(new RegExp(NUM, 'g')) || [];
  const hit = unit ? unit[1] : (all.length ? all[all.length - 1] : null);

  let title = raw;
  let amount = null;

  if(hit !== null){
    const v = Math.round(parseFloat(hit) * 100) / 100;
    if(v > 0) amount = v;
    if(unit){
      title = raw.replace(unit[0], ' ');
    }else{
      const re = new RegExp('(^|[^\\d.])' + hit.replace(/\./g, '\\.') + '(?![\\d.])');
      title = raw.replace(re, '$1 ');
    }
  }

  title = cleanTitle(title);
  return { amount, title, cat: guessCat(title, 'expense') };
}

function cleanTitle(s){
  return String(s)
    .replace(/[¥￥]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ ,，、/|·\-—~:：.]+/, '')
    .replace(/[ ,，、/|·\-—~:：.]+$/, '')
    .trim();
}

function guessCat(text, type){
  // 统一转小写再匹配：这样「etc」「Etc」也能命中「ETC → 交通」
  const s = String(text == null ? '' : text).toLowerCase();
  if(!s) return null;
  const rules = KEYWORDS[type] || [];
  for(let i = 0; i < rules.length; i++){
    const w = rules[i].w;
    for(let j = 0; j < w.length; j++){
      if(s.indexOf(w[j].toLowerCase()) >= 0) return rules[i].k;
    }
  }
  return null;
}


/* ────────────────────────────────────────────────────────────
   ⑤ 存储层 —— 想换存储方式，只改这两个函数
   ★ [套壳时改这里] Android 版会把 localStorage 换成原生文件读写
   ──────────────────────────────────────────────────────────── */
const Store = {
  KEY: 'ledger.v2',
  OLD: 'ledger.v1',

  load(){
    let d = null;
    try{ d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); }catch(e){}

    // 从旧版本搬数据（老版本只存了 records）
    if(!d){
      let old = null;
      try{ old = JSON.parse(localStorage.getItem(this.OLD) || 'null'); }catch(e){}
      d = {
        v: 2,
        seeded: old ? !!old.seeded : false,
        records: (old && old.records) || [],
        theme: 'ocean',
        avatar: '',
        quotes: { off: [], custom: [] }
      };
    }

    d.records = Array.isArray(d.records) ? d.records : [];
    d.quotes  = d.quotes && typeof d.quotes === 'object' ? d.quotes : { off:[], custom:[] };
    d.quotes.off    = Array.isArray(d.quotes.off)    ? d.quotes.off    : [];
    d.quotes.custom = Array.isArray(d.quotes.custom) ? d.quotes.custom : [];
    if(!d.theme) d.theme = 'ocean';

    // —— 账本（多本账）：老数据没有账本就建一本「日常账本」，记录全部归进去 ——
    if(!Array.isArray(d.books) || !d.books.length){
      d.books = [{ id:'main', name:'日常账本', note:'', kind:'daily' }];
    }
    if(!d.curBook || !d.books.some(b => b.id === d.curBook)) d.curBook = d.books[0].id;
    d.books.forEach(b => { if(!b.icon) b.icon = (b.kind === 'pool' ? '🧮' : '📘'); });
    const defId = d.books[0].id;
    d.records.forEach(r => {
      if(!r.book || !d.books.some(b => b.id === r.book)) r.book = defId;
    });
    // —— 每月支出预算：{ '2026-09': 3000 } ——
    if(!d.budget || typeof d.budget !== 'object' || Array.isArray(d.budget)) d.budget = {};

    return d;
  },

  save(){
    try{
      localStorage.setItem(this.KEY, JSON.stringify(DB));
    }catch(e){
      toast('保存失败：手机存储空间可能满了');
    }
  },

  // 主题图 / 头像单独存，避免和主数据挤在一起
  put(k, v){
    try{ localStorage.setItem('ledger.img.' + k, v); return true; }
    catch(e){ return false; }
  },
  get(k){ return localStorage.getItem('ledger.img.' + k) || ''; },
  del(k){ try{ localStorage.removeItem('ledger.img.' + k); }catch(e){} }
};


/* ────────────────────────────────────────────────────────────
   ⑥ 小工具
   ──────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => ymd(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

/* 金额位数多时给元素挂 data-len，CSS 据此自动降字号，防止长数字挤出卡片 */
function fitNum(el){
  const n = (el.textContent || '').length;
  el.dataset.len = n >= 12 ? 'xlong' : n >= 9 ? 'long' : '';
}

/* —— 账本 —— */
function curBook(){
  return DB.books.find(b => b.id === DB.curBook) || DB.books[0];
}
function isPoolBook(){
  return curBook().kind === 'pool';
}

/* 账本可选图标（新建/编辑时挑一个） */
const BOOK_ICONS = ['📘','💰','🏠','🚗','✈️','🐱','🐕','👶','💼','🧮','💎','🎯','🎁','🏥','🎓','🧾'];
const bookIcon = b => b.icon || (b.kind === 'pool' ? '🧮' : '📘');
/* 当前账本的记录（所有页面取数都走这里，不直接用 DB.records） */
function bookRecs(){
  return DB.records.filter(r => r.book === curBook().id);
}
/* 排序：日期新的在前，同一天按记账时间 */
function byRecOrder(a, b){
  return b.date > a.date ? 1 : b.date < a.date ? -1 : (b.ts || 0) - (a.ts || 0);
}

function fmt(n){
  return (Math.round(n * 100) / 100)
    .toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// 图表里用的短数字：1234.5 → 1235，0.5 → 0.5
function fmtShort(n){
  if(n >= 10000) return (n / 10000).toFixed(1) + '万';
  if(n >= 1000)  return Math.round(n) + '';
  if(n >= 100)   return Math.round(n) + '';
  return (Math.round(n * 10) / 10) + '';
}
const monthOf = dateStr => String(dateStr).slice(0, 7);
const curMonthStr = () => todayStr().slice(0, 7);

function monthText(m){
  const [y, mm] = m.split('-').map(Number);
  return y + '年' + mm + '月';
}
function shiftMonthStr(m, delta){
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}
function findCat(type, k){
  return (CATS[type] || []).find(c => c.k === k) || null;
}
function dayLabel(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  const md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  if(dateStr === todayStr()) return '今天 · ' + md;
  return md + ' 周' + w;
}
function dateText(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const md = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return ymd(x); };
  if(dateStr === todayStr()) return '今天 · ' + md;
  if(dateStr === back(1))    return '昨天 · ' + md;
  if(dateStr === back(2))    return '前天 · ' + md;
  if(d.getFullYear() !== new Date().getFullYear()) return d.getFullYear() + '年' + md;
  return md;
}
// 按本地时间给不同的问候
function greetWord(){
  const h = new Date().getHours();
  if(h >= 6  && h <= 10) return '早上好！';
  if(h >= 11 && h <= 13) return '中午好！';
  if(h >= 14 && h <= 17) return '下午好！';
  return '晚上好！';               // 18:00 ~ 次日 05:59
}


/* ────────────────────────────────────────────────────────────
   ⑦ 状态
   ──────────────────────────────────────────────────────────── */
let DB = null;
let curTab    = 'home';
let statMonth = curMonthStr();      // 统计页正在看的月份
let statType  = 'expense';          // 统计页 支出 / 收入
let budMonth  = curMonthStr();      // 首页预算卡正在看的月份

let editingId = null;
let curType   = 'expense';
let curDate   = todayStr();
let curCat    = null;
let catLocked = false;
let parsed    = { amount:null, title:'', cat:null };
let guessed   = null;

let curQuote  = '';
const THEME_IMG_CACHE = {};         // 主题图 dataURL 缓存，避免反复读 localStorage


/* ────────────────────────────────────────────────────────────
   ⑧ 主题系统
   ──────────────────────────────────────────────────────────── */
function customThemes(){
  return DB.themes && Array.isArray(DB.themes) ? DB.themes : (DB.themes = []);
}
function themeName(id){
  const t = THEMES.find(x => x.id === id);
  if(t) return t.n + '主题';
  const c = customThemes().find(x => x.id === id);
  return c ? c.n : '海洋主题';
}
function themeSwatch(id){
  const t = THEMES.find(x => x.id === id);
  if(t) return { a: t.a, b: t.b };
  return { a:'#dfe8f2', b:'#f4f6f9' };
}

// 把整张主题图宽度对齐到 App 宽度，装饰元素靠这个比例切片
function syncTw(){
  const app = $('app');
  if(app) document.documentElement.style.setProperty('--tw', app.clientWidth + 'px');
}

/* 兜底：二级页停在屏幕右侧时会撑出 #app 的滚动区。
   #app 已经是 overflow:hidden（手指拖不动），但 iOS Safari 偶尔会漏，
   所以这里再把 scrollLeft 强行按回 0。 */
function lockHScroll(){
  const app = $('app');
  if(!app) return;
  app.addEventListener('scroll', () => { if(app.scrollLeft) app.scrollLeft = 0; }, { passive:true });
  window.addEventListener('resize', () => { if(app.scrollLeft) app.scrollLeft = 0; });
}

// 主题图只注入一次样式，比塞进 CSS 变量稳（图大了变量会拖慢重绘）
function injectThemeImg(dataUrl){
  let el = document.getElementById('themeImgStyle');
  if(!el){
    el = document.createElement('style');
    el.id = 'themeImgStyle';
    document.head.appendChild(el);
  }
  el.textContent = dataUrl
    ? 'html.has-theme .deco-layer,html.has-theme .hero,html.has-theme .stats-top,' +
      'html.has-theme .deco-footer{background-image:url("' + dataUrl + '");}'
    : '';
}

// 主题图的像素宽：上传时统一缩到 1080；万一图太复杂被压得更小，坐标靠这个换算
function themeImgW(id){
  const c = customThemes().find(x => x.id === id);
  return (c && c.w) || THEME_SPEC.w;
}

function applyTheme(id){
  const custom = !THEMES.some(t => t.id === id);
  document.documentElement.dataset.theme = custom ? 'custom' : id;

  if(custom){
    let data = THEME_IMG_CACHE[id];
    if(data === undefined){ data = Store.get('theme.' + id); THEME_IMG_CACHE[id] = data; }
    if(!data){ toast('这个主题的图片找不到了'); return applyTheme('ocean'); }
    injectThemeImg(data);
    document.documentElement.classList.add('has-theme');
  }else{
    injectThemeImg('');
    document.documentElement.classList.remove('has-theme');
  }

  // 坐标换算要用到「图宽」，写进 CSS 变量（style.css 第 ⑤ 节的 calc 靠它）
  document.documentElement.style.setProperty('--timgw', custom ? themeImgW(id) : THEME_SPEC.w);

  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', themeSwatch(id).a);

  // 装进 Android 壳之后，顺手把系统状态栏也染成主题色（网页里打开时这段自动跳过）
  try{
    if(window.LedgerNative && LedgerNative.setStatusBar){
      LedgerNative.setStatusBar(themeSwatch(id).a);
    }
  }catch(e){}

  syncTw();
}

function setTheme(id){
  DB.theme = id;
  Store.save();
  applyTheme(id);
  renderThemeGrid();
  toast('已换成「' + themeName(id) + '」');
}

// 上传一张图 → 起个名字 → 变成一套可切换的主题
function handleThemeFile(file){
  if(!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    URL.revokeObjectURL(url);

    const ratio = img.width / img.height;
    const want  = THEME_SPEC.w / THEME_SPEC.h;

    // 统一缩到宽 1080：分区坐标是按 1080 宽算的，宽度不对装饰就会偏位。
    // 顺带把手机拍的大图压小 —— localStorage 只有几 MB，原图直接塞进去必失败。
    let data = '', W = THEME_SPEC.w;
    try{
      for(const k of [1, 0.75, 0.5]){          // 太大就依次降采样，直到塞得进
        W = Math.round(THEME_SPEC.w * k);
        const cv = document.createElement('canvas');
        cv.width  = W;
        cv.height = Math.round(img.height * (W / img.width));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        // WebP 既保透明又比 PNG 小得多；浏览器不支持时会自动退回 PNG
        data = cv.toDataURL('image/webp', 0.92);
        if(data.indexOf('data:image/webp') !== 0) data = cv.toDataURL('image/png');
        if(data.length < 2.0 * 1024 * 1024) break;
      }
    }catch(e){ data = ''; }
    if(!data){ toast('这张图处理不了，换一张试试'); return; }
    if(data.length >= 2.0 * 1024 * 1024){ toast('这张图内容太满，压到最小还是存不下手机'); return; }

    askInput('给这套主题起个名字', '', name => {
      const id = 'c' + uid();
      if(!Store.put('theme.' + id, data)){
        toast('图片存不进手机，建议少画点元素再试');
        return;
      }
      customThemes().push({ id: id, n: name || '我的主题', w: W });
      DB.theme = id;
      Store.save();
      THEME_IMG_CACHE[id] = data;
      applyTheme(id);
      renderThemeGrid();
      toast('主题已保存');
      if(Math.abs(ratio - want) > 0.12){
        setTimeout(() => toast('提示：这张图不是 1080×3800，装饰位置可能偏'), 1800);
      }
    });
  };

  img.onerror = () => { URL.revokeObjectURL(url); toast('这张图读不出来'); };
  img.src = url;
}

function removeCustomTheme(id){
  DB.themes = customThemes().filter(t => t.id !== id);
  Store.del('theme.' + id);
  delete THEME_IMG_CACHE[id];
  if(DB.theme === id) DB.theme = 'ocean';
  Store.save();
  applyTheme(DB.theme);
  renderThemeGrid();
  toast('已删除');
}

function renderThemeGrid(){
  const list = THEMES.map(t => ({ id:t.id, n:t.n, a:t.a, b:t.b, custom:false }))
    .concat(customThemes().map(t => {
      const sw = { a:'#dfe8f2', b:'#f4f6f9' };
      return { id:t.id, n:t.n, a:sw.a, b:sw.b, custom:true };
    }));

  $('themeGrid').innerHTML = list.map(t => {
    const on = DB.theme === t.id;
    const pic = t.custom ? ('<img src="' + (THEME_IMG_CACHE[t.id] || Store.get('theme.' + t.id)) + '" alt="">') : '';
    return '<div class="theme-item' + (on ? ' is-on' : '') + '" data-theme-id="' + t.id + '">' +
      '<div class="theme-swatch" style="--sw-a:' + t.a + ';--sw-b:' + t.b + '">' + pic +
        (t.custom ? '<span class="theme-tag">自制</span>' : '') +
        (t.custom ? '<button class="theme-del" data-del-theme="' + t.id + '">✕</button>' : '') +
      '</div>' +
      '<div class="theme-name">' + esc(t.n) + '</div>' +
    '</div>';
  }).join('');

  const spec = THEME_SPEC;
  $('themeTip').innerHTML =
    '<b>自制主题图怎么做？</b>一张 PNG，画成 <code>' + spec.w + '×' + spec.h + '</code>，' +
    '从上往下排 5 块（坐标是原图像素）：<br>' +
    spec.zones.map(z =>
      z.id + ' ' + z.name + ' <code>' + z.w + '×' + z.h + '</code>' +
      ' 放 <code>(' + z.x + ',' + z.y + ')</code> — ' + z.note + '<br>'
    ).join('') +
    '<b>④⑤ 是自由装饰层</b>：整块透明底，贝壳、海星、云、光斑随便摆，' +
    '会整层浮在卡片上方（点击能穿透，不挡操作）。别压在文字上，或者画淡一点。<br>' +
    '<b>①②③ 是背景条</b>：屏幕那块多高就显示图上对应的那一截，画什么就看到什么，不会只露一半。<br>' +
    '上传时会自动缩到宽 <code>1080</code>（太大还会自动压），尺寸不用自己改。';
}

function renderThemePop(){
  // 首页右上角已改成「切换账本」，主题在设置页切换即可，这个浮层不再使用
}


/* ────────────────────────────────────────────────────────────
   ⑨ 头像
   ──────────────────────────────────────────────────────────── */
function handleAvatarFile(file){
  if(!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const S = 160;                                  // 头像存 160×160 就够，不占地方
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const s = Math.min(img.width, img.height);      // 居中裁成正方形
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
    const data = cv.toDataURL('image/jpeg', 0.86);
    DB.avatar = data;
    if(!Store.put('avatar', data)) toast('头像太大，没存下');
    Store.save();
    renderAvatar();
    toast('头像换好了');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('这张图读不出来'); };
  img.src = url;
}

function renderAvatar(){
  const src = DB.avatar || Store.get('avatar');
  if(src){
    $('avatarImg').src = src;
    $('avatarImg').hidden = false;
    $('avatarPh').hidden = true;
    $('setAvatar').querySelector('.set-ico').innerHTML =
      '<img src="' + src + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover" alt="">';
    $('setAvatarVal').textContent = '已自定义 ›';
  }else{
    $('avatarImg').hidden = true;
    $('avatarPh').hidden = false;
    $('setAvatarVal').textContent = '默认 ›';
  }
}


/* ────────────────────────────────────────────────────────────
   ⑩ 激励池
   ------------------------------------------------------------
   内置 316 条存在 quotes.js，这里只管「关掉哪些」和「自己加了哪些」。
   自己加的排在最前面，方便找。
   ──────────────────────────────────────────────────────────── */
function isOff(text){ return DB.quotes.off.indexOf(text) >= 0; }

function pickQuote(){
  const pool = [];
  QUOTES_BUILTIN.forEach(t => { if(!isOff(t)) pool.push(t); });
  DB.quotes.custom.forEach(q => { if(q.on !== false) pool.push(q.text); });

  if(!pool.length){ curQuote = '激励池被关空了，去设置里打开几条吧'; return; }
  if(pool.length === 1){ curQuote = pool[0]; return; }

  let next = curQuote;
  for(let i = 0; i < 8 && next === curQuote; i++){
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  curQuote = next;
}

function renderQuoteHome(){
  $('greetHi').textContent = greetWord();
  $('greetQuote').textContent = curQuote;
}

function renderQuotePage(){
  const mine = DB.quotes.custom;
  const total = QUOTES_BUILTIN.length + mine.length;
  const onCount = QUOTES_BUILTIN.filter(t => !isOff(t)).length +
                  mine.filter(q => q.on !== false).length;
  $('setQuotesVal').textContent = onCount + ' / ' + total + ' 条 ›';

  const html = [];
  // 自己加的置顶（最新的排最上面，方便一眼看到）
  mine.slice().reverse().forEach(q => {
    html.push(
      '<div class="quote-item is-mine' + (q.on === false ? ' is-off' : '') + '">' +
        '<span class="quote-tag">我的</span>' +
        '<span class="quote-txt">' + esc(q.text) + '</span>' +
        '<button class="quote-del" data-del-quote="' + q.id + '">🗑</button>' +
        '<span class="switch' + (q.on === false ? '' : ' is-on') + '" data-quote-id="' + q.id + '"></span>' +
      '</div>');
  });
  // 内置的
  QUOTES_BUILTIN.forEach(t => {
    const off = isOff(t);
    html.push(
      '<div class="quote-item' + (off ? ' is-off' : '') + '" data-builtin="' + esc(t) + '">' +
        '<span class="quote-txt">' + esc(t) + '</span>' +
        '<span class="switch' + (off ? '' : ' is-on') + '"></span>' +
      '</div>');
  });
  $('quoteList').innerHTML = html.join('');
}


/* ────────────────────────────────────────────────────────────
   ⑪ 首页渲染
   ------------------------------------------------------------
   日常账本：支出预算卡（可切月份 / 设预算 / 进度条）+ 按天卡片流水
   统筹账本：资产总览卡（投入 / 回收 / 结余）+ 不分日期的流水
   ──────────────────────────────────────────────────────────── */
function renderHome(){
  renderBookBtn();
  const recs = bookRecs();

  if(isPoolBook()){
    // —— 统筹账本：资产视角，不看日期 ——
    $('budgetCard').hidden = true;
    $('poolCard').hidden = false;
    const out = recs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const inn = recs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    $('poolOut').textContent = fmt(out);
    $('poolIn').textContent  = fmt(inn);
    const net = inn - out;
    const netEl = $('poolNet');
    netEl.textContent = (net < 0 ? '−' : '') + fmt(Math.abs(net));
    netEl.style.color = net < 0 ? '#e05252' : '';
    fitNum(netEl); fitNum($('poolOut')); fitNum($('poolIn'));
    renderRecList(recs);
  }else{
    // —— 日常账本：预算 + 当月流水 ——
    $('poolCard').hidden = true;
    $('budgetCard').hidden = false;
    renderBudgetCard(recs);
    renderRecList(recs.filter(r => monthOf(r.date) === budMonth));
  }

  renderQuoteHome();
}

function renderBudgetCard(recs){
  const monthRecs = recs.filter(r => monthOf(r.date) === budMonth);
  const exp = monthRecs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const inc = monthRecs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);

  $('budMonthText').textContent = monthText(budMonth);
  $('budExp').textContent = fmt(exp);
  $('budInc').textContent = fmt(inc);

  const budget = Number(DB.budget[budMonth]) || 0;
  const wrap = $('budBarWrap');
  if(budget > 0){
    wrap.hidden = false;
    // ★ 分段填色：按本月各类目支出占「已用」的比例，从左到右各涂各的颜色。
    //   例：预算 10000、已用 8000（餐饮 4000 / 交通 2000 / 旅游 2000）
    //   → 条内 40% 餐饮橙 + 20% 交通蓝 + 20% 旅游色，剩下的空槽是底色。
    const byCat = CATS.expense
      .map(c => ({ c, amt: monthRecs.filter(r => r.type === 'expense' && r.cat === c.k)
                                  .reduce((s, r) => s + r.amount, 0) }))
      .filter(x => x.amt > 0)
      .sort((a, b) => b.amt - a.amt);
    const fill = exp > 0 ? Math.min(exp / budget, 1) * 100 : 0;
    $('budBar').innerHTML = byCat.map(x => {
      const w = exp > 0 ? (x.amt / exp * fill) : 0;
      return '<i style="width:' + w.toFixed(2) + '%;background:' + x.c.c + '"></i>';
    }).join('');
    const left = budget - exp;
    const leftTxt = left >= 0
      ? '剩余 ¥' + fmt(left)
      : '<span style="color:#e05252;font-weight:700">超支 ¥' + fmt(-left) + '</span>';
    $('budBarTxt').innerHTML =
      '<span>已用 ¥' + fmt(exp) + ' / 预算 ¥' + fmt(budget) + '</span>' + leftTxt;
    $('btnSetBudget').textContent = '修改支出预算 ›';
  }else{
    wrap.hidden = true;
    $('btnSetBudget').textContent = '设置支出预算 ›';
  }
}

/* 预算条现在是分段多色（按类目占比），topCatColor 已无用 → 删 */

function renderBookBtn(){
  $('bookName').textContent = curBook().name;
}

/* 流水列表：日常账本按天分组卡片；统筹账本整块一张卡、每条带日期 */
function renderRecList(recs){
  const list = recs.slice().sort(byRecOrder);
  $('recCount').textContent = list.length ? '共 ' + list.length + ' 笔' : '';

  if(!list.length){
    $('flowHint').hidden = true;
    $('recList').innerHTML =
      '<div class="empty"><span class="empty-ico">🧾</span>还没有记录<br>点右下角「+」记第一笔</div>';
    return;
  }

  const LIMIT = 8;                                 // 首页只看最新 8 条，全量去「更多」
  const show = list.slice(0, LIMIT);
  const rest = list.length - show.length;
  $('flowHint').hidden = rest <= 0;
  if(rest > 0) $('flowHint').textContent = '还有 ' + rest + ' 笔 · 点右上角「更多」看全部';

  $('recList').innerHTML = isPoolBook()
    ? '<div class="day-card">' + show.map(r => recHTML(r, true)).join('') + '</div>'
    : renderDayGroups(show);
}

/* 按天分组 → 一天一张凸起小卡片 */
function renderDayGroups(list){
  const byDay = {};
  list.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
  return Object.keys(byDay).sort().reverse().map(d => {
    const items = byDay[d];
    const dayExp = items.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    return '<div class="day-card">' +
      '<div class="day-head">' +
        '<span>' + dayLabel(d) + '</span>' +
        '<span class="day-sum">' + (dayExp ? '支出 ¥' + fmt(dayExp) : '') + '</span>' +
      '</div>' +
      items.map(r => recHTML(r)).join('') +
    '</div>';
  }).join('');
}

/* 一条明细：
   第一行  事项（加粗） + 类目（同行小字）
   第二行  备注（有才显示）
   showDate=true 时再补一行日期（统筹账本用，因为不按天分组了） */
function recHTML(r, showDate){
  const c = findCat(r.type, r.cat) || { n:'未分类', i:'❓', c:'#94a3b8' };
  const sign = r.type === 'income' ? '+' : '−';
  const title = esc(r.title);
  return '<div class="rec" data-id="' + r.id + '">' +
    '<div class="rec-ico" style="background:' + c.c + '1f">' + c.i + '</div>' +
    '<div class="rec-main">' +
      '<div class="rec-line1">' +
        '<span class="rec-title">' + (title || c.n) + '</span>' +
        (title ? '<span class="rec-cat">' + c.n + '</span>' : '') +
      '</div>' +
      (r.note ? '<div class="rec-note">' + esc(r.note) + '</div>' : '') +
      (showDate ? '<div class="rec-sub">' + dateText(r.date) + '</div>' : '') +
    '</div>' +
    '<div class="rec-amt' + (r.type === 'income' ? ' income' : '') + '">' + sign + fmt(r.amount) + '</div>' +
  '</div>';
}


/* ────────────────────────────────────────────────────────────
   ⑫ 统计页
   ------------------------------------------------------------
   日常账本：按月统计（每日对比 / 月度对比）
   统筹账本：不看日期，全部数据一起算，隐藏日期类图表
   ──────────────────────────────────────────────────────────── */
function renderStats(){
  const pool = isPoolBook();
  const recs = bookRecs().filter(r => pool || monthOf(r.date) === statMonth);
  const isExp = statType === 'expense';

  $('stTitle').textContent = pool ? (curBook().name + ' · 全部') : monthText(statMonth);
  $('stLabel').textContent = isExp ? '共支出' : '共收入';
  $('stPrev').style.display = pool ? 'none' : '';
  $('stNext').style.display = pool ? 'none' : '';
  $('cardDaily').style.display   = pool ? 'none' : '';
  $('cardMonthly').style.display = pool ? 'none' : '';
  Array.prototype.forEach.call($('stTypeSeg').children, b => {
    b.classList.toggle('is-on', b.dataset.t === statType);
  });

  const typed = recs.filter(r => r.type === statType);
  const total = typed.reduce((s, r) => s + r.amount, 0);
  $('stTotal').textContent = '¥ ' + fmt(total);

  const rows = CATS[statType].map(c => ({
    ...c,
    amt: typed.filter(r => r.cat === c.k).reduce((s, r) => s + r.amount, 0)
  })).filter(x => x.amt > 0).sort((a, b) => b.amt - a.amt);

  renderDonut(rows, total, isExp);
  renderCatList(rows, total);
  if(!pool){
    renderDaily(recs, statMonth, isExp);
    renderMonthly(statMonth, statType);
  }
  renderRank(typed, isExp);
}

function renderDonut(rows, total, isExp){
  const R = 46, C = 2 * Math.PI * R;
  $('dcLabel').textContent = isExp ? '总支出' : '总收入';
  $('dcNum').textContent = '¥' + fmtShort(total);

  if(!total){
    $('donut').innerHTML =
      '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#eef0f5" stroke-width="13"/>';
    return;
  }

  let acc = 0;
  $('donut').innerHTML = rows.map(r => {
    const len = (r.amt / total) * C;
    const seg = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + r.c + '"' +
      ' stroke-width="13" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"' +
      ' stroke-dashoffset="' + (-acc).toFixed(2) + '"/>';
    acc += len;
    return seg;
  }).join('');
}

function renderCatList(rows, total){
  if(!rows.length){
    $('stCatList').innerHTML = '<div class="empty" style="padding:14px 0">这个月还没有数据</div>';
    return;
  }
  const max = rows[0].amt;
  // 带上 data-type / data-cat：整行可点，点开跳「类目明细」页
  $('stCatList').innerHTML = rows.map(r => {
    const pct = total ? (r.amt / total * 100) : 0;
    const w = (r.amt / max * 100).toFixed(1);
    return '<div class="cat-row" data-type="' + statType + '" data-cat="' + r.k + '">' +
      '<span class="cat-ico" style="background:' + r.c + '1f">' + r.i + '</span>' +
      '<span class="cat-name">' + r.n + '</span>' +
      '<span class="cat-bar"><i style="width:' + w + '%;background:' + r.c + '"></i></span>' +
      '<span class="cat-pct">' + pct.toFixed(1) + '%</span>' +
      '<span class="cat-amt">¥' + fmt(r.amt) + '</span>' +
    '</div>';
  }).join('');
}

// 每日对比：这个月每天一根柱
function renderDaily(recs, month, isExp){
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  // 看的是本月就只画到今天 —— 后面一堆空柱子既占地又不好看
  const days = (month === curMonthStr()) ? new Date().getDate() : daysInMonth;

  const sums = new Array(days + 1).fill(0);
  recs.filter(r => r.type === (isExp ? 'expense' : 'income'))
      .forEach(r => { const d = Number(String(r.date).slice(8, 10)); if(d >= 1 && d <= days) sums[d] += r.amount; });

  const items = [];
  for(let d = 1; d <= days; d++){
    // 标签太密会挤，隔几天标一个
    const step = days > 20 ? 5 : 3;
    const showLab = (d === 1 || d % step === 0 || d === days);
    items.push({ label: showLab ? (m + '.' + d) : '', value: sums[d] });
  }
  renderBars($('chartDaily'), items, isExp);
}

// 月度对比：往前看 6 个月
function renderMonthly(month, type){
  const items = [];
  for(let i = 5; i >= 0; i--){
    const m = shiftMonthStr(month, -i);
    const v = bookRecs()
      .filter(r => monthOf(r.date) === m && r.type === type)
      .reduce((s, r) => s + r.amount, 0);
    items.push({ label: Number(m.slice(5, 7)) + '月', value: v });
  }
  renderBars($('chartMonthly'), items, type === 'expense');
}

function renderBars(el, items, isExp){
  const max = Math.max(...items.map(i => i.value));
  if(!max){
    el.innerHTML = '<div class="chart-empty">这段时间没有数据</div>';
    return;
  }
  const color = isExp ? 'var(--primary)' : 'var(--income)';
  // 柱子多的时候每根都标数字会糊成一片，只标最高的那根
  const showAll = items.length <= 8;
  let top = 0;
  items.forEach((it, i) => { if(it.value > items[top].value) top = i; });

  el.innerHTML = '<div class="bars">' + items.map((it, i) => {
    const pct = it.value / max * 100;
    const withVal = it.value > 0 && (showAll || i === top);
    return '<div class="bar-col">' +
      '<div class="bar-fill' + (it.value ? '' : ' is-zero') + '" style="height:' +
        (it.value ? Math.max(pct, 3) : 2) + '%;background:' + (it.value ? color : '') + '"></div>' +
      (withVal ? '<span class="bar-val" style="bottom:calc(' + pct + '% + 3px)">' +
        fmtShort(it.value) + '</span>' : '') +
      '<span class="bar-lab">' + it.label + '</span>' +
    '</div>';
  }).join('') + '</div>';
}

function renderRank(typed, isExp){
  const top = typed.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
  if(!top.length){
    $('rankList').innerHTML = '<div class="empty" style="padding:14px 0">这个月还没有数据</div>';
    return;
  }
  $('rankList').innerHTML = top.map((r, i) => {
    const c = findCat(r.type, r.cat) || { n:'未分类', i:'❓', c:'#94a3b8' };
    const d = new Date(r.date + 'T00:00:00');
    return '<div class="rank-item">' +
      '<span class="rank-no">' + (i + 1) + '</span>' +
      '<span class="rec-ico" style="background:' + c.c + '1f;width:30px;height:30px;font-size:14px">' + c.i + '</span>' +
      '<div class="rank-main">' +
        '<div class="rank-title">' + (esc(r.title) || c.n) + '</div>' +
        '<div class="rank-sub">' + c.n + ' · ' + (d.getMonth() + 1) + '月' + d.getDate() + '日</div>' +
      '</div>' +
      '<span class="rank-amt">' + (isExp ? '−' : '+') + fmt(r.amount) + '</span>' +
    '</div>';
  }).join('');
}


/* ────────────────────────────────────────────────────────────
   ⑬ 设置页
   ──────────────────────────────────────────────────────────── */
function renderSettings(){
  renderBookSettings();
  renderAvatar();
  renderThemeGrid();
  renderQuotePage();
  renderBackupHint();
}

/* 设置页里的账本列表：图标 + 名称 + 类型 + 备注 + 快捷删除，点一下进编辑 */
function renderBookSettings(){
  $('bookManageList').innerHTML = DB.books.map(b => {
    const on = b.id === DB.curBook;
    // 第一个账本是兜底账本（数据都有它兜着），当前账本也不能删
    const canDel = b.id !== DB.books[0].id && b.id !== DB.curBook;
    return '<div class="set-row" data-manage-book="' + b.id + '">' +
      '<span class="set-ico">' + bookIcon(b) + '</span>' +
      '<span class="set-name">' + esc(b.name) + ' ' +
        '<span class="book-kind-tag' + (b.kind === 'pool' ? ' is-pool' : '') + '">' +
        (b.kind === 'pool' ? '统筹' : '日常') + '</span>' +
        (on ? ' <span class="book-cur">当前</span>' : '') +
        (b.note ? '<span class="book-note">' + esc(b.note) + '</span>' : '') +
      '</span>' +
      (canDel ? '<button class="row-del" data-del-book="' + b.id + '">删</button>' : '') +
      '<span class="set-val">编辑 ›</span>' +
    '</div>';
  }).join('');
}


/* ────────────────────────────────────────────────────────────
   ⑭ 全部明细 / 类目明细（二级页面）
   ------------------------------------------------------------
   两套筛选状态、两个页面，渲染逻辑共用：
   · filter   → 「更多」进来的全部明细（subAll）
   · catFilter→ 统计页点「支出构成」进来的类目明细（subCat），
                打开时自动带好「月份 × 类目」，返回时回到统计页
   ──────────────────────────────────────────────────────────── */
const filter   = { kw:'', range:'all', month:curMonthStr(), from:'', to:'', kind:'all', cat:'', dd:'all' };
let catFilter  = { kw:'', range:'month', month:curMonthStr(), from:'', to:'', kind:'expense', cat:'', dd:'m'+curMonthStr() };

/* ── 自定义下拉筛选器（不用原生 select——系统弹窗丑，还不支持组标题） ──
   结构：<div class="dd"><button class="dd-btn">…</button><div class="dd-list">…</div></div>
   ddRender 负责把选项画进列表；开合和点外面关闭在 bindEvents 里统一挂。 */
function closeAllDD(){
  document.querySelectorAll('.dd-list').forEach(l => { l.hidden = true; });
}
function ddRender(listEl, opts, curV, onPick){
  listEl.innerHTML = opts.map(o =>
    o.group
      ? '<div class="dd-group">' + o.group + '</div>'
      : '<button class="dd-item' + (o.v === curV ? ' is-on' : '') + '" data-ddv="' + o.v + '">' + o.label + '</button>'
  ).join('');
  listEl.onclick = e => {
    const it = e.target.closest('[data-ddv]');
    if(!it) return;
    listEl.hidden = true;
    onPick(it.dataset.ddv);
  };
}

/* 时间下拉的选项：全部 / 今年 / 近30天 / 近90天 / 最近12个月 / 自定义 */
function timeDDOptions(){
  const now = new Date(), Y = now.getFullYear();
  const opts = [
    { v:'all',  label:'全部时间' },
    { v:'year', label:'今年 ' + Y },
    { v:'l30',  label:'最近 30 天' },
    { v:'l90',  label:'最近 90 天' },
    { group:'按月看' }
  ];
  for(let i = 0; i < 12; i++){
    const d = new Date(Y, now.getMonth() - i, 1);
    opts.push({ v:'m' + d.getFullYear() + '-' + pad2(d.getMonth() + 1), label: monthText(d.getFullYear() + '-' + pad2(d.getMonth() + 1)) });
  }
  opts.push({ v:'custom', label:'自定义区间…' });
  return opts;
}

/* 把时间下拉的选中值写进筛选状态（f / c 两套共用） */
function applyTimeVal(flt, v, ui){
  const now = new Date(), Y = now.getFullYear();
  ui.customRow.hidden = true;
  if(v === 'all'){
    flt.range = 'all'; ui.label.textContent = '全部时间';
  }else if(v === 'year'){
    flt.range = 'custom'; flt.from = Y + '-01-01'; flt.to = Y + '-12-31';
    ui.from.value = flt.from; ui.to.value = flt.to;
    ui.label.textContent = '今年';
  }else if(v === 'l30' || v === 'l90'){
    const d = new Date(now); d.setDate(d.getDate() - (v === 'l30' ? 29 : 89));
    flt.range = 'custom'; flt.from = ymd(d); flt.to = ymd(now);
    ui.from.value = flt.from; ui.to.value = flt.to;
    ui.label.textContent = v === 'l30' ? '最近 30 天' : '最近 90 天';
  }else if(v === 'custom'){
    flt.range = 'custom'; ui.customRow.hidden = false;
    ui.label.textContent = '自定义';
  }else{                                   // m2026-09
    flt.range = 'month'; flt.month = v.slice(1);
    ui.label.textContent = monthText(flt.month);
  }
  flt.dd = v;
}

/* 类目下拉的选项：全部 + 支出组 + 收入组 */
function catDDOptions(){
  const opts = [{ v:'cat:', label:'全部类目' }];
  opts.push({ group:'支出' });              // 组标题单独一条，不能混进类目项（会把首项吞掉）
  CATS.expense.forEach(c =>
    opts.push({ v:'cat:e:' + c.k, label: c.i + ' ' + c.n }));
  opts.push({ group:'收入' });
  CATS.income.forEach(c =>
    opts.push({ v:'cat:i:' + c.k, label: c.i + ' ' + c.n }));
  return opts;
}

/* 选中类目：写入 cat / kind（联动 chips 高亮），返回给下拉按钮用的文案 */
function applyCatVal(flt, v, chipsScope){
  if(v === 'cat:'){
    flt.cat = '';
    flt.kind = 'all';                     // 「全部类目」= 收支都看，chips 回到「全部」
    Array.prototype.forEach.call(document.querySelectorAll(chipsScope + ' .f-chip'), c =>
      c.classList.toggle('is-on', c.dataset.kind === 'all'));
  }else{
    const parts = v.split(':');           // cat:e:pet
    flt.cat = parts[2];
    flt.kind = parts[1] === 'i' ? 'income' : 'expense';   // 'e'/'i' 是缩写，映射回全称
    Array.prototype.forEach.call(document.querySelectorAll(chipsScope + ' .f-chip'), c =>
      c.classList.toggle('is-on', c.dataset.kind === flt.kind));
  }
  return flt.cat ? findCat(flt.kind, flt.cat).n : '全部类目';
}

/* 统一的时间筛选逻辑（两个页面共用一套写法） */
function applyTimeFilter(list, flt){
  if(flt.range === 'month' && flt.month){
    list = list.filter(r => monthOf(r.date) === flt.month);
  }else if(flt.range === 'custom'){
    if(flt.from) list = list.filter(r => r.date >= flt.from);
    if(flt.to)   list = list.filter(r => r.date <= flt.to);
  }
  return list;
}

function applyAllFilter(){
  let list = bookRecs();

  list = applyTimeFilter(list, filter);
  if(filter.kind !== 'all') list = list.filter(r => r.type === filter.kind);
  if(filter.cat) list = list.filter(r => r.cat === filter.cat);

  const kw = filter.kw.trim().toLowerCase();
  if(kw){
    list = list.filter(r =>
      String(r.title || '').toLowerCase().indexOf(kw) >= 0 ||
      String(r.note  || '').toLowerCase().indexOf(kw) >= 0);
  }

  return list.sort(byRecOrder);
}

/* 列表 + 底部合计，两个页面共用 */
function renderFilteredPage(listEl, sumEl, countEl, list){
  const exp = list.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const inc = list.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);

  if(countEl) countEl.textContent = list.length + ' 笔';
  sumEl.innerHTML =
    '<span>支出 <b>' + fmt(exp) + '</b></span><span>收入 <b>' + fmt(inc) + '</b></span>';

  if(!list.length){
    listEl.innerHTML = '<div class="empty"><span class="empty-ico">🔍</span>没有符合条件的记录</div>';
    return;
  }

  listEl.innerHTML = isPoolBook()
    ? '<div class="day-card">' + list.map(r => recHTML(r, true)).join('') + '</div>'
    : renderDayGroups(list);
}

function renderAllList(){
  renderFilteredPage($('allList'), $('allSum'), $('allCount'), applyAllFilter());
}

/* —— 类目明细页（subCat）—— */
function openCatFilter(type, cat){
  const pool = isPoolBook();
  catFilter = {
    kw:'', range: pool ? 'all' : 'month', month: statMonth, from:'', to:'',
    kind: type, cat: cat,
    dd: pool ? 'all' : ('m' + statMonth)
  };
  syncCatUI(true);
  renderCatPage();
  openSub('subCat');
}

function subCatTitle(){
  const c = findCat(catFilter.kind, catFilter.cat);
  const label = c ? c.n : '明细';
  return label + (isPoolBook() || catFilter.range !== 'month' ? '' : ' · ' + monthText(catFilter.month));
}

/* dd 值 → 按钮上的短文案 */
function timeLabelText(v){
  if(v === 'all')    return '全部时间';
  if(v === 'year')   return '今年';
  if(v === 'l30')    return '最近 30 天';
  if(v === 'l90')    return '最近 90 天';
  if(v === 'custom') return '自定义';
  if(v && v.charAt(0) === 'm') return monthText(v.slice(1));
  return '全部时间';
}

/* syncUI：把 catFilter 的状态刷到页面控件上。hardReset 时连关键字一起清 */
function syncCatUI(hardReset){
  if(hardReset) $('cKeyword').value = '';
  $('cFrom').value = catFilter.from; $('cTo').value = catFilter.to;
  // 只有「自定义区间…」这一档才显示日期输入行（今年/近30天虽然也是 range=custom，但区间是算出来的）
  $('cCustomRow').hidden = !(catFilter.range === 'custom' && catFilter.dd === 'custom');
  $('cTimeLabel').textContent = timeLabelText(catFilter.dd);
  $('cCatLabel').textContent = catFilter.cat ? findCat(catFilter.kind, catFilter.cat).n : '全部类目';
  Array.prototype.forEach.call($('subCat').querySelectorAll('.f-chip'), c =>
    c.classList.toggle('is-on', c.dataset.kind === catFilter.kind));
  // 统筹账本不按日期看，整行时间筛选藏起来
  $('cTimeRow').style.display = isPoolBook() ? 'none' : '';
  $('subCatTitle').textContent = subCatTitle();
}

function applyCatPageFilter(){
  let list = bookRecs();

  list = applyTimeFilter(list, catFilter);
  if(catFilter.kind !== 'all') list = list.filter(r => r.type === catFilter.kind);
  if(catFilter.cat) list = list.filter(r => r.cat === catFilter.cat);

  const kw = catFilter.kw.trim().toLowerCase();
  if(kw){
    list = list.filter(r =>
      String(r.title || '').toLowerCase().indexOf(kw) >= 0 ||
      String(r.note  || '').toLowerCase().indexOf(kw) >= 0);
  }

  return list.sort(byRecOrder);
}

function renderCatPage(){
  renderFilteredPage($('catPageList'), $('catPageSum'), $('catPageCount'), applyCatPageFilter());
}

function renderQuotesPage(){
  renderQuotePage();
}

function openSub(id){
  $(id).classList.add('is-on');
}
function closeSub(el){
  el.classList.remove('is-on');
}


/* ────────────────────────────────────────────────────────────
   ⑮ Tab 切换
   ──────────────────────────────────────────────────────────── */
function switchTab(name){
  curTab = name;
  ['pageHome', 'pageStats', 'pageSettings'].forEach(id => {
    const on = id === 'page' + name.charAt(0).toUpperCase() + name.slice(1);
    $(id).classList.toggle('is-on', on);
  });
  Array.prototype.forEach.call($('tabbar').querySelectorAll('.tab'), b => {
    b.classList.toggle('is-on', b.dataset.tab === name);
  });

  if(name === 'home')     renderHome();
  if(name === 'stats')    renderStats();
  if(name === 'settings') renderSettings();
}


/* ────────────────────────────────────────────────────────────
   ⑮½ 账本：切换 / 新建 / 编辑
   ──────────────────────────────────────────────────────────── */
function renderBookPop(){
  $('bookPopList').innerHTML = DB.books.map(b => {
    const on = b.id === DB.curBook;
    const n = DB.records.filter(r => r.book === b.id).length;
    return '<div class="book-row' + (on ? ' is-on' : '') + '" data-book="' + b.id + '">' +
      '<span class="book-ico">' + bookIcon(b) + '</span>' +
      '<div class="book-main">' +
        '<div class="book-line">' +
          '<span class="book-name">' + esc(b.name) + '</span>' +
          '<span class="book-kind-tag' + (b.kind === 'pool' ? ' is-pool' : '') + '">' +
            (b.kind === 'pool' ? '统筹' : '日常') + '</span>' +
        '</div>' +
        (b.note ? '<span class="book-note">' + esc(b.note) + '</span>' : '') +
        '<div class="book-cnt">' + n + ' 笔记录</div>' +
      '</div>' +
      (on
        ? '<span class="book-check">✓</span>'
        : '<button class="book-edit" data-edit-book="' + b.id + '">编辑</button>') +
    '</div>';
  }).join('');
}

/* 切换账本 → 全部页面重刷（口径整个变了） */
function switchBook(id){
  if(!DB.books.some(b => b.id === id) || id === DB.curBook) return;
  DB.curBook = id;
  Store.save();
  budMonth  = curMonthStr();
  statMonth = curMonthStr();
  renderBookBtn();
  renderHome();
  renderStats();
  renderAllList();
  renderSettings();
  toast('已切到「' + curBook().name + '」');
}

let newBookKind = 'daily';
let newBookIcon = '📘';
function renderKindHint(){
  $('kindHint').textContent = newBookKind === 'pool'
    ? '不按日期：只记资产变动，看收入 / 支出 / 结余（比如黄金）'
    : '按月份记账：有预算、月度统计、每日对比';
}

/* 图标九宫格：icon-grid 元素 + 当前选中 + 点选回调 */
function renderIconGrid(el, cur, onPick){
  el.innerHTML = BOOK_ICONS.map(i =>
    '<button class="icon-cell' + (i === cur ? ' is-on' : '') + '" data-icon="' + i + '">' + i + '</button>'
  ).join('');
  el.onclick = e => {
    const cell = e.target.closest('[data-icon]');
    if(!cell) return;
    Array.prototype.forEach.call(el.children, c =>
      c.classList.toggle('is-on', c === cell));
    onPick(cell.dataset.icon);
  };
}

function createBook(){
  const name = $('newBookName').value.trim();
  if(!name){ toast('先给账本起个名字'); return; }
  if(DB.books.some(b => b.name === name)){ toast('已经有叫这个名字的账本了'); return; }
  const b = {
    id: 'b' + uid(),
    name: name,
    note: $('newBookNote').value.trim(),
    kind: newBookKind,
    icon: newBookIcon
  };
  DB.books.push(b);
  DB.curBook = b.id;               // 建完直接切过去，顺手
  Store.save();
  $('bookAddPop').classList.remove('is-on');
  $('newBookName').value = ''; $('newBookNote').value = '';
  newBookKind = 'daily'; newBookIcon = '📘';
  Array.prototype.forEach.call($('newBookKind').children, c =>
    c.classList.toggle('is-on', c.dataset.k === 'daily'));
  renderKindHint();
  budMonth = curMonthStr(); statMonth = curMonthStr();
  renderBookBtn(); renderHome(); renderStats(); renderAllList(); renderSettings();
  toast('账本「' + b.name + '」已创建并切换');
}

let editBookId = null;
function openBookEdit(id){
  const b = DB.books.find(x => x.id === id);
  if(!b) return;
  editBookId = id;
  $('bookEditTitle').textContent = '账本 · ' + b.name;
  $('bookNameInput').value = b.name;
  $('bookNoteInput').value = b.note || '';
  renderIconGrid($('editBookIcons'), bookIcon(b), i => { editBookIcon = i; });
  editBookIcon = bookIcon(b);
  $('bookUseBtn').hidden = (id === DB.curBook);
  // 第一个账本（兜底账本）和当前账本不能删，防止手滑把数据清没了
  $('bookDelBtn').hidden = (id === DB.books[0].id) || (id === DB.curBook);
  $('bookEditPop').classList.add('is-on');
}

function saveBookEdit(){
  const b = DB.books.find(x => x.id === editBookId);
  if(!b) return;
  const name = $('bookNameInput').value.trim();
  if(!name){ toast('名字不能为空'); return; }
  b.name = name;
  b.note = $('bookNoteInput').value.trim();
  if(editBookIcon) b.icon = editBookIcon;
  Store.save();
  $('bookEditPop').classList.remove('is-on');
  renderBookBtn(); renderHome(); renderSettings();
  renderBookPop();
  toast('已保存');
}

function deleteBookEdit(id){
  id = id || editBookId;
  const b = DB.books.find(x => x.id === id);
  if(!b) return;
  const n = DB.records.filter(r => r.book === b.id).length;
  const msg = n
    ? '「' + b.name + '」里有 ' + n + ' 笔记录，删除后这些记录会一起没掉。确定删吗？'
    : '确定删除「' + b.name + '」吗？';
  if(!confirm(msg)) return;
  DB.records = DB.records.filter(r => r.book !== b.id);
  DB.books = DB.books.filter(x => x.id !== b.id);
  Store.save();
  $('bookEditPop').classList.remove('is-on');
  renderHome(); renderStats(); renderAllList(); renderSettings();
  toast('已删除「' + b.name + '」');
}


/* ────────────────────────────────────────────────────────────
   ⑯ 记一笔 弹窗
   ──────────────────────────────────────────────────────────── */
function resolvedCat(){
  if(catLocked && curCat) return curCat;
  return guessed || (curType === 'income' ? 'otherin' : 'other');
}

function openSheet(rec, preset){
  editingId = rec ? rec.id : null;
  curType   = rec ? rec.type : (preset && preset.type ? preset.type : 'expense');
  curDate   = rec ? rec.date : todayStr();
  curCat    = rec ? rec.cat  : (preset && preset.cat ? preset.cat : null);
  catLocked = !!(rec || (preset && preset.cat));

  if(rec){
    // 已有记录 → 回填成「事项 金额」这一句话，方便直接改
    $('entryInput').value = ((rec.title ? rec.title + ' ' : '') + (Math.round(rec.amount * 100) / 100));
    $('noteInput').value = rec.note || '';
  }else if(preset){
    $('entryInput').value = preset.text || '';
    $('noteInput').value = '';
  }else{
    $('entryInput').value = '';
    $('noteInput').value = '';
  }

  // 有备注就展开那一行
  $('noteRow').classList.toggle('is-on', !!$('noteInput').value);
  $('btnDelete').hidden = !rec;
  // 统筹账本不看日期，日期选择藏起来（自动记当天，只用于排序）
  $('btnDate').hidden = isPoolBook();

  $('catPills').classList.remove('is-on');
  renderTypeSeg();
  renderDateRow();
  syncEntry();

  $('sheetLayer').classList.add('is-on');
  $('sheet').scrollTop = 0;
}

function closeSheet(){
  $('sheetLayer').classList.remove('is-on');
  $('catPills').classList.remove('is-on');
  $('entryInput').blur();
  $('noteInput').blur();
  editingId = null;
}

function renderTypeSeg(){
  Array.prototype.forEach.call($('typeSeg').children, b => {
    b.classList.toggle('is-on', b.dataset.type === curType);
  });
}
function renderDateRow(){
  $('dateText').textContent = dateText(curDate);
}

function syncEntry(){
  parsed  = parseEntry($('entryInput').value);
  guessed = guessCat(parsed.title, curType);
  renderParseRow();
  renderCatPills();
}

function renderParseRow(){
  const c = findCat(curType, resolvedCat()) || { n:'其他', i:'📦', c:'#94a3b8' };
  $('parseChip').innerHTML =
    '<span class="pc-ico">' + c.i + '</span>' +
    '<span class="pc-name">' + c.n + '</span>' +
    '<span class="pc-arrow">▾</span>';
  // 高亮 = 有依据（认出来了，或你自己选的）；灰 = 兜底的「其他」
  $('parseChip').classList.toggle('is-guessed', !!guessed || catLocked);

  const amt = $('parseAmt');
  const typing = !!$('entryInput').value.trim();
  if(parsed.amount > 0){
    amt.textContent = '¥ ' + fmt(parsed.amount);
    amt.classList.remove('is-empty');
  }else{
    amt.textContent = typing ? '没识别到金额' : '¥ --';
    amt.classList.add('is-empty');
  }
  $('btnSave').classList.toggle('is-ready', !!(parsed.amount > 0));
}

function renderCatPills(){
  const on = resolvedCat();
  $('catPills').innerHTML = CATS[curType].map(c =>
    '<button class="pill' + (c.k === on ? ' is-on' : '') + '" data-k="' + c.k + '">' +
      '<span class="pi">' + c.i + '</span>' + c.n +
    '</button>'
  ).join('');
}

function saveRecord(){
  if(!(parsed.amount > 0)){
    toast('没识别到金额，比如「火车票 331」');
    $('entryInput').focus();
    return;
  }

  const note    = $('noteInput').value.trim();
  const cat     = resolvedCat();
  const title   = parsed.title;
  const amount  = parsed.amount;
  const wasEdit = !!editingId;

  if(wasEdit){
    const r = DB.records.find(x => x.id === editingId);
    if(r) Object.assign(r, { date: curDate, amount, type: curType, cat, title, note });
  }else{
    DB.records.push({
      id: uid(), date: curDate, amount, type: curType, cat, title, note,
      book: curBook().id, ts: Date.now()
    });
  }

  Store.save();
  closeSheet();

  // 刚记的那笔在哪个页面，就刷新哪个
  if(curTab === 'home')     renderHome();
  if(curTab === 'stats')    renderStats();
  if(curTab === 'settings') renderSettings();
  renderAllList();
  if($('subCat').classList.contains('is-on')) renderCatPage();
  toast(wasEdit ? '已保存修改' : '记好了');
}

function deleteRecord(){
  const i = DB.records.findIndex(x => x.id === editingId);
  if(i < 0) return;

  const backup = DB.records[i];
  DB.records.splice(i, 1);
  Store.save();
  closeSheet();
  renderHome();
  renderAllList();
  if($('subCat').classList.contains('is-on')) renderCatPage();

  toastUndo('已删除', () => {          // 4 秒内可撤销
    DB.records.push(backup);
    Store.save();
    renderHome();
    renderAllList();
    if($('subCat').classList.contains('is-on')) renderCatPage();
    toast('已恢复');
  });
}


/* ────────────────────────────────────────────────────────────
   ⑰ 提示条
   ──────────────────────────────────────────────────────────── */
let toastTimer = null;
let undoAction = null;

function toast(msg, ms){
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('has-undo');
  el.classList.add('is-on');
  undoAction = null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms || 1700);
}

function toastUndo(msg, action){
  const el = $('toast');
  el.innerHTML = '<span>' + msg + '</span><button class="undo">撤销</button>';
  el.classList.add('is-on', 'has-undo');
  undoAction = action;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-on', 'has-undo');
    undoAction = null;
  }, 4000);
}

// 通用「输一行字」浮层
let askCallback = null;
function askInput(title, def, cb){
  $('askTitle').textContent = title;
  $('askInput').value = def || '';
  askCallback = cb;
  $('askPop').classList.add('is-on');
  setTimeout(() => $('askInput').focus(), 260);
}
function closeAsk(){
  $('askPop').classList.remove('is-on');
  $('askInput').blur();
  askCallback = null;
}


/* ────────────────────────────────────────────────────────────
   ⑱ 示例数据
   ──────────────────────────────────────────────────────────── */
function seedDemo(){
  const [y, m] = curMonthStr().split('-').map(Number);
  const todayNum = new Date().getDate();
  const D = d => y + '-' + pad2(m) + '-' + pad2(Math.min(d, todayNum));

  const rows = [
    [1,  'expense', 'home',    2500,  '房贷',   '每月固定'],
    [2,  'expense', 'food',    26.5,  '午饭',   ''],
    [3,  'expense', 'traffic', 100,   '地铁充值', ''],
    [5,  'expense', 'food',    32,    '咖啡',   ''],
    [6,  'expense', 'fun',     102,   '电影票', '两张'],
    [8,  'expense', 'food',    138,   '朋友聚餐', ''],
    [9,  'expense', 'shop',    128,   '日用品', ''],
    [10, 'expense', 'traffic', 331,   '火车票', '回家'],
    [11, 'expense', 'social',  200,   '随礼',   ''],
    [12, 'expense', 'fun',     522,   '电竞酒店', '周末'],
    [13, 'expense', 'food',    15.9,  '奶茶',   ''],
    [15, 'income',  'salary',  12000, '工资',   ''],
    [16, 'expense', 'fun',     284,   '周深快闪店', '预定'],
    [17, 'expense', 'food',    18,    '午饭',   '']
  ];

  return rows.map((r, i) => ({
    id: 'demo' + i,
    date: D(r[0]),
    type: r[1],
    cat: r[2],
    amount: r[3],
    title: r[4],
    note: r[5],
    book: 'main',
    ts: Date.now() + i,
    demo: true
  }));
}


/* ────────────────────────────────────────────────────────────
   ⑲ 备份 / 恢复 —— 三条通道

   ① 导出文件：浏览器走下载；Android 壳走原生写「下载」目录
      （WebView 里 Blob + <a download> 完全不生效，必须交给原生）
   ② 导入文件：<input type="file"> 选备份 JSON
   ③ 备份文本：复制 / 粘贴一坨文本。跨设备搬运用得上 ——
      比如从手机浏览器里的旧数据搬到 APK 里，中间不需要传文件
   ──────────────────────────────────────────────────────────── */

/** 备份文件的完整内容。导出文件 / 复制文本共用同一份结构。 */
function backupPayload(){
  return JSON.stringify({
    v: 3,
    exportedAt: new Date().toISOString(),
    records: DB.records,
    quotes: DB.quotes,
    theme: DB.theme,
    books: DB.books,
    curBook: DB.curBook,
    budget: DB.budget
  }, null, 2);
}

/** 备份文件名里的时间戳：2026-09-20_1730。带分钟是为了连点两次导出不会重名 */
function backupStamp(){
  const d = new Date();
  return todayStr() + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
}

/* 上一次导出到哪了 —— 记下来，设置页一直显示，
   这样「导入时去哪找文件」这件事永远有答案，不用靠记 */
const LAST_BACKUP_KEY = 'ledger.lastBackup';

function rememberBackupPath(where){
  const dir = (where && /[\/\\]/.test(where)) ? where.replace(/[^\/\\]+$/, '') : (where || '');
  try{
    localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({ path: where, dir: dir, at: Date.now() }));
  }catch(e){}
  renderBackupHint();
}

function lastBackup(){
  try{
    const d = JSON.parse(localStorage.getItem(LAST_BACKUP_KEY) || 'null');
    return (d && typeof d === 'object') ? d : null;
  }catch(e){ return null; }
}

function exportData(){
  const payload = backupPayload();
  const fname   = '记账备份_' + backupStamp() + '.json';

  // Android 壳：交给原生落盘，写完回调 window.__ledgerExportDone
  if(window.LedgerNative && LedgerNative.saveBackup){
    toast('正在导出…');
    try{
      LedgerNative.saveBackup(payload, fname);
    }catch(e){
      toast('导出没成功，可以改用「备份文本」');
    }
    return;
  }

  // 浏览器：正常下载
  try{
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('已导出到浏览器的下载目录：' + fname, 3200);
    rememberBackupPath('下载（浏览器）/' + fname);
  }catch(e){
    toast('导出没成功，可以改用「备份文本」');
  }
}

/** 壳把文件写完后回调这里 */
window.__ledgerExportDone = function(ok, where){
  if(ok){
    rememberBackupPath(where);
    toast('已导出到 ' + where, 3600);
  }else{
    toast('导出失败：' + where, 3600);
  }
};

/** 设置页里三行跟备份有关的小字，永远指向"上次存哪了" */
function renderBackupHint(){
  const d = lastBackup();
  const dir = d && d.dir ? d.dir : '';
  const v = $('setExportVal');
  if(v) v.textContent = dir ? ('上次存到 ' + dir) : '存成 JSON 文件 ›';
  const f = $('setFolderVal');
  if(f) f.textContent = (dir && dir.indexOf('下载（浏览器）') < 0) ? dir : '下载 / 记账本 ›';
}

/** 把一份备份合并进当前数据库。文件导入 / 粘贴导入都走这里。 */
function mergeBackup(d){
  if(!d || !Array.isArray(d.records)) throw new Error('bad');

  const map = new Map(DB.records.map(r => [r.id, r]));
  d.records.forEach(r => { if(r && r.id) map.set(r.id, r); });
  DB.records = Array.from(map.values());

  // 账本：按 id 合并，导入后保证每条记录都有归属
  if(Array.isArray(d.books)){
    d.books.forEach(b => {
      if(b && b.id && !DB.books.some(x => x.id === b.id)) DB.books.push(b);
    });
  }
  // 没标账本的记录往哪放：优先放进备份自己声明的当前账本，其次第一本。
  // 为什么要这样：导入一份「单账本时代」的旧备份时，记录里没有 book 字段，
  // 如果一律丢进第一本，而备份声明的当前账本又是另一本，用户导入后会看到空账本。
  const defId = (d.curBook && DB.books.some(b => b.id === d.curBook))
    ? d.curBook
    : DB.books[0].id;
  DB.records.forEach(r => {
    if(!r.book || !DB.books.some(b => b.id === r.book)) r.book = defId;
  });
  if(d.budget && typeof d.budget === 'object'){
    DB.budget = Object.assign(DB.budget, d.budget);
  }
  if(d.curBook && DB.books.some(b => b.id === d.curBook)){
    DB.curBook = d.curBook;
  }

  if(d.quotes && Array.isArray(d.quotes.custom)){
    const seen = new Set(DB.quotes.custom.map(q => q.text));
    d.quotes.custom.forEach(q => {
      if(q && q.text && !seen.has(q.text)) DB.quotes.custom.push(q);
    });
  }

  Store.save();
  renderBookBtn(); renderHome(); renderSettings(); renderAllList();
  return d.records.length;
}

function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const n = mergeBackup(JSON.parse(reader.result));
      toast('已导入 ' + n + ' 条');
    }catch(e){
      toast('这个文件不是记账本导出的备份');
    }
  };
  reader.readAsText(file);
}

/** 从粘贴的文本 / 壳读出来的文件内容导入。isFile 只影响出错时的措辞。 */
function importFromText(text, isFile){
  let n;
  try{
    n = mergeBackup(JSON.parse(String(text || '').trim()));
  }catch(e){
    toast(isFile ? '这个文件不是记账本导出的备份' : '这段内容不是有效的备份');
    return false;
  }
  if($('backupPop').classList.contains('is-on')){
    $('backupPaste').value = '';
    $('backupPop').classList.remove('is-on');
  }
  toast('已导入 ' + n + ' 条');
  return true;
}

/* ── 壳的回调：文件读出来了 / 读失败 / 用户取消了 ── */
window.__ledgerImportText = function(text){ importFromText(text, true); };
window.__ledgerImportFail = function(msg){ toast('读不了这个文件：' + msg, 3600); };
window.__ledgerImportCancel = function(){};

/** 把当前全部数据复制到剪贴板（文本形式） */
function copyBackupText(){
  const text = backupPayload();
  const done = () => toast('已复制，粘到哪都行', 2600);
  const fail = () => {
    // 剪贴板 API 不给用时，退回老办法：写进文本框让用户长按复制
    $('backupPaste').value = text;
    $('backupPaste').select();
    toast('已显示在下面的框里，长按全选复制', 3200);
  };

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopy(text) ? done() : fail();
    });
    return;
  }
  fallbackCopy(text) ? done() : fail();
}

/** 老式复制：file:// 下部分浏览器禁了 Clipboard API，这个通常还能用 */
function fallbackCopy(text){
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }catch(e){
    return false;
  }
}



function pickDate(){
  const el = $('dateInput');
  el.value = curDate;
  if(el.showPicker){ try{ el.showPicker(); return; }catch(e){} }
  el.click();
}

// 手机输入法会盖住底部按钮：用 visualViewport 算出它占多高，把弹窗顶上去
function watchKeyboard(){
  const vv = window.visualViewport;
  if(!vv) return;
  const apply = () => {
    const gap = window.innerHeight - vv.height - vv.offsetTop;
    $('sheetLayer').style.paddingBottom = gap > 80 ? (gap + 'px') : '';
  };
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  apply();
}


/* ────────────────────────────────────────────────────────────
   ⑳ 事件绑定
   ──────────────────────────────────────────────────────────── */
function bindEvents(){

  /* 底部 Tab */
  $('tabbar').addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if(b) switchTab(b.dataset.tab);
  });

  /* 首页 —— 右上角：切换账本 */
  $('btnBook').addEventListener('click', () => {
    renderBookPop();
    $('bookPop').classList.add('is-on');
  });
  $('bookPopList').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-book]');
    if(editBtn){
      e.stopPropagation();
      openBookEdit(editBtn.dataset.editBook);
      return;
    }
    const row = e.target.closest('[data-book]');
    if(!row) return;
    $('bookPop').classList.remove('is-on');
    switchBook(row.dataset.book);
  });
  $('btnNewBook').addEventListener('click', () => {
    $('newBookName').value = '';
    $('newBookNote').value = '';
    newBookIcon = '📘';
    renderIconGrid($('newBookIcons'), newBookIcon, i => { newBookIcon = i; });
    $('bookAddPop').classList.add('is-on');
    setTimeout(() => $('newBookName').focus(), 260);
  });
  $('newBookKind').addEventListener('click', e => {
    const b = e.target.closest('button');
    if(!b) return;
    newBookKind = b.dataset.k;
    Array.prototype.forEach.call($('newBookKind').children, c =>
      c.classList.toggle('is-on', c === b));
    renderKindHint();
  });
  $('newBookOk').addEventListener('click', createBook);
  $('newBookName').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); $('newBookNote').focus(); }
  });
  $('newBookNote').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); createBook(); }
  });
  $('bookSaveBtn').addEventListener('click', saveBookEdit);
  $('bookUseBtn').addEventListener('click', () => {
    if(editBookId) switchBook(editBookId);
    $('bookEditPop').classList.remove('is-on');
  });
  $('bookDelBtn').addEventListener('click', () => deleteBookEdit());
  $('bookNameInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); $('bookNoteInput').focus(); }
  });
  $('bookNoteInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); saveBookEdit(); }
  });

  /* 首页 —— 点激励语换一条 */
  $('greetQuote').addEventListener('click', () => {
    pickQuote();
    $('greetQuote').textContent = curQuote;
  });

  /* 首页 —— 头像 */
  $('btnAvatar').addEventListener('click', () => $('fileAvatar').click());

  /* 首页 —— 预算卡：切月份 / 设预算 */
  $('budMonthBtn').addEventListener('click', () => {
    const el = $('budMonthInput');
    el.value = budMonth;
    if(el.showPicker){ try{ el.showPicker(); return; }catch(e){} }
    el.click();
  });
  $('budMonthInput').addEventListener('change', e => {
    if(!e.target.value) return;
    budMonth = e.target.value;
    renderHome();
  });
  $('btnSetBudget').addEventListener('click', () => {
    askInput('设置 ' + monthText(budMonth) + ' 的支出预算', DB.budget[budMonth] || '', v => {
      const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
      if(!(n > 0)){ toast('填个大于 0 的金额'); return; }
      DB.budget[budMonth] = Math.round(n * 100) / 100;
      Store.save();
      renderHome();
      toast(budMonth === curMonthStr() ? '预算已设好，进度条见卡片下方' : '预算已保存');
    });
  });

  /* 首页 —— 点流水改一笔 */
  $('recList').addEventListener('click', e => {
    const el = e.target.closest('.rec');
    if(!el) return;
    const rec = DB.records.find(r => r.id === el.dataset.id);
    if(rec) openSheet(rec);
  });

  /* 全部明细 / 类目明细 —— 点一条也能改 */
  $('allList').addEventListener('click', e => {
    const el = e.target.closest('.rec');
    if(!el) return;
    const rec = DB.records.find(r => r.id === el.dataset.id);
    if(rec) openSheet(rec);
  });
  $('catPageList').addEventListener('click', e => {
    const el = e.target.closest('.rec');
    if(!el) return;
    const rec = DB.records.find(r => r.id === el.dataset.id);
    if(rec) openSheet(rec);
  });

  /* 首页 —— 更多 / 打开记一笔 */
  $('btnMoreRec').addEventListener('click', () => {
    $('fTimeRow').style.display = isPoolBook() ? 'none' : '';
    renderAllList();
    openSub('subAll');
  });
  $('btnAdd').addEventListener('click', () => openSheet(null));

  /* 统计页 —— 点「支出构成」某一行 → 跳类目明细页（自动带月份 × 类目） */
  $('stCatList').addEventListener('click', e => {
    const row = e.target.closest('.cat-row');
    if(!row || !row.dataset.cat) return;
    openCatFilter(row.dataset.type, row.dataset.cat);
  });

  /* 二级页面 —— 返回 */
  document.querySelectorAll('.sub').forEach(sub => {
    sub.addEventListener('click', e => {
      if(e.target.closest('[data-back]')) closeSub(sub);
    });
  });

  /* 全部明细 —— 筛选（时间 / 类目两个下拉 + 关键字 + 收支 chips + 日期输入行） */
  const fUI = { label:$('fTimeLabel'), customRow:$('fCustomRow'), from:$('fFrom'), to:$('fTo') };
  const cUI = { label:$('cTimeLabel'), customRow:$('cCustomRow'), from:$('cFrom'), to:$('cTo') };

  $('fKeyword').addEventListener('input', e => { filter.kw = e.target.value; renderAllList(); });
  $('fTimeBtn').addEventListener('click', () => {
    ddRender($('fTimeList'), timeDDOptions(), filter.dd,
      v => { applyTimeVal(filter, v, fUI); renderAllList(); });
  });
  $('fCatBtn').addEventListener('click', () => {
    ddRender($('fCatList'), catDDOptions(), 'cat:' + (filter.kind === 'income' ? 'i' : 'e') + ':' + filter.cat,
      v => { $('fCatLabel').textContent = applyCatVal(filter, v, '#subAll'); renderAllList(); });
  });
  $('fFrom').addEventListener('change',  e => { filter.from = e.target.value; renderAllList(); });
  $('fTo').addEventListener('change',    e => { filter.to = e.target.value; renderAllList(); });
  $('fReset').addEventListener('click', () => {
    filter.kw = ''; filter.kind = 'all'; filter.cat = '';
    filter.range = 'all'; filter.month = curMonthStr(); filter.from = ''; filter.to = ''; filter.dd = 'all';
    $('fKeyword').value = ''; $('fTimeLabel').textContent = '全部时间';
    $('fCatLabel').textContent = '全部类目'; $('fCustomRow').hidden = true;
    $('fFrom').value = ''; $('fTo').value = '';
    Array.prototype.forEach.call(document.querySelectorAll('#subAll .f-chip'), c =>
      c.classList.toggle('is-on', c.dataset.kind === 'all'));
    renderAllList();
  });
  document.querySelector('#subAll .filter-bar').addEventListener('click', e => {
    const chip = e.target.closest('.f-chip');
    if(!chip) return;
    filter.kind = chip.dataset.kind;
    // 换了收支方向，原类目可能属于另一边，一并清掉
    if(filter.cat && findCat(filter.kind, filter.cat)?.type !== filter.kind){
      filter.cat = '';
      $('fCatLabel').textContent = '全部类目';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#subAll .f-chip'), c =>
      c.classList.toggle('is-on', c === chip));
    renderAllList();
  });

  /* 类目明细页（subCat）—— 筛选 */
  $('cKeyword').addEventListener('input', e => { catFilter.kw = e.target.value; renderCatPage(); });
  $('cTimeBtn').addEventListener('click', () => {
    ddRender($('cTimeList'), timeDDOptions(), catFilter.dd,
      v => { applyTimeVal(catFilter, v, cUI); $('subCatTitle').textContent = subCatTitle(); renderCatPage(); });
  });
  $('cCatBtn').addEventListener('click', () => {
    ddRender($('cCatList'), catDDOptions(), 'cat:' + (catFilter.kind === 'income' ? 'i' : 'e') + ':' + catFilter.cat,
      v => { $('cCatLabel').textContent = applyCatVal(catFilter, v, '#subCat'); $('subCatTitle').textContent = subCatTitle(); renderCatPage(); });
  });
  $('cFrom').addEventListener('change', e => { catFilter.from = e.target.value; renderCatPage(); });
  $('cTo').addEventListener('change',   e => { catFilter.to = e.target.value; renderCatPage(); });
  $('cReset').addEventListener('click', () => {
    catFilter.kw = ''; catFilter.cat = '';
    catFilter.range = isPoolBook() ? 'all' : 'month';
    catFilter.month = statMonth; catFilter.from = ''; catFilter.to = '';
    catFilter.dd = isPoolBook() ? 'all' : ('m' + statMonth);
    syncCatUI(true);
    renderCatPage();
  });
  document.querySelector('#subCat .filter-bar').addEventListener('click', e => {
    const chip = e.target.closest('.f-chip');
    if(!chip) return;
    catFilter.kind = chip.dataset.kind;
    if(catFilter.cat && findCat(catFilter.kind, catFilter.cat)?.type !== catFilter.kind){
      catFilter.cat = '';
      $('cCatLabel').textContent = '全部类目';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#subCat .f-chip'), c =>
      c.classList.toggle('is-on', c === chip));
    syncCatUI(false);
    renderCatPage();
  });

  /* 下拉开合（点击按钮展开/收起，点浮层外面自动收） */
  [['fTimeBtn','fTimeList'], ['fCatBtn','fCatList'], ['cTimeBtn','cTimeList'], ['cCatBtn','cCatList']]
  .forEach(([btnId, listId]) => {
    $(btnId).addEventListener('click', e => {
      e.stopPropagation();
      const list = $(listId), wasHidden = list.hidden;
      closeAllDD();
      list.hidden = !wasHidden;
    });
  });
  document.addEventListener('click', e => {
    if(!e.target.closest('.dd')) closeAllDD();
  });

  /* 激励池 —— 开关 / 删除 / 新增 */
  $('setQuotes').addEventListener('click', () => {
    renderQuotesPage();
    openSub('subQuotes');
  });
  $('quoteList').addEventListener('click', e => {
    const del = e.target.closest('[data-del-quote]');
    if(del){
      const id = del.dataset.delQuote;
      DB.quotes.custom = DB.quotes.custom.filter(q => q.id !== id);
      Store.save(); renderQuotePage(); toast('已删除');
      return;
    }
    const sw = e.target.closest('.switch');
    if(!sw) return;
    const row = sw.closest('.quote-item');
    if(row.dataset.builtin != null){
      const t = row.dataset.builtin;
      const i = DB.quotes.off.indexOf(t);
      if(i >= 0) DB.quotes.off.splice(i, 1); else DB.quotes.off.push(t);
    }else{
      const q = DB.quotes.custom.find(x => x.id === sw.dataset.quoteId);
      if(q) q.on = (q.on === false);
    }
    Store.save();
    renderQuotePage();
    pickQuote();
    renderQuoteHome();
  });
  $('btnAddQuote').addEventListener('click', () => {
    askInput('新增一条激励语', '', txt => {
      const t = String(txt || '').trim();
      if(!t){ toast('写点什么吧'); return; }
      if(QUOTES_BUILTIN.indexOf(t) >= 0 || DB.quotes.custom.some(q => q.text === t)){
        toast('这条已经有了');
        return;
      }
      DB.quotes.custom.push({ id: uid(), text: t, on: true });
      Store.save();
      renderQuotePage();
      pickQuote();
      renderQuoteHome();
      toast('已添加，会排在激励池最前面');
    });
  });

  /* 设置 —— 主题上传 / 切换 / 删除 */
  $('themeGrid').addEventListener('click', e => {
    const del = e.target.closest('[data-del-theme]');
    if(del){
      if(!confirm('删掉这套自制主题吗？')) return;
      removeCustomTheme(del.dataset.delTheme);
      return;
    }
    const it = e.target.closest('[data-theme-id]');
    if(it) setTheme(it.dataset.themeId);
  });
  $('btnUploadTheme').addEventListener('click', () => $('fileTheme').click());
  /* 点尾部的下拉箭头：展开 / 收起制作说明（不触发选图） */
  $('btnThemeTip').addEventListener('click', () => {
    const tip = $('themeTip');
    tip.hidden = !tip.hidden;
    $('btnThemeTip').classList.toggle('is-open', !tip.hidden);
  });
  $('fileTheme').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(f) handleThemeFile(f);
    e.target.value = '';
  });

  /* 设置 —— 账本管理：点某本账进编辑；「删」快捷删除（不用先进编辑浮层） */
  $('bookManageList').addEventListener('click', e => {
    const del = e.target.closest('[data-del-book]');
    if(del){ deleteBookEdit(del.dataset.delBook); return; }
    const row = e.target.closest('[data-manage-book]');
    if(row) openBookEdit(row.dataset.manageBook);
  });

  /* 设置 —— 头像 / 备份 */
  $('setAvatar').addEventListener('click', () => $('fileAvatar').click());
  $('fileAvatar').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(f) handleAvatarFile(f);
    e.target.value = '';
  });
  $('setExport').addEventListener('click', exportData);

  // 导入：壳里走原生文件选择器（一打开就停在「下载 / 记账本」），
  // 浏览器里走 <input type="file">
  $('setImport').addEventListener('click', () => {
    if(window.LedgerNative && LedgerNative.pickBackup){
      toast('选那个「记账备份_…json」', 2600);
      LedgerNative.pickBackup();
    }else{
      $('fileImport').click();
    }
  });
  $('fileImport').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(f) importData(f);
    e.target.value = '';
  });
  $('setOpenFolder').addEventListener('click', () => {
    if(window.LedgerNative && LedgerNative.openBackupFolder) LedgerNative.openBackupFolder();
    else toast('浏览器里请到「下载」目录找备份文件', 3200);
  });
  $('setBackupText').addEventListener('click', () => {
    $('backupPaste').value = '';
    $('backupPop').classList.add('is-on');
  });
  $('backupCopy').addEventListener('click', copyBackupText);
  $('backupImport').addEventListener('click', () => importFromText($('backupPaste').value));
  $('setClearDemo').addEventListener('click', () => {
    const n = DB.records.filter(r => r.demo).length;
    if(!n){ toast('没有示例数据了'); return; }
    DB.records = DB.records.filter(r => !r.demo);
    Store.save();
    renderHome(); renderStats(); renderAllList();
    toast('已清掉 ' + n + ' 条示例');
  });

  /* 统计页 —— 月份 / 支出收入切换 */
  $('stPrev').addEventListener('click', () => { statMonth = shiftMonthStr(statMonth, -1); renderStats(); });
  $('stNext').addEventListener('click', () => { statMonth = shiftMonthStr(statMonth,  1); renderStats(); });
  $('stTypeSeg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if(!b) return;
    statType = b.dataset.t;
    renderStats();
  });

  /* 记一笔 */
  $('btnClose').addEventListener('click', closeSheet);
  $('sheetMask').addEventListener('click', closeSheet);
  $('typeSeg').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if(!btn) return;
    curType = btn.dataset.type;
    if(!findCat(curType, curCat)){ curCat = null; catLocked = false; }
    renderTypeSeg();
    syncEntry();
  });

  $('btnDate').addEventListener('click', pickDate);
  $('dateInput').addEventListener('change', () => {
    if($('dateInput').value){ curDate = $('dateInput').value; renderDateRow(); }
  });
  $('entryInput').addEventListener('input', syncEntry);
  $('entryInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); saveRecord(); }
  });
  $('btnNote').addEventListener('click', () => {
    const on = !$('noteRow').classList.contains('is-on');
    $('noteRow').classList.toggle('is-on', on);
    if(on) setTimeout(() => $('noteInput').focus(), 60);
  });
  $('noteInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); saveRecord(); }
  });
  $('parseChip').addEventListener('click', () => $('catPills').classList.toggle('is-on'));
  $('catPills').addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if(!btn) return;
    curCat = btn.dataset.k;
    catLocked = true;
    renderParseRow();
    renderCatPills();
  });
  $('btnSave').addEventListener('click', saveRecord);
  $('btnDelete').addEventListener('click', deleteRecord);

  /* 提示条：撤销 */
  $('toast').addEventListener('click', () => {
    if(undoAction){
      const fn = undoAction;
      undoAction = null;
      $('toast').classList.remove('is-on', 'has-undo');
      clearTimeout(toastTimer);
      fn();
    }
  });

  /* 浮层：确定 / 关闭 */
  $('askOk').addEventListener('click', () => {
    const v = $('askInput').value;
    const cb = askCallback;
    closeAsk();
    if(cb) cb(v);
  });
  $('askInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); $('askOk').click(); }
  });
  document.querySelectorAll('[data-pop-close]').forEach(el => {
    el.addEventListener('click', () => {
      closeAsk();
      document.querySelectorAll('.pop-layer.is-on').forEach(p => p.classList.remove('is-on'));
    });
  });

  /* 电脑上按 Esc 关掉一切 */
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if($('askPop').classList.contains('is-on')) return closeAsk();
    const openPop = document.querySelector('.pop-layer.is-on');
    if(openPop) return openPop.classList.remove('is-on');
    if($('sheetLayer').classList.contains('is-on')) return closeSheet();
    const open = document.querySelector('.sub.is-on');
    if(open) closeSub(open);
  });

  window.addEventListener('resize', syncTw);
  watchKeyboard();
}


/* ────────────────────────────────────────────────────────────
   ㉑ 启动
   ──────────────────────────────────────────────────────────── */
function init(){
  DB = Store.load();
  if(!Array.isArray(DB.themes)) DB.themes = [];

  // 第一次打开：塞几条示例数据，让你先看到完整效果
  if(!DB.seeded){
    DB.seeded = true;
    if(!DB.records.length) DB.records = seedDemo();
    Store.save();
  }

  statMonth = curMonthStr();
  budMonth  = curMonthStr();
  filter.month = statMonth;

  applyTheme(DB.theme);
  bindEvents();
  pickQuote();
  renderBookBtn();
  renderHome();
  renderSettings();
  renderAllList();

  $('fCustomRow').hidden = true;       // 自定义区间输入行默认收起
  $('cCustomRow').hidden = true;

  syncTw();
  lockHScroll();
}

init();


/* ────────────────────────────────────────────────────────────
   ㉒ Android 返回键
   ------------------------------------------------------------
   装进 Android 壳之后，物理返回键 / 侧滑返回会调用这个函数。
   顺序是「从最上层的浮层往下退」：
       提示框 → 主题浮层 → 记一笔弹窗 → 二级页 → 非首页 tab
   全都没得退就返回 false，交给原生把 App 收到后台。

   用手机浏览器打开时这个函数不会被调用，没有任何副作用。
   ──────────────────────────────────────────────────────────── */
window.__ledgerBack = function(){
  if($('askPop').classList.contains('is-on'))     { closeAsk();  return true; }

  const openPop = document.querySelector('.pop-layer.is-on');
  if(openPop)                                     { openPop.classList.remove('is-on'); return true; }

  if($('sheetLayer').classList.contains('is-on')) { closeSheet(); return true; }

  // 二级页可能叠着开（以后万一），从最后打开的往回关
  const subs = document.querySelectorAll('.sub.is-on');
  if(subs.length) { closeSub(subs[subs.length - 1]); return true; }

  if(curTab !== 'home'){ switchTab('home'); return true; }

  return false;
};


/* 给自动化测试用的后门，不影响使用 */
window.__ledger = {
  parseEntry, guessCat, CATS, QUOTES_BUILTIN, THEME_SPEC,
  timeDDOptions, catDDOptions, BOOK_ICONS, fitNum,
  greetWord, fmt, fmtShort, shiftMonthStr, monthText,
  isPoolBook, bookRecs, curBook,
  backupPayload, mergeBackup, importFromText, exportData,
  backupStamp, rememberBackupPath, lastBackup, LAST_BACKUP_KEY,
  get DB(){ return DB; },
  Store
};
