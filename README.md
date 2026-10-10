# 记账本（记一笔）

一款**纯本地、零权限、不联网**的安卓记账应用。给自己的日常收支做快速记录，并按月查看分类构成。

- 前端：原生 HTML / CSS / JavaScript（**运行时零依赖**、无框架、无构建步骤；只有测试用到 jsdom）
- 外壳：一个 Activity 的 Android WebView（唯一原生代码，475 行）
- 数据：全部存在手机本地的 `localStorage`，**不联网、不上传、零权限**

APK 只有 **120 KB**。

---

## 功能

**记一笔**

- 收入 / 支出双模式
- 支出 10 类：餐饮 · 交通 · 居住 · 购物 · 文娱 · 旅游 · 人情 · 医疗 · 宠物 · 其他
- 收入 3 类：工资 · 退款 · 其他
- **金额旁边写字自动归类别**：输入"地铁"自动选中交通，"奶茶"自动选中餐饮……规则表见 `app.js` 的 `KEYWORDS`，可以直接往里加词
- 记账时可加备注、选日期

**看收支**

- 首页：本月收入 / 支出 / 结余
- 统计页：本月支出构成（横条图）、近 30 天趋势、分类明细

**个性化**

- 多套内置主题（改 `app.js` 的 `THEMES`）；也支持用图片当主题
- 头像、每日激励语（改 `quotes.js` 数组即可）

**数据**

- 导出 / 导入备份（JSON），换手机不丢账

---

## 下载安装

APK 在 [`releases/`](releases/) 目录：

| 文件 | 说明 |
|---|---|
| `记账本-v1.2.apk` | **最新版**（versionCode 3） |
| `记账本-v1.0.apk` | 最早的版本，留档 |
| `记账本-单文件试看版.html` | 不用装，浏览器直接打开就能看界面 |

安装：把 APK 传到手机 → 用文件管理器点开 → 允许「安装未知来源应用」→ 安装。

> 应用**不申请任何权限**（连联网权限都没有），装的时候系统会显示「无需任何权限」。

最低支持 **Android 5.0**（minSdk 21）。

---

## 项目结构

```
.
├── releases/                     编译好的 APK 与单文件试看版
└── ledger-app/                   源码
    ├── index.html                页面结构
    ├── style.css                 样式
    ├── app.js                    全部逻辑（分类 / 关键词 / 主题 / 存储 / 渲染）
    ├── quotes.js                 激励语词库
    ├── serve/                    本地预览用的小服务器
    ├── tools/                    打包工具（单文件 HTML、素材生成）
    ├── test/                     自动化测试（jsdom 逻辑 + 浏览器渲染 + APK 拆包）
    └── android/                  安卓外壳与打包脚本
        ├── AndroidManifest.xml
        ├── java/com/shouhu/ledger/MainActivity.java
        ├── res/                  图标、应用名
        ├── tools/build-apk.py    一键打包
        └── README.md             ★ 打包细节与踩坑记录都在这
```

---

## 想改点东西

代码是刻意写成「能看懂、能自己改」的。最常见的三处改动都在 `app.js` 顶部有注释标出：

| 想改 | 去哪 |
|---|---|
| 分类名字 / 图标 / 颜色 | `app.js` → `CATS` |
| 输入什么词归到哪类 | `app.js` → `KEYWORDS` |
| 内置主题配色 | `app.js` → `THEMES` |
| 激励语 | `quotes.js` 数组 |

改完在浏览器里刷新就能看到效果（不需要任何构建）。

**本地预览**：直接双击 `index.html` 即可；或者跑 `ledger-app/serve/启动服务.bat` 起个本地服务器。

---

## 重新打包 APK

不用 Gradle，用 Android build-tools 手工串五步（`aapt2` → `javac` → `d8` → `zipalign` → `apksigner`），
全程**离线**、约 7 秒。

### 1. 准备工具链

需要一个 JDK 17 和 Android SDK 的 `build-tools/34.0.0` + `platforms/android-34`，目录结构：

```
<工具链>/
├── jdk17/                    Amazon Corretto 17
└── sdk/
    ├── build-tools/34.0.0/   aapt2 / zipalign / apksigner / d8
    └── platforms/android-34/ android.jar
```

### 2. 打包

```bash
cd ledger-app

# 指向你的工具链（默认值是作者机器的路径）
set ANDROID_TC=D:\android-toolchain          # cmd
$env:ANDROID_TC="D:\android-toolchain"        # PowerShell

# 签名口令（不写进代码，用环境变量传）
set LEDGER_KS_PASS=你的口令

python android/tools/build-apk.py
```

产物输出到仓库根目录：`记账本-v1.2.apk`。

详细说明、验证脚本、以及踩过的 5 个坑，见 [`ledger-app/android/README.md`](ledger-app/android/README.md)。

---

## 数据与隐私

- 所有账目存在手机 WebView 的 `localStorage` 里，**不出手机**
- 应用**没有任何联网权限**，物理上无法上传数据
- 卸载应用会**一并清掉数据**，请定期用「导出备份」留一份
- 仓库里不包含任何签名私钥

---

## License

[MIT](LICENSE)
