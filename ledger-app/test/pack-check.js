/* ============================================================
   单文件交付自检（最终验收）
   ------------------------------------------------------------
   手机上打开的是「记账本-手机试看.html」这一个文件，走的是 file:// 协议。
   这个脚本就模拟那个场景：无服务器、无网络，只开这一个文件。

   要验证的：
     · 一个文件就能跑（样式 / 脚本都内联进去了）
     · 零外部请求（断网也能用）
     · localStorage 能读写（记一笔 → 关掉再开还在）
     · 横向拖不出空白
     · 这一轮改的三件事：头像正圆 / 流水只 8 条 / 冻结区只留头像问候
     · 页面零报错

   跑法（先跑 tools/pack.js，再做这个）：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" test/pack-check.js
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { chromium } = require('playwright-core');

const FILE = path.join(__dirname, '..', '..', '记账本-手机试看.html');
const OUT  = os.tmpdir();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else      { fail++; console.log('  ✗ ' + name + (extra ? '   → ' + extra : '')); }
};
const head = t => console.log('\n【' + t + '】');
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);

(async () => {
  if (!fs.existsSync(FILE)) {
    console.error('找不到单文件：' + FILE + '\n先跑 tools/pack.js');
    process.exit(1);
  }
  console.log('  单文件：' + FILE);
  console.log('  大小：' + (fs.statSync(FILE).size / 1024).toFixed(1) + ' KB');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const errs = [], reqs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) reqs.push(r.url()); });

  /* ── 1. 一个文件就能跑 ── */
  head('1. 单文件独立运行');
  await page.goto('file:///' + FILE.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const boot = await page.evaluate(() => ({
    appW: document.getElementById('app').clientWidth,
    styled: getComputedStyle(document.querySelector('.hero')).backgroundImage.indexOf('gradient') >= 0,
    tabbarH: document.querySelector('.tabbar').getBoundingClientRect().height,
    cssBlocks: document.querySelectorAll('style').length,
    scripts: document.querySelectorAll('script:not([src])').length
  }));
  ok('样式已内联生效（App 宽 ' + boot.appW + 'px，底部栏 ' + boot.tabbarH.toFixed(0) + 'px）',
     boot.appW > 300 && boot.styled && near(boot.tabbarH, 58, 2));
  ok('脚本已内联（' + boot.scripts + ' 个 <script> 块、' + boot.cssBlocks + ' 个 <style> 块）',
     boot.scripts >= 2 && boot.cssBlocks >= 1);

  await page.click('[data-tab="stats"]');
  await page.waitForTimeout(400);
  ok('JS 生效：切到统计页', await page.evaluate(() => document.getElementById('pageStats').classList.contains('is-on')));
  await page.click('[data-tab="home"]');
  await page.waitForTimeout(400);

  ok('零外部请求（断网也能用）', reqs.length === 0, reqs.slice(0, 3).join(' | '));

  /* ── 2. localStorage 能用 ── */
  head('2. 数据存在本机');
  const ls = await page.evaluate(() => {
    try {
      localStorage.setItem('__probe', '1');
      const v = localStorage.getItem('__probe');
      localStorage.removeItem('__probe');
      return { ok: true, v };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  ok('localStorage 可读写', ls.ok && ls.v === '1', JSON.stringify(ls));

  /* ── 3. 这一轮改的三件事 ── */
  head('3. 本轮改动');

  /* 3a 头像正圆 */
  {
    const dataUrl = await page.evaluate(() => {
      const S = 200, cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const x = cv.getContext('2d');
      x.fillStyle = '#0ea5e9'; x.fillRect(0, 0, S, S);
      x.fillStyle = '#facc15'; x.beginPath(); x.arc(S / 2, S / 2, 62, 0, 7); x.fill();
      return cv.toDataURL('image/png');
    });
    const f = path.join(OUT, 'pc_avatar.png');
    fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await page.setInputFiles('#fileAvatar', f);
    await page.waitForTimeout(900);
    const av = await page.evaluate(() => {
      const b = document.getElementById('btnAvatar').getBoundingClientRect();
      const i = document.getElementById('avatarImg').getBoundingClientRect();
      return { bw: b.width, iw: i.width, ih: i.height };
    });
    ok('★ 头像完整显示成圆：' + av.iw.toFixed(1) + '×' + av.ih.toFixed(1) +
       '（按钮 ' + av.bw.toFixed(0) + '，内圈 ' + (av.bw - 4).toFixed(0) + '）',
       near(av.iw, av.ih, 0.5) && near(av.iw, av.bw - 4, 0.6),
       '宽高比 ' + (av.iw / av.ih).toFixed(3));
  }

  /* 3b 流水只 8 条 + 不内滚 */
  {
    const r = await page.evaluate(() => {
      const l = document.getElementById('recList');
      let el = l.parentElement, anc = null;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') { anc = el.id; break; }
        el = el.parentElement;
      }
      return { n: l.querySelectorAll('.rec').length, anc, old: !!document.getElementById('flowScroll') };
    });
    ok('★ 流水最多 8 条（' + r.n + '），滚动容器是整个首页（' + r.anc + '）',
       r.n <= 8 && r.anc === 'bodyHome' && !r.old);
  }

  /* 3c 冻结区只留头像/问候/主题 */
  {
    const a = await page.evaluate(() => ({
      hero: document.querySelector('.hero').getBoundingClientRect().top,
      sum:  document.querySelector('.budget-card').getBoundingClientRect().top
    }));
    await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 260; });
    await page.waitForTimeout(350);
    const b = await page.evaluate(() => ({
      hero: document.querySelector('.hero').getBoundingClientRect().top,
      sum:  document.querySelector('.budget-card').getBoundingClientRect().top
    }));
    ok('★ 冻结条不动（' + a.hero.toFixed(0) + ' → ' + b.hero.toFixed(0) +
       '），收支卡滚走了（' + a.sum.toFixed(0) + ' → ' + b.sum.toFixed(0) + '）',
       near(a.hero, b.hero, 0.5) && b.sum < a.sum - 100);
    await page.evaluate(() => { document.getElementById('bodyHome').scrollTop = 0; });
    await page.waitForTimeout(250);
  }

  /* ── 4. 横向拖不动 ── */
  head('4. 横向拖拽');
  await page.evaluate(() => window.scrollTo(200, 0));
  await page.waitForTimeout(200);
  ok('window.scrollX 归零', await page.evaluate(() => window.scrollX) === 0);

  /* ── 5. 记一笔 → 关掉再开还在 ── */
  head('5. 记一笔并重开');
  await page.click('#btnAdd');
  await page.waitForTimeout(500);
  await page.fill('#entryInput', '苹果 12.5');
  await page.waitForTimeout(300);
  const parsed = await page.evaluate(() => document.getElementById('parseAmt').textContent);
  ok('一句话自动拆出金额（' + parsed.trim() + '）', /12\.5/.test(parsed));
  await page.click('#btnSave');
  await page.waitForTimeout(700);
  ok('保存后出现在流水里',
     await page.evaluate(() => document.getElementById('recList').textContent.indexOf('苹果') >= 0));

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  ok('重开（重新加载）后数据还在',
     await page.evaluate(() => document.getElementById('recList').textContent.indexOf('苹果') >= 0));
  ok('重开后头像也还在',
     await page.evaluate(() => {
       const i = document.getElementById('avatarImg');
       return !i.hidden && (i.getAttribute('src') || '').length > 100;
     }));

  /* ── 6. 零报错 ── */
  head('6. 页面报错');
  ok('全程无 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(OUT, 'pack_final.png') });

  console.log('\n' + '─'.repeat(46));
  console.log((fail === 0 ? '全部通过' : '有失败项') + '：' + pass + ' 项通过，' + fail + ' 项失败');
  console.log('截图在：' + OUT + '\\pack_final.png');
  console.log('─'.repeat(46));

  await browser.close();
  process.exit(fail ? 1 : 0);
})();
