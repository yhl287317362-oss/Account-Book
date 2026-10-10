package com.shouhu.ledger;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.database.Cursor;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import org.json.JSONObject;

/**
 * 记账本的 Android 外壳。
 *
 * 这里做的事情非常少 —— 只是一个能跑本地网页的容器：
 *   1. 用 WebView 打开 assets/index.html（整个 App 的界面都在那个文件里）
 *   2. 打开离线存储（你的账目存在这里）
 *   3. 让 <input type="file"> 能选图片（换头像 / 上传主题图要用）
 *   4. 返回键先交给网页处理（关弹窗、退二级页），它说不用了才最小化
 *   5. 把「导出备份」的 JSON 真正写成文件，落在固定位置：
 *        内部存储 / Download / 记账本 / 记账备份_2026-09-20_1730.json
 *   6. 「导入恢复」直接调系统文件选择器，并且一打开就定位到上面那个文件夹
 *
 * 没有网络代码，也没有申请任何权限。
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 1001;
    private static final int REQ_PICK = 1002;

    /** 备份文件的固定落点：内部存储/Download/<这个名字>/ */
    private static final String BACKUP_DIR = "记账本";

    private WebView web;
    private ValueCallback<Uri[]> pendingFileCb;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applySystemBars("#EAF4FE");

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#EAF4FE"));   // 防止加载瞬间白闪
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);         // 去掉滚动到顶的蓝色光晕
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage —— 账目存在这里，必须开
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);            // 读 assets 里的页面
        s.setAllowContentAccess(true);         // 文件选择器返回的 content:// 要能读
        s.setSupportZoom(false);               // 当成原生 App，不做网页缩放
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                    // 锁死字号：系统字号调大也不会冲垮布局
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(false);   // 纯本地页面，不需要联网校验
        }

        web.addJavascriptInterface(new Bridge(), "LedgerNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                // 纯本地应用：只放行自己的页面，其它一律拦掉不开浏览器
                return !url.startsWith("file:///android_asset/");
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                // 不实现这个，网页里的「上传头像 / 上传主题图」点了没反应
                if (pendingFileCb != null) {
                    pendingFileCb.onReceiveValue(null);
                }
                pendingFileCb = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    pendingFileCb = null;
                    return false;
                }
                return true;
            }
        });

        setContentView(web);

        // 每次都重新加载页面，而不是 restoreState()。
        // 理由：账目全在 localStorage 里，重新加载不会丢数据；
        // 而 restoreState() 在部分机型上会恢复出一片空白页 —— 那个 bug 比重新加载恶心得多。
        web.loadUrl("file:///android_asset/index.html");
    }

    /* ────────────────────────────────────────────────────────
       导出备份：把 JSON 写成文件，落在「内部存储 / Download / 记账本 /」

       为什么必须由壳来做：
         网页里导出用的是 Blob + <a download>，这个机制在 WebView 里是
         不生效的 —— 点了「导出备份」什么都不会发生，而且不报错。
         所以网页检测到 LedgerNative 时会把 JSON 交给这里落盘。

       落点分两种情况：
         Android 10 (API 29) 及以上：用 MediaStore 写公共「Download/记账本」，
           文件管理器里直接能看到，而且不需要任何权限。
         Android 9 及以下：公共目录要 WRITE_EXTERNAL_STORAGE 权限，
           这个 App 故意不申请权限，只能退回 App 自己的外部目录。
       ──────────────────────────────────────────────────────── */
    void writeBackup(String json, String filename) {
        try {
            byte[] data = json.getBytes("UTF-8");
            String where;

            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/" + BACKUP_DIR);
                // IS_PENDING=1 表示「还在写，别给别的 App 看」。
                // 不设也行，但设了写一半的文件不会被文件管理器当成正常文件。
                cv.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("系统没给出存储位置");

                boolean written = false;
                try {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) throw new Exception("无法写入这个位置");
                    os.write(data);
                    os.flush();
                    os.close();
                    written = true;
                } finally {
                    // 成败都要收尾：写成了就清 IS_PENDING（不清的话文件永远不出现），
                    // 没写成就把那条空记录删掉，别在下载列表里留个 0 字节的幽灵
                    if (written) {
                        ContentValues done = new ContentValues();
                        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        getContentResolver().update(uri, done, null, null);
                    } else {
                        getContentResolver().delete(uri, null, null);
                    }
                }

                // 同名文件已存在时系统会自动改名（加 " (1)"），
                // 所以要回读真实文件名，否则告诉用户的路径是错的
                String real = filename;
                try {
                    Cursor c = getContentResolver().query(uri,
                            new String[]{MediaStore.MediaColumns.DISPLAY_NAME},
                            null, null, null);
                    if (c != null) {
                        if (c.moveToFirst()) real = c.getString(0);
                        c.close();
                    }
                } catch (Exception ignored) {
                }

                where = "下载/" + BACKUP_DIR + "/" + real;

            } else {
                File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                        BACKUP_DIR);
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("目录建不了");

                File f = new File(dir, filename);
                FileOutputStream fo = new FileOutputStream(f);
                fo.write(data);
                fo.flush();
                fo.close();

                where = f.getAbsolutePath();
            }

            toastNative("已导出到 " + where);
            notifyWeb("window.__ledgerExportDone && window.__ledgerExportDone(true, "
                    + jsStr(where) + ")");

        } catch (Exception e) {
            String msg = String.valueOf(e.getMessage());
            toastNative("导出失败：" + msg);
            notifyWeb("window.__ledgerExportDone && window.__ledgerExportDone(false, "
                    + jsStr(msg) + ")");
        }
    }

    /** 「内部存储 / Download / 记账本」这个文件夹对应的系统 Uri */
    private Uri backupFolderUri() {
        try {
            return DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents",
                    "primary:" + Environment.DIRECTORY_DOWNLOADS + "/" + BACKUP_DIR);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 把用户在文件选择器里选中的备份文件读成文本，再交回网页。
     * 为什么自己读而不交给 WebView 的 <input type="file">：
     *   <input> 那条路走的是 WebChromeClient，我们没法控制它打开时停在哪个目录，
     *   用户得自己在手机里翻。自己读就能让选择器一打开就落在备份文件夹上。
     */
    private void readPickedBackup(final Uri uri) {
        try {
            InputStream in = getContentResolver().openInputStream(uri);
            if (in == null) throw new Exception("读不到这个文件");

            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            int total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > 4 * 1024 * 1024) {
                    in.close();
                    throw new Exception("文件超过 4MB，不像是备份");
                }
                bo.write(buf, 0, n);
            }
            in.close();

            String text = bo.toString("UTF-8");
            if (text.startsWith("\uFEFF")) text = text.substring(1);   // 去掉 Windows 记事本加的 BOM

            notifyWeb("window.__ledgerImportText && window.__ledgerImportText("
                    + JSONObject.quote(text) + ")");

        } catch (Exception e) {
            final String msg = String.valueOf(e.getMessage());
            toastNative("读取失败：" + msg);
            notifyWeb("window.__ledgerImportFail && window.__ledgerImportFail("
                    + jsStr(msg) + ")");
        }
    }

    /** 在网页里跑一段 JS（切回 WebView 线程，避免线程冲突） */
    private void notifyWeb(final String js) {
        if (web == null) return;
        web.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(js, null);
            }
        });
    }

    /** 只负责弹系统提示；调用方可能在后台线程，所以切回 UI 线程 */
    private void toastNative(String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    /** 把 Java 字符串安全地拼进 JS 单引号字符串里 */
    private static String jsStr(String s) {
        if (s == null) return "''";
        return "'" + s.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "") + "'";
    }

    /** 网页侧调用 LedgerNative.setStatusBar('#RRGGBB')，让状态栏跟着主题走 */
    private void applySystemBars(final String hex) {
        if (Build.VERSION.SDK_INT < 21) return;
        try {
            int c = Color.parseColor(hex);
            getWindow().setStatusBarColor(c);
            getWindow().setNavigationBarColor(Color.parseColor("#FFFFFF"));
            View dv = getWindow().getDecorView();
            int flags = dv.getSystemUiVisibility();
            double lum = (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) / 255.0;
            if (lum > 0.60) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;       // 底色浅 → 用深色图标
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            dv.setSystemUiVisibility(flags);
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (pendingFileCb != null) {
                Uri[] out = null;
                if (res == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        out = new Uri[n];
                        for (int i = 0; i < n; i++) {
                            out[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        out = new Uri[]{data.getData()};
                    }
                }
                pendingFileCb.onReceiveValue(out);
                pendingFileCb = null;
            }
            return;
        }
        if (req == REQ_PICK) {
            if (res == RESULT_OK && data != null && data.getData() != null) {
                readPickedBackup(data.getData());
            } else {
                notifyWeb("window.__ledgerImportCancel && window.__ledgerImportCancel()");
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    /**
     * 返回键：先问网页「你有没有要关的东西」（弹窗 / 二级页 / 非首页 tab）。
     * 网页回答 true = 它处理了；false = 手头没什么可关的，把 App 收到后台。
     *
     * 之所以是「收到后台」而不是「退出」：账目都在本地，退到后台下次打开还是原样，
     * 误按一下不会打断你正在记的账。
     */
    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(window.__ledgerBack && window.__ledgerBack()) === true",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        if (!"true".equals(v)) {
                            moveTaskToBack(true);
                        }
                    }
                });
    }

    /** 暴露给网页的极少量原生能力 */
    private class Bridge {
        @JavascriptInterface
        public void setStatusBar(final String hex) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applySystemBars(hex);
                }
            });
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        /**
         * 网页调 LedgerNative.saveBackup(json字符串, '文件名.json') 导出备份。
         * 写文件可能慢，放后台线程，别卡住网页。
         */
        @JavascriptInterface
        public void saveBackup(final String json, final String filename) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    writeBackup(json, filename);
                }
            }).start();
        }

        /**
         * 网页调 LedgerNative.pickBackup() 挑一个备份文件。
         * 一打开就定位到「Download/记账本」，不用用户在手机里翻。
         */
        @JavascriptInterface
        public void pickBackup() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        // 用 */* 而不是 application/json：
                        // 部分机型的文件选择器对 application/json 匹配不到 .json 文件，
                        // 结果是一片空白，用户以为文件没了
                        i.setType("*/*");
                        Uri start = backupFolderUri();
                        if (start != null) {
                            i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, start);
                        }
                        startActivityForResult(i, REQ_PICK);
                    } catch (Exception e) {
                        toastNative("这台手机没找到文件选择器，请改用「备份文本」");
                    }
                }
            });
        }

        /** 网页调 LedgerNative.openBackupFolder() 直接打开备份文件夹 */
        @JavascriptInterface
        public void openBackupFolder() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Uri dir = backupFolderUri();
                    if (dir != null) {
                        try {
                            Intent i = new Intent(Intent.ACTION_VIEW);
                            i.setDataAndType(dir, DocumentsContract.Document.MIME_TYPE_DIR);
                            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(i);
                            return;
                        } catch (Exception ignored) {
                        }
                    }
                    if (Build.VERSION.SDK_INT >= 29) {
                        try {
                            Intent i = new Intent(Intent.ACTION_VIEW);
                            i.setDataAndType(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                    "resource/folder");
                            startActivity(i);
                            return;
                        } catch (Exception ignored) {
                        }
                    }
                    toastNative("请打开手机「文件管理」→ 内部存储 → Download → " + BACKUP_DIR);
                }
            });
        }
    }
}
