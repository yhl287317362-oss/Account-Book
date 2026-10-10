/* 探测 file:// 下 localStorage 的共享范围
   目的：判断「新版覆盖旧版同名文件后，旧数据是否还在」
   以及「不同文件名 / 不同目录的本地 HTML 是否共享存储」
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = path.join(os.tmpdir(), 'ls-scope-' + Date.now());
const SUB = path.join(TMP, 'sub');
fs.mkdirSync(SUB, { recursive: true });

const TPL = (body) => `<!doctype html><html><body><script>
window.__probe = function(){ ${body} };
<\/script></body></html>`;

fs.writeFileSync(path.join(TMP, 'a.html'), TPL(`
  localStorage.setItem('probe.key', 'WRITTEN_BY_A');
  return 'written';
`));
fs.writeFileSync(path.join(TMP, 'b.html'), TPL(`
  return { origin: location.origin, val: localStorage.getItem('probe.key') };
`));
fs.writeFileSync(path.join(SUB, 'c.html'), TPL(`
  return { origin: location.origin, val: localStorage.getItem('probe.key') };
`));

const url = (f) => 'file:///' + f.replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(url(path.join(TMP, 'a.html')));
  const w = await page.evaluate('window.__probe()');
  console.log('步骤1  a.html 写入           origin =', JSON.stringify(await page.evaluate('location.origin')));
  console.log('       结果                  =', JSON.stringify(w));

  await page.goto(url(path.join(TMP, 'b.html')));
  const rB = await page.evaluate('window.__probe()');
  console.log('步骤2  b.html（同目录不同名）origin =', JSON.stringify(rB.origin));
  console.log('       读到 probe.key        =', JSON.stringify(rB.val));

  await page.goto(url(path.join(SUB, 'c.html')));
  const rC = await page.evaluate('window.__probe()');
  console.log('步骤3  sub/c.html（子目录）  origin =', JSON.stringify(rC.origin));
  console.log('       读到 probe.key        =', JSON.stringify(rC.val));

  // 同名文件被覆盖（模拟「用新版覆盖旧版」），再读
  fs.writeFileSync(path.join(TMP, 'a.html'), TPL(`
    return { val: localStorage.getItem('probe.key') };
  `));
  await page.goto(url(path.join(TMP, 'a.html')));
  const rD = await page.evaluate('window.__probe()');
  console.log('步骤4  同名文件被新版覆盖后  读到 probe.key =', JSON.stringify(rD.val));

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });

  console.log('');
  console.log('=== 结论 ===');
  console.log('file:// 的 origin              :', JSON.stringify(rB.origin), '（不是 null）');
  console.log('同目录不同文件共享 localStorage :', rB.val === 'WRITTEN_BY_A' ? '是' : '否');
  console.log('子目录文件共享 localStorage      :', rC.val === 'WRITTEN_BY_A' ? '是' : '否');
  console.log('同名覆盖后数据保留               :', rD.val === 'WRITTEN_BY_A' ? '是' : '否');
})();
