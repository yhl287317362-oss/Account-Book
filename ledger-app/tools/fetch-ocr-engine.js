/**
 * 下载 OCR 引擎所需的全部文件到 tools/ocr-engine/
 * （内嵌打包前跑一次即可；文件已存在会跳过）
 *
 * 用法：node tools/fetch-ocr-engine.js
 *
 * 这些地址就是 Tesseract.js v5 运行时会去拉的东西（读源码确认过）：
 *   corePath 默认 https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.1
 *   langPath 默认 https://cdn.jsdelivr.net/npm/@tesseract.js-data/<lang>/4.0.0_best_int
 *            （OEM=LSTM_ONLY 时走 best_int 精简版，比完整版小一个量级）
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'ocr-engine');

const FILES = [
  ['tesseract.min.js',
   'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'],
  ['worker.min.js',
   'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js'],
  ['core-simd-lstm.wasm.js',
   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js'],
  ['chi_sim.traineddata.gz',
   'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz'],
  ['eng.traineddata.gz',
   'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz']
];

function get(url, depth){
  return new Promise((res, rej) => {
    if ((depth || 0) > 6) return rej(new Error('重定向过多'));
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return get(r.headers.location, (depth || 0) + 1).then(res, rej);
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res(Buffer.concat(chunks)));
      r.on('error', rej);
    }).on('error', rej);
  });
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [name, url] of FILES) {
    const dest = path.join(OUT, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      const kb = (fs.statSync(dest).size / 1024).toFixed(0);
      console.log('跳过（已存在） ' + name + '  ' + kb + ' KB');
      total += fs.statSync(dest).size;
      continue;
    }
    process.stdout.write('下载 ' + name + ' … ');
    const buf = await get(url);
    fs.writeFileSync(dest, buf);
    total += buf.length;
    console.log((buf.length / 1048576).toFixed(2) + ' MB');
  }
  console.log('\n引擎目录：' + OUT);
  console.log('合计：' + (total / 1048576).toFixed(2) + ' MB');
})();
