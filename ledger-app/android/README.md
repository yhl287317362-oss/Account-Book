# 记账本 · Android 打包说明

这个目录把 `ledger-app`（一个纯网页应用）打包成能装进手机的 APK。

## 产物

打包完成后，APK 输出到**仓库根目录**（`ledger-app/` 的上一级），文件名带版本号：

```
<仓库根>/记账本-v1.2.apk
```

## 怎么重新打包

改完 `../index.html` / `../style.css` / `../app.js` / `../quotes.js` 之后：

```bash
cd <仓库根>/ledger-app
python android/tools/build-apk.py
```

（签名口令从环境变量读，见文末「签名证书」）

一条命令跑完 6 步（内部会自动调 `tools/pack.js` 重新生成单文件 HTML，所以**不用**先手工打包）。

### 打包后建议做的两道检查

```bash
# 1) 静态拆包：核对资源、dex、签名、网页内容一致性
python android/tools/verify-apk.py

# 2) 把 APK 里的 HTML 提出来，在真实浏览器引擎里跑行为验证（返回键 / 数据持久化）
NODE_PATH="<你的 node_modules 目录>" node test/apk-html-check.js
```

> `verify-apk.py` 顺带负责把 HTML 从 APK 里提取到临时目录，`apk-html-check.js` 依赖它先跑。

## 工具链在哪

装在 `C:\Users\28731\android-toolchain\`，**不在这个仓库里**：

| 目录 | 内容 |
|---|---|
| `jdk17\` | Amazon Corretto 17（javac / keytool / java） |
| `sdk\build-tools\34.0.0\` | aapt2 / zipalign / apksigner / d8 |
| `sdk\platforms\android-34\` | android.jar |
| `install-sdk.bat` | 装/修 SDK 组件（纯 ASCII，改了别加中文——见下） |

如果哪天要重装，跑 `C:\Users\28731\android-toolchain\install-sdk.bat`。

## ★ 签名证书：这个丢了很麻烦

```
android/keystore/ledger.keystore      (别名 ledger)
```

**⚠️ 这个文件不进 Git 仓库**（私钥不能公开），`.gitignore` 已排除。请单独离线保管。

Android 规定：同一个包名升级安装时，签名必须一致。

- 证书在 → 新 APK 能**覆盖安装**，账目数据全保留
- 证书丢 → 只能**先卸载再装**，而卸载会连带清掉 localStorage，**账目全没**

口令**不写进代码**，打包前用环境变量传入：

```bash
set LEDGER_KS_PASS=你的口令            # cmd
$env:LEDGER_KS_PASS="你的口令"          # PowerShell
```

## 目录结构

```
android/
├── AndroidManifest.xml              应用声明（零权限，连 INTERNET 都没有）
├── java/com/shouhu/ledger/
│   └── MainActivity.java            唯一的原生代码：WebView 壳
├── res/                             图标、应用名
│   ├── drawable/ic_bg.xml           图标底色（渐变）
│   ├── mipmap-anydpi-v26/           自适应图标声明（Android 8+）
│   ├── mipmap-<dpi>/                传统图标 + 自适应前景（各 5 档）
│   └── values/strings.xml           应用名「记账本」
├── assets/index.html                打包时自动生成，别手工改
├── keystore/ledger.keystore         签名证书 ★ 不进仓库，单独保管
├── tools/
│   ├── build-apk.py                 一键打包
│   ├── verify-apk.py                APK 静态自检
│   └── gen-icons.py                 重新生成图标
└── build/                           中间产物，可随时删
```

## 为什么不用 Gradle

Gradle + Android Gradle Plugin 要从 Google Maven 拉几百 MB 依赖，大陆最容易卡死的地方就在这。
这个 App 只有一个 Activity、零第三方库，用 build-tools 自带的五个工具手工串一遍就够了，
而且**完全不需要联网**：

```
aapt2 compile/link  → 编译资源、链接出 APK 骨架
javac               → 编译 Java
d8                  → 转成 classes.dex
zipalign            → 字节对齐
apksigner           → 签名
```

`classes.dex` 是用 Python 的 zipfile 直接追加进 APK 的（aapt2 不负责这一步）。

## 踩过的坑

1. **Windows 批处理里不要写中文注释。**
   `.bat` 是 UTF-8 存的，cmd 按 GBK 读，中文会把命令行的语法冲垮，
   报出一堆 `'ATH"' 不是内部或外部命令` 这种看不懂的错。`install-sdk.bat` 全 ASCII 就是这个原因。

2. **sdkmanager 卡在 `Accept? (y/N)` 时，别跟它较劲。**
   管道喂 `y` 在批处理里经常传不进去。直接写许可文件：
   `sdk-toolchain\sdk\licenses\android-sdk-license`，内容三行哈希（见 install-sdk.bat 同级目录）。

3. **`aapt2 compile --dir res` 用相对路径会失败**，因为子进程的工作目录不定。一律用绝对路径。

4. **`resources.arsc` 必须是「不压缩（STORED）」存在 zip 里。**
   手工打包时如果整包重新压缩，会把这条破坏掉，装的时候直接失败。
   `verify-apk.py` 专门检查这一条。

5. **不要用 `WebView.restoreState()`。**
   它在部分机型上会恢复出一片空白页。账目都在 localStorage 里，重新 `loadUrl()` 又快又稳。
