/**
 * 把 index.html + style.css + quotes.js + app.js 内联成一个独立的 HTML 文件。
 * 用途：直接发到手机上用浏览器打开，不需要任何服务器。
 *
 * 用法：
 *   node tools/build-single.js [输出路径]
 *   不给路径时默认输出到 项目上一级/记账本.html
 *
 * 注：AI 识图功能已于 2026-09-20 整体移除（手机端 file:// 打不开 +
 *     引擎体积过大），相关历史代码在 git 之前的备份 ledger_backup_20260920 里。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outArg = args.find(a => !a.startsWith('--'));
const out = outArg ? path.resolve(outArg) : path.resolve(root, '..', '记账本.html');

const mustBeInlineSafe = (name, src) => {
  if (/<\/script/i.test(src)) throw new Error(name + ' 里含 </script，无法安全内联');
};

let html  = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const quotes = fs.readFileSync(path.join(root, 'quotes.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

mustBeInlineSafe('app.js', app);
mustBeInlineSafe('quotes.js', quotes);

const linkTag = /<link[^>]*href="style\.css"[^>]*>/i;
if (!linkTag.test(html)) throw new Error('index.html 里找不到 style.css 的引用');
html = html.replace(linkTag, '<style>\n' + css + '\n</style>');

const scriptTags = /<script src="(quotes|app)\.js"><\/script>\s*/g;
if (!scriptTags.test(html)) throw new Error('index.html 里找不到 quotes.js / app.js 的引用');

const parts = [];
if (/quotes\.js/.test(html)) parts.push(['quotes.js', quotes]);
parts.push(['app.js', app]);
html = html.replace(scriptTags, '');

html = html.replace(
  /<\/body>/i,
  parts.map(([, src]) => '<script>\n' + src + '\n</script>').join('\n') + '\n</body>'
);

fs.writeFileSync(out, html, 'utf8');

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log('已生成单文件：' + out);
console.log('  大小：' + kb + ' KB');
console.log('  外部引用残留：' + (/src="(app|quotes)\.js"|href="style\.css"/.test(html) ? '有！' : '无'));
