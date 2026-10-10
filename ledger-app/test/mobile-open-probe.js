/**
 * mobile-open-probe.js — 模拟移动端打开单文件 HTML，测量解析耗时与内存
 *
 * 目的：复现「10MB 单文件在手机上打不开」。
 * 手法：真实 Chrome + 移动 UA/viewport + 强制限制 V8 堆大小（模拟中低端安卓机）。
 *
 * 运行：
 *   NODE_PATH=... node test/mobile-open-probe.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const CASES = [
  { name: '轻量版 188KB', file: 'C:/Users/28731/WorkBuddy/2026-09-16-14-58-01/ledger-app/testout/记账本-轻量版.html' },
  { name: '离线版 10MB ', file: 'C:/Users/28731/Desktop/记账本.html' },
];

// 模拟不同内存档位的安卓机（V8 堆上限）
const HEAP_MB = Number(process.env.HEAP_MB || 256);

function toUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/');
}

function mb(n) {
  return (n / 1048576).toFixed(1) + ' MB';
}

async function probe(page, file) {
  const t0 = Date.now();
  const perf = {};

  page.on('pageerror', (e) => { perf.pageError = String(e.message).slice(0, 200); });
  page.on('crash', () => { perf.crashed = true; });

  let navErr = null;
  try {
    await page.goto(toUrl(file), { waitUntil: 'load', timeout: 120000 });
  } catch (e) {
    navErr = e.message.split('\n')[0];
  }
  perf.navMs = Date.now() - t0;

  if (navErr) {
    perf.navError = navErr;
  }

  // 页面活性 + 内存
  try {
    const r = await page.evaluate(() => {
      const m = performance.memory || {};
      const nav = performance.getEntriesByType('navigation')[0] || {};
      return {
        title: document.title,
        nodes: document.getElementsByTagName('*').length,
        // OCR 数据节点是否真的进了 DOM
        ocrCoreLen: (document.getElementById('ocrCore') || {}).textContent?.length || 0,
        heapUsed: m.usedJSHeapSize || 0,
        heapTotal: m.totalJSHeapSize || 0,
        heapLimit: m.jsHeapSizeLimit || 0,
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
        loadEnd: Math.round(nav.loadEventEnd || 0),
        // 首页是否渲染出卡片
        hasFlow: !!document.querySelector('.card-flow, #pageHome, .tabbar'),
        tesseract: typeof window.Tesseract,
      };
    });
    Object.assign(perf, r);
  } catch (e) {
    perf.evalError = e.message.split('\n')[0];
  }
  return perf;
}

(async () => {
  console.log('=== 模拟环境：Android UA + 400x800 viewport + V8 堆上限 ' + HEAP_MB + 'MB ===');
  console.log();

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--js-flags=--max-old-space-size=' + HEAP_MB, '--no-sandbox', '--disable-dev-shm-usage'],
  });

  for (const c of CASES) {
    if (!fs.existsSync(c.file)) { console.log(c.name, '文件不存在:', c.file); continue; }
    const size = fs.statSync(c.file).size;
    const ctx = await browser.newContext({
      userAgent: ANDROID_UA,
      viewport: { width: 400, height: 800 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await ctx.newPage();

    console.log('---------- ' + c.name + ' (' + mb(size) + ') ----------');
    let perf;
    try {
      perf = await probe(page, c.file);
    } catch (e) {
      perf = { fatal: e.message.split('\n')[0] };
    }

    const ok = !perf.fatal && !perf.navError && !perf.crashed && perf.hasFlow;
    console.log('  打开结果     : ' + (ok ? '✅ 成功' : '❌ 失败'));
    if (perf.fatal) console.log('  致命错误     : ' + perf.fatal);
    if (perf.navError) console.log('  导航错误     : ' + perf.navError);
    if (perf.crashed) console.log('  渲染进程     : 崩溃 (crash)');
    if (perf.pageError) console.log('  页面 JS 错误 : ' + perf.pageError);
    if (perf.evalError) console.log('  eval 失败    : ' + perf.evalError);
    console.log('  导航耗时     : ' + perf.navMs + ' ms');
    if (perf.domContentLoaded != null) console.log('  DOMContentLoaded : ' + perf.domContentLoaded + ' ms');
    if (perf.loadEnd != null) console.log('  load 完成        : ' + perf.loadEnd + ' ms');
    console.log('  DOM 节点数   : ' + (perf.nodes ?? '?'));
    console.log('  OCR 数据长度 : ' + (perf.ocrCoreLen ?? 0) + ' chars');
    console.log('  JS 堆已用    : ' + mb(perf.heapUsed || 0) + '  / 上限 ' + mb(perf.heapLimit || 0));
    console.log('  首页有渲染   : ' + (perf.hasFlow ? '是' : '否'));
    console.log('  Tesseract    : ' + perf.tesseract);
    console.log();

    await ctx.close();
  }

  await browser.close();
})();
