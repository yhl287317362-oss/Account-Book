/* ============================================================
   内嵌 OCR 引擎引导 —— 只有「离线单文件版」会内联这个文件
   ------------------------------------------------------------
   build-single.js --ocr 在生成 HTML 时会追加这些节点（下面省略结束标签，
   因为本文件会被内联进 HTML，注释里出现结束标签会提前截断页面）：
     <script> …tesseract.min.js 源码…             直接执行，定义 window.Tesseract
     <script type="text/plain" id="ocrCore"> …    core-simd-lstm.wasm.js（自带 base64 内联 wasm）
     <script type="text/plain" id="ocrWorker"> …  worker.min.js
     <script type="text/plain" id="ocrLangChi" data-ver="…"> …base64
     <script type="text/plain" id="ocrLangEng"> …base64
     <script> …本文件…

   为什么这么绕（两条都是实测踩出来的）：
   1) core 必须能在 worker 内拿到。把 core 源码拼到 worker 代码最前面，
      worker 里 getCore() 判断 `typeof TesseractCore === 'undefined'` 不成立，
      整段 core 下载被跳过 —— 实测时间线里不再出现 "loading tesseract core"。
   2) 语言包不能「主线程建 blob URL、worker 去 fetch」：file:// 下 worker
      访问主线程的 blob:null/… 会被拒（实测 TypeError: Failed to fetch）。
      改成主线程写 IndexedDB、worker 内自己读，就通了。
   ============================================================ */
(function(){
  var d = document;
  var coreEl, workerEl, chiEl, engEl, VER = 'v1';

  var DB = 'ledger_ocr_lang';
  var STORE = 'k';
  var VER_KEY = '__ver';
  var KEYS = { chi_sim: 'chi_sim', eng: 'eng' };

  var state = { booted: false, opts: null };

  function b64ToBytes(b64){
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function idbOpen(){
    return new Promise(function(res, rej){
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function(){
        var db = rq.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      rq.onsuccess = function(){ res(rq.result); };
      rq.onerror = function(){ rej(rq.error); };
    });
  }
  function idbGet(db, key){
    return new Promise(function(res, rej){
      var g = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      g.onsuccess = function(){ res(g.result); };
      g.onerror = function(){ rej(g.error); };
    });
  }
  function idbPut(db, key, val){
    return new Promise(function(res, rej){
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = function(){ res(); };
      tx.onerror = function(){ rej(tx.error); };
    });
  }

  function workerCode(){
    var interceptor =
      'self.__OCR_DB=' + JSON.stringify(DB) + ';' +
      'self.__OCR_KEYS=' + JSON.stringify(KEYS) + ';' +
      '(function(){' +
        'function g(k){return new Promise(function(res,rej){' +
          'var rq=indexedDB.open(self.__OCR_DB,1);' +
          'rq.onupgradeneeded=function(){var x=rq.result;if(!x.objectStoreNames.contains("k"))x.createObjectStore("k");};' +
          'rq.onsuccess=function(){' +
            'var q=rq.result.transaction("k","readonly").objectStore("k").get(k);' +
            'q.onsuccess=function(){res(q.result);};' +
            'q.onerror=function(){rej(q.error);};' +
          '};' +
          'rq.onerror=function(){rej(rq.error);};' +
        '});}' +
        'var _f=self.fetch.bind(self);' +
        'self.fetch=function(u,o){' +
          'if(typeof u==="string"){' +
            'for(var k in self.__OCR_KEYS){' +
              'if(u.indexOf(k+".traineddata")>=0){' +
                'var kk=self.__OCR_KEYS[k];' +
                'return g(kk).then(function(b){' +
                  'if(!b)throw new Error("内置语言包缺失: "+kk);' +
                  'return new Response(b,{status:200,statusText:"OK"});' +
                '});' +
              '}' +
            '}' +
          '}' +
          'return _f(u,o);' +
        '};' +
      '})();';
    return interceptor + ';' + coreEl.textContent + ';' + workerEl.textContent;
  }

  function dropEls(){
    [coreEl, workerEl, chiEl, engEl].forEach(function(el){
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function boot(onStatus){
    if (state.booted) return Promise.resolve(state.opts);
    var say = (typeof onStatus === 'function') ? onStatus : function(){};
    say('正在准备内置引擎…');
    return idbOpen().then(function(db){
      return idbGet(db, VER_KEY).then(function(cur){
        if (cur === VER) return null;                 // 已解包过，直接跳过
        say('首次使用，正在解包识别模型…');
        var chi = b64ToBytes(chiEl.textContent);
        var eng = b64ToBytes(engEl.textContent);
        return Promise.all([idbPut(db, KEYS.chi_sim, chi), idbPut(db, KEYS.eng, eng)])
          .then(function(){ return idbPut(db, VER_KEY, VER); });
      }).then(function(){
        var workerURL = URL.createObjectURL(
          new Blob([workerCode()], { type: 'application/javascript' })
        );
        state.opts = {
          workerPath: workerURL,
          workerBlobURL: false,
          langPath: 'https://embedded.invalid/'
        };
        state.booted = true;
        dropEls();
        return state.opts;
      });
    });
  }

  /* 注意：必须等引擎数据节点被解析出来才能挂 API。
     本脚本如果有任何原因被排在数据节点之前，getElementById 会拿到 null，
     所以这里等 DOM 解析完再确认一次。 */
  function setup(){
    if (window.__OCREmbed) return;
    coreEl   = d.getElementById('ocrCore');
    workerEl = d.getElementById('ocrWorker');
    chiEl    = d.getElementById('ocrLangChi');
    engEl    = d.getElementById('ocrLangEng');
    if (!coreEl || !workerEl || !chiEl || !engEl) return;
    if (!window.indexedDB) return;
    VER = chiEl.getAttribute('data-ver') || 'v1';

    window.__OCREmbed = {
      available: function(){ return true; },
      ready:     function(){ return state.booted; },
      options:   function(){ return state.opts || {}; },
      boot:      boot
    };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
