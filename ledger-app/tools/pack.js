/* ============================================================
   打包成单文件 HTML（手机上直接打开用）
   ------------------------------------------------------------
   源文件是 index.html + style.css + quotes.js + app.js 四个文件，
   直接传到手机上只会显示「裸结构 + 没样式」—— 必须内联成一个文件。

   跑法：
     cd ledger-app
     NODE_PATH="C:/Users/28731/.workbuddy/binaries/node/workspace/node_modules" \
       "C:/Users/28731/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" tools/pack.js

   输出：上一级目录的「记账本-手机试看.html」
   ★ 改完任何一个源文件，都要重跑这个脚本，否则交付的还是旧版。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const OUT = path.join(DIR, '..', '记账本-手机试看.html');

const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');

let html = rd('index.html');

/* 编辑器预览面板会往标签上注入（它做元素定位用）。
   交付物不需要这些内部标记 —— 剥掉：文件更小，也不把工具痕迹带给别人。
   （注意：这个注入会让「精确字符串匹配」突然失配，所以下面一律用正则。） */
const injected = (html.match(/data-page-node-id=/g) || []).length;
if (injected) html = html.replace(/\s*]*"/g, '');

const css  = rd('style.css');
const qjs  = rd('quotes.js');
const ajs  = rd('app.js');
const before = html.length;

/* JS 里若出现 </script> 会提前闭合标签，转义掉 */
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const one  = (s, re, wrap) => {
  if (!re.test(s)) return null;
  let done = false;
  return s.replace(re, m => { if (done) return m; done = true; return wrap; });
};

const step1 = one(html, /<link[^>]*href=["']style\.css["'][^>]*>/i, '<style>\n' + css + '\n</style>');
if (step1 === null) { console.error('打包失败：index.html 里找不到 style.css 的 <link>'); process.exit(1); }
html = step1;

const step2 = one(html, /<script[^>]*src=["']quotes\.js["'][^>]*><\/script>/i, '<script>\n' + safe(qjs) + '\n</script>');
if (step2 === null) { console.error('打包失败：index.html 里找不到 quotes.js 的 <script>'); process.exit(1); }
html = step2;

const step3 = one(html, /<script[^>]*src=["']app\.js["'][^>]*><\/script>/i, '<script>\n' + safe(ajs) + '\n</script>');
if (step3 === null) { console.error('打包失败：index.html 里找不到 app.js 的 <script>'); process.exit(1); }
html = step3;

/* 自检：确认三块都内联了、且没有残留外链 */
const problems = [];
if (/href=["']style\.css/i.test(html))  problems.push('style.css 没内联成功');
if (/src=["']quotes\.js/i.test(html))   problems.push('quotes.js 没内联成功');
if (/src=["']app\.js/i.test(html))      problems.push('app.js 没内联成功');
if (!/<style>/.test(html))              problems.push('没有 <style> 块');
if ((html.match(/<script>/g) || []).length < 2) problems.push('内联的 <script> 块少于 2 个');
if (problems.length) {
  console.error('打包失败：\n - ' + problems.join('\n - '));
  process.exit(1);
}

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成：' + OUT);
console.log('  index.html 原始  ' + (before / 1024).toFixed(1) + ' KB');
console.log('  最终单文件      ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
console.log('  内联  css ' + (css.length / 1024).toFixed(1) +
            ' KB + quotes ' + (qjs.length / 1024).toFixed(1) +
            ' KB + app ' + (ajs.length / 1024).toFixed(1) + ' KB');
