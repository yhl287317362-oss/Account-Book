/* ============================================================
   浏览器端渲染自检（配合 test/run-test.js 的 jsdom 逻辑回归）
   ------------------------------------------------------------
   run-test.js  负责「算得对不对」——纯逻辑，跑得快
   本文件        负责「长得对不对」——真实布局、尺寸、遮挡、切图、能不能横拖
                 （jsdom 不做布局，getBoundingClientRect 全是 0，所以这些只能在这里测）

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/render-check.js

   可选：给一个主题图路径当参数，会顺便验证「上传主题 → 各块切图位置对不对」
     ... node test/render-check.js "C:/path/to/主题图.png"
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { chromium } = require('playwright-core');

const DIR  = path.join(__dirname, '..');
const OUT  = os.tmpdir();
const THEME_IMG = process.argv[2] || null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8'
};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else      { fail++; console.log('  ✗ ' + name + (extra ? '   → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(DIR, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const TW = await page.evaluate(() => document.getElementById('app').clientWidth);
  console.log('   （视口 390 × 844，App 宽 --tw = ' + TW + 'px）');

  /* ── 1. 三个 Tab 能切，页面不报错 ── */
  head('1. 三个 Tab');
  for (const [tab, id] of [['home','pageHome'],['stats','pageStats'],['settings','pageSettings']]) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(350);
    const on = await page.evaluate(i => document.getElementById(i).classList.contains('is-on'), id);
    ok(tab + ' 能翻开', on);
  }

  /* ── 2. 横向拖拽：必须拖不动 ──
     滑出式二级页若不在 #app 内，translateX(100%) 会撑宽视口滚动区。
     ★ 不能用 scrollWidth 判断 —— html{overflow-x:hidden} 会把它压成假象，
       必须真的 scrollTo 一下再读 scrollX。 */
  head('2. 横向能不能拖出空白');
  await page.evaluate(() => window.scrollTo(200, 0));
  await page.waitForTimeout(200);
  const sx = await page.evaluate(() => window.scrollX);
  ok('window.scrollX 归零（页面拖不动）', sx === 0, 'scrollX=' + sx);
  const floats = await page.evaluate(() => {
    const app = document.getElementById('app');
    return ['subAll','subQuotes','subCat','sheetLayer','bookPop','askPop']
      .filter(id => { const el = document.getElementById(id); return !el || !app.contains(el); });
  });
  ok('浮层都在 #app 内部（越界的：' + (floats.join(',') || '无') + '）', floats.length === 0);

  /* ── 3. 头像：必须是正圆，不能裁掉左右 ──
     曾经踩过：.avatar-btn 写成 display:flex，里面的 img 被当成可收缩的 flex item
     压成 30×40（宽高比 0.75），object-fit:cover 再按宽度裁一刀 → 手机上圆被切两边。
     jsdom 测不出尺寸，只能在这儿量。 */
  head('3. 头像（正方形头像必须完整显示成圆）');
  {
    const dataUrl = await page.evaluate(() => {
      const S = 200, cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const x = cv.getContext('2d');
      x.fillStyle = '#0ea5e9'; x.fillRect(0, 0, S, S);
      x.fillStyle = '#f43f5e';
      x.fillRect(0, 0, 24, 24); x.fillRect(S - 24, 0, 24, 24);
      x.fillRect(0, S - 24, 24, 24); x.fillRect(S - 24, S - 24, 24, 24);
      x.fillStyle = '#facc15'; x.beginPath(); x.arc(S / 2, S / 2, 62, 0, 7); x.fill();
      return cv.toDataURL('image/png');
    });
    const avatarFile = path.join(OUT, 'rc_avatar.png');
    fs.writeFileSync(avatarFile, Buffer.from(dataUrl.split(',')[1], 'base64'));

    await page.click('[data-tab="home"]');
    await page.waitForTimeout(300);
    await page.setInputFiles('#fileAvatar', avatarFile);
    await page.waitForTimeout(900);

    const av = await page.evaluate(() => {
      const btn = document.getElementById('btnAvatar');
      const img = document.getElementById('avatarImg');
      const ph  = document.getElementById('avatarPh');
      const b = btn.getBoundingClientRect(), i = img.getBoundingClientRect();
      return {
        btnW: b.width, btnH: b.height,
        imgW: i.width, imgH: i.height,
        offL: i.left - b.left, offT: i.top - b.top,
        disp: getComputedStyle(img).display,
        phDisp: getComputedStyle(ph).display,
        natural: img.naturalWidth + '×' + img.naturalHeight
      };
    });

    ok('头像已是自定义图（img 显示、占位 emoji 收起）',
       av.disp !== 'none' && av.phDisp === 'none', av.disp + ' / ' + av.phDisp);
    ok('上传的方图被裁成了正方形（存储 ' + av.natural + '）', av.natural.split('×')[0] === av.natural.split('×')[1]);
    ok('按钮是正方形 ' + av.btnW.toFixed(0) + '×' + av.btnH.toFixed(0),
       near(av.btnW, av.btnH, 0.5));
    ok('★ 头像渲染成正方形（不能裁左右）：' + av.imgW.toFixed(1) + '×' + av.imgH.toFixed(1),
       near(av.imgW, av.imgH, 0.5), '宽高比 ' + (av.imgW / av.imgH).toFixed(3) + '（1.000 才对）');
    ok('头像铺满按钮内圈（' + av.btnW.toFixed(0) + ' − 2×2 边框 = ' + (av.btnW - 4).toFixed(0) + '）',
       near(av.imgW, av.btnW - 4, 0.6), av.imgW.toFixed(1) + ' vs ' + (av.btnW - 4));
    ok('头像在按钮里居中',
       near(av.offL, av.offT, 0.6) && av.offL > 0,
       '偏移 ' + av.offL.toFixed(1) + ' / ' + av.offT.toFixed(1));
  }

  /* ── 4. 流水：整页一起滚，首页只有 8 条 ──
     曾经踩过：流水是 overscroll-behavior:contain 的独立滚动小窗，
     手指在里面往上滑会被 contain 吃掉，翻不动整页。 */
  head('4. 流水版块（取消内滚）');
  await page.click('[data-tab="home"]');
  await page.waitForTimeout(400);
  {
    const r = await page.evaluate(() => {
      const l = document.getElementById('recList');
      let el = l.parentElement, ancestor = null;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') { ancestor = el.id || el.className; break; }
        el = el.parentElement;
      }
      return {
        hasOld: !!document.getElementById('flowScroll'),
        count: l.querySelectorAll('.rec').length,
        ancestor,
        hint: document.getElementById('flowHint').textContent,
        hintHidden: document.getElementById('flowHint').hidden,
        total: document.querySelectorAll('#recList .rec').length
      };
    });
    ok('旧的独立滚动窗已移除', !r.hasOld);
    ok('流水的滚动容器就是整个首页（不是嵌套小窗）', r.ancestor === 'bodyHome', r.ancestor);
    ok('首页最多渲染 8 条（实际 ' + r.count + '）', r.count <= 8, r.count + ' 条');
    ok('还有更多时给了提示：「' + (r.hint || '') + '」',
       !r.hintHidden && /还有 \d+ 笔/.test(r.hint), r.hint);
  }
  /* 整页真的能一直往上滑（首页内容比一屏高） */
  const scrollable = await page.evaluate(() => {
    const s = document.getElementById('bodyHome');
    s.scrollTop = 99999;
    const top = s.scrollTop;
    s.scrollTop = 0;
    return { max: top, client: s.clientHeight, content: s.scrollHeight };
  });
  ok('首页整体可滚动（内容 ' + scrollable.content + ' > 可视 ' + scrollable.client + '，可滚 ' + scrollable.max + 'px）',
     scrollable.max > 0);

  /* ── 5. 首页滚到底，悬浮「＋」按钮不挡内容 ── */
  head('5. 悬浮「＋」按钮 vs 内容');
  await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 99999; });
  await page.waitForTimeout(400);
  const fabVsLast = await page.evaluate(() => {
    const fab = document.querySelector('.fab').getBoundingClientRect();
    const cards = document.querySelectorAll('#bodyHome .card');
    const last = cards[cards.length - 1].getBoundingClientRect();
    return { fabTop: fab.top, lastBottom: last.bottom };
  });
  ok('滚到底后最后一张卡完全露出', fabVsLast.lastBottom < fabVsLast.fabTop,
     '卡底 ' + fabVsLast.lastBottom.toFixed(0) + ' vs 按钮顶 ' + fabVsLast.fabTop.toFixed(0));
  await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'render_home.png') });

  /* ── 6. 冻结区：只有头像/问候/主题不动，收支卡要能滚走 ── */
  head('6. 首页冻结区范围');
  {
    const before = await page.evaluate(() => ({
      hero: document.querySelector('.hero').getBoundingClientRect().top,
      sum:  document.querySelector('.budget-card').getBoundingClientRect().top
    }));
    await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 300; });
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => ({
      hero: document.querySelector('.hero').getBoundingClientRect().top,
      sum:  document.querySelector('.budget-card').getBoundingClientRect().top
    }));
    ok('冻结条（头像/问候/主题）纹丝不动', near(before.hero, after.hero, 0.5),
       before.hero.toFixed(0) + ' → ' + after.hero.toFixed(0));
    ok('★ 顶部预算卡跟着内容滚走了', after.sum < before.sum - 100,
       before.sum.toFixed(0) + ' → ' + after.sum.toFixed(0));
    ok('「支出预算卡 / 资产卡」在滚动区里（不在冻结条内）',
       await page.evaluate(() => document.getElementById('bodyHome').contains(document.querySelector('.budget-card')) &&
                                document.getElementById('bodyHome').contains(document.querySelector('.pool-card'))));
    await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 0; });
    await page.waitForTimeout(250);
  }

  /* ── 7. 装了主题之后：五块区域的落位与切图坐标 ── */
  if (THEME_IMG && fs.existsSync(THEME_IMG)) {
    head('7. 主题图：五块区域');
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(400);
    await page.setInputFiles('#fileTheme', THEME_IMG);
    await page.waitForTimeout(1200);
    await page.fill('#askInput', '自检主题');
    await page.click('#askOk');
    await page.waitForTimeout(1400);
    ok('主题已应用', await page.evaluate(() => document.documentElement.classList.contains('has-theme')));

    const meta = await page.evaluate(() => {
      const spec = window.__ledger.THEME_SPEC;
      const tw = document.getElementById('app').clientWidth;
      const imgw = Number(getComputedStyle(document.documentElement).getPropertyValue('--timgw')) || spec.w;
      const k = tw / imgw;                       // 图上像素 → 屏幕像素
      return { spec, tw, imgw, k };
    });
    console.log('   （规格 ' + meta.spec.w + '×' + meta.spec.h + '，图宽 ' + meta.imgw +
                '，缩放 k = ' + meta.k.toFixed(4) + '）');

    const posY = s => parseFloat((s || '0px 0px').split(/\s+/)[1]) || 0;

    /* ①②③ 三条背景：按屏宽等比，起点分别对准 0 / 200 / 760 */
    const bands = await page.evaluate(() => ({
      hero:  getComputedStyle(document.querySelector('.hero')).backgroundPosition,
      stats: getComputedStyle(document.querySelector('#pageStats .stats-top')).backgroundPosition,
      foot:  getComputedStyle(document.querySelector('.deco-footer')).backgroundPosition,
      footSize: getComputedStyle(document.querySelector('.deco-footer')).backgroundSize
    }));
    const yHero  = 0, yStats = meta.spec.zones[1].y, yFoot = meta.spec.zones[2].y;
    ok('① 首页顶栏从 y=0 切（' + bands.hero + '）', near(posY(bands.hero), -yHero * meta.k, 0.6));
    ok('② 统计顶栏从 y=' + yStats + ' 切 → ' + (-yStats * meta.k).toFixed(1) + 'px（' + bands.stats + '）',
       near(posY(bands.stats), -yStats * meta.k, 0.6), posY(bands.stats));
    ok('③ 底部栏从 y=' + yFoot + ' 切 → ' + (-yFoot * meta.k).toFixed(1) + 'px（' + bands.foot + '）',
       near(posY(bands.foot), -yFoot * meta.k, 0.6), posY(bands.foot));

    /* ③ 底部栏切图必须正好铺满 Tab 栏 */
    const foot = await page.evaluate(() => {
      const d = document.querySelector('.deco-footer').getBoundingClientRect();
      const t = document.querySelector('.tabbar').getBoundingClientRect();
      return { dh: d.height, tw: t.height };
    });
    ok('③ 底部栏切图与 Tab 栏等高（' + foot.dh.toFixed(0) + ' vs ' + foot.tw.toFixed(0) + '）',
       near(foot.dh, foot.tw, 1.5));

    /* ① 首页顶栏高度要正好对上图上 200 高。
       ★ 必须先切回首页再量 —— .hero 在 pageHome 里，人还停在设置页时它是 display:none，量出来是 0。 */
    await page.click('[data-tab="home"]');
    await page.waitForTimeout(500);
    const heroH = await page.evaluate(() => document.querySelector('.hero').getBoundingClientRect().height);
    ok('① 首页顶栏高度 ' + heroH.toFixed(0) + 'px ≈ 图上 200 × k = ' + (200 * meta.k).toFixed(1),
       near(heroH, 200 * meta.k, 2));

    /* 装饰层虽然整层盖在卡片上，但点击必须穿透（也顺手确认它在首页时真的存在） */
    const hitTest = await page.evaluate(() => {
      const t = document.querySelector('#cardQuick .card-title');
      const b = t.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + 24, b.top + 9);
      return hit ? (hit.className || hit.tagName) : null;
    });
    ok('点「最近常用」标题命中的是文字本身，不是装饰层（' + hitTest + '）',
       /card-title/.test(hitTest || ''), hitTest);

    /* ④⑤ 装饰层：整层铺满宽 + 顶部对齐 + 高度对 + 点击穿透 + 切图落点 */
    for (const [id, tab, zi] of [['decoHome','home',3], ['decoStatsLayer','stats',4]]) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForTimeout(500);
      const r = await page.evaluate(id => {
        const el = document.getElementById(id);
        const b  = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const host = document.getElementById('app');          // 只用来拿屏宽
        const scroller = el.parentElement;                    // .body-scroll
        const sb = scroller.getBoundingClientRect();
        return {
          w: b.width, h: b.height, top: b.top,
          scrollerTop: sb.top, scrollerW: scroller.clientWidth,
          pe: cs.pointerEvents, pos: cs.backgroundPosition, size: cs.backgroundSize,
          z: Number(cs.zIndex),
          fabZ: Number(getComputedStyle(document.querySelector('.fab')).zIndex),
          hostW: host.clientWidth
        };
      }, id);
      const zone = meta.spec.zones[zi];
      ok(id + ' 宽度铺满内容区（' + r.w.toFixed(0) + ' vs ' + r.scrollerW + '）',
         near(r.w, r.scrollerW, 1.5));
      ok(id + ' 顶部贴住滚动区顶端（' + r.top.toFixed(0) + ' vs ' + r.scrollerTop.toFixed(0) + '）',
         near(r.top, r.scrollerTop, 1.5));
      ok(id + ' 高度 = 图上 ' + zone.h + ' × k = ' + (zone.h * meta.k).toFixed(0) + 'px（实测 ' + r.h.toFixed(0) + '）',
         near(r.h, zone.h * meta.k, 1.5));
      ok(id + ' 从 y=' + zone.y + ' 切 → ' + (-zone.y * meta.k).toFixed(1) + 'px（' + r.pos + '）',
         near(posY(r.pos), -zone.y * meta.k, 0.6), posY(r.pos));
      ok(id + ' 点击穿透（不挡点卡片）', r.pe === 'none', r.pe);
      ok(id + ' 层级在卡片之上、FAB 之下（' + r.z + ' < ' + r.fabZ + '）',
         r.z > 0 && r.z < r.fabZ);
    }

    await page.click('[data-tab="home"]'); await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 0; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'render_home_theme.png') });
    await page.click('[data-tab="stats"]'); await page.waitForTimeout(600);
    await page.evaluate(() => { document.getElementById('bodyStats').scrollTop = 0; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'render_stats_theme.png') });
    await page.click('[data-tab="settings"]'); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'render_set_theme.png') });
  } else {
    head('7. 主题图');
    console.log('  · 跳过了（没给主题图路径，或文件不存在）');
  }

  /* ── 8. 页面零报错 ── */
  head('8. 页面报错');
  ok('无 JS 报错', errs.length === 0, errs.join(' | '));

  console.log('\n' + '─'.repeat(46));
  console.log((fail === 0 ? '全部通过' : '有失败项') + '：' + pass + ' 项通过，' + fail + ' 项失败');
  console.log('截图在：' + OUT + '\\render_*.png');
  console.log('─'.repeat(46));

  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
