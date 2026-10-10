# -*- coding: utf-8 -*-
"""
把 ledger-app 打包成一个能装进手机的 APK。

为什么不用 Gradle：
  Gradle + Android Gradle Plugin 要从 Google Maven 拉几百 MB 依赖，在大陆最容易卡死。
  这个 App 只有一个 Activity、零第三方库，用 build-tools 自带的
  aapt2（资源）/ javac（编译）/ d8（转 dex）/ zipalign（对齐）/ apksigner（签名）
  手工串一遍就够了，全部离线可控。

五个步骤：
  1. 打包单文件 HTML  → assets/index.html
  2. aapt2 编译资源 → 链接成 APK 骨架
  3. javac + d8 把 Java 编成 classes.dex
  4. 把 dex 塞进 APK
  5. zipalign + apksigner 签名

跑法：python android/tools/build-apk.py
"""
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile

# ── 路径 ────────────────────────────────────────────────────
# Android 工具链（JDK 17 + build-tools）不在本仓库里，见 android/README.md「环境准备」。
# 默认沿用作者机器的位置，换机器时用环境变量 ANDROID_TC 覆盖即可。
TC      = os.environ.get('ANDROID_TC', r'C:\Users\28731\android-toolchain')
JAVA    = os.path.join(TC, 'jdk17', 'bin', 'java.exe')
JAVAC   = os.path.join(TC, 'jdk17', 'bin', 'javac.exe')
KEYTOOL = os.path.join(TC, 'jdk17', 'bin', 'keytool.exe')
SDKROOT = os.path.join(TC, 'sdk')
BT      = os.path.join(SDKROOT, 'build-tools', '34.0.0')
AJAR    = os.path.join(SDKROOT, 'platforms', 'android-34', 'android.jar')

AAPT2    = os.path.join(BT, 'aapt2.exe')
ZIPALIGN = os.path.join(BT, 'zipalign.exe')
D8_JAR   = os.path.join(BT, 'lib', 'd8.jar')
SIGN_JAR = os.path.join(BT, 'lib', 'apksigner.jar')

# 仓库根 = 本文件往上三级（repo/android/tools/build-apk.py），不写死绝对路径
REPO    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTDIR  = os.path.dirname(REPO)
PROJ    = os.path.join(REPO, 'android')
BUILD   = os.path.join(PROJ, 'build')
RESZIP  = os.path.join(BUILD, 'res.zip')
BASEAPK = os.path.join(BUILD, 'base.apk')
DEXDIR  = os.path.join(BUILD, 'dex')
CLASSES = os.path.join(BUILD, 'classes')
GEN     = os.path.join(BUILD, 'gen')

# ★ 签名证书不进仓库（私钥不能公开）。把 keystore 放到 android/keystore/ 下，
#   口令一律用环境变量传入，不要写进代码：
#     cmd:        set LEDGER_KS_PASS=你的口令
#     PowerShell: $env:LEDGER_KS_PASS="你的口令"
KS       = os.path.join(PROJ, 'keystore', 'ledger.keystore')
KS_ALIAS = os.environ.get('LEDGER_KS_ALIAS', 'ledger')
KS_PASS  = os.environ.get('LEDGER_KS_PASS', '')

PKG      = 'com.shouhu.ledger'
APP_NAME = '记账本'
VER_CODE = '3'
VER_NAME = '1.2'
# 输出文件名带版本号：桌面上会同时躺着好几版，不带版本号根本分不清哪个是新的
OUT_APK  = os.path.join(OUTDIR, APP_NAME + '-v' + VER_NAME + '.apk')

STEP = [0]


def head(title):
    STEP[0] += 1
    print('\n' + '=' * 62)
    print(' 步骤 %d/%d · %s' % (STEP[0], 6, title))
    print('=' * 62, flush=True)


def run(cmd, what='', allow_fail=False):
    """跑一个命令；失败就把输出全打出来，别让人猜"""
    print('  $ ' + (cmd if isinstance(cmd, str) else ' '.join(cmd)), flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (r.stdout or '') + (r.stderr or '')
    if r.returncode != 0 and not allow_fail:
        print('\n  ✗ %s 失败（退出码 %d）' % (what or '命令', r.returncode))
        print('  ── 输出 ──')
        for line in out.strip().splitlines()[-40:]:
            print('  ' + line)
        sys.exit(1)
    return out


def need(path, label):
    if not os.path.exists(path):
        print('  ✗ 缺少 %s：%s' % (label, path))
        print('    先跑：C:\\Users\\28731\\android-toolchain\\install-sdk.bat')
        sys.exit(1)


def main():
    t0 = time.time()

    print('记账本 → APK 打包')
    print('  工程目录 %s' % PROJ)
    print('  工具链   %s' % TC)

    for p, l in [(JAVAC, 'javac'), (AAPT2, 'aapt2'), (ZIPALIGN, 'zipalign'),
                 (D8_JAR, 'd8.jar'), (SIGN_JAR, 'apksigner.jar'), (AJAR, 'android.jar')]:
        need(p, l)

    shutil.rmtree(BUILD, ignore_errors=True)
    os.makedirs(DEXDIR, exist_ok=True)
    os.makedirs(CLASSES, exist_ok=True)
    os.makedirs(GEN, exist_ok=True)

    # ── 1. 单文件 HTML → assets/index.html ──────────────────
    head('打包网页 → assets/index.html')
    node = os.environ.get('NODE_EXE', '')
    if not node or not os.path.exists(node):
        node = 'node'

    assets_dir = os.path.join(PROJ, 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    dst_html = os.path.join(assets_dir, 'index.html')

    # 直接用 build-single.js 构建到 assets 里 —— 和桌面那份单文件 HTML 同一套逻辑，
    # 保证 APK 里的页面跟你在浏览器里看到的是同一个版本（不重复维护两套打包）。
    r = subprocess.run([node, os.path.join(REPO, 'tools', 'build-single.js'), dst_html],
                       cwd=REPO, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    print('  ' + (r.stdout or '').strip().replace('\n', '\n  '))
    if r.returncode != 0 or not os.path.exists(dst_html):
        print('  ✗ 打包网页失败')
        print('  ' + (r.stderr or '')[-800:])
        sys.exit(1)
    kb = os.path.getsize(dst_html) / 1024.0
    print('  ✓ assets/index.html  %.1f KB' % kb)

    # ── 2. aapt2 编资源 + 链接 ─────────────────────────────
    head('aapt2 编译资源并链接 APK 骨架')
    run([AAPT2, 'compile', '--dir', os.path.join(PROJ, 'res'), '-o', RESZIP],
        'aapt2 compile')
    print('  ✓ res.zip')

    link = [
        AAPT2, 'link',
        '-o', BASEAPK,
        '-I', AJAR,
        '--manifest', os.path.join(PROJ, 'AndroidManifest.xml'),
        '-R', RESZIP,
        '-A', assets_dir,
        '--java', GEN,
        '--min-sdk-version', '21',
        '--target-sdk-version', '34',
        '--version-code', VER_CODE,
        '--version-name', VER_NAME,
        '--auto-add-overlay',
    ]
    out = run(link, 'aapt2 link')
    print('  ✓ base.apk  %.1f KB' % (os.path.getsize(BASEAPK) / 1024.0))
    for line in out.strip().splitlines()[:6]:
        print('    ' + line)

    # ── 3. javac + d8 ─────────────────────────────────────
    head('编译 Java 并转成 classes.dex')

    rjava = os.path.join(GEN, 'com', 'shouhu', 'ledger', 'R.java')
    need(rjava, 'aapt2 生成的 R.java')

    sources = [rjava, os.path.join(PROJ, 'java', 'com', 'shouhu', 'ledger', 'MainActivity.java')]
    run([JAVAC,
         '-encoding', 'UTF-8',
         '-source', '8', '-target', '8',
         '-nowarn',
         '-classpath', AJAR,
         '-d', CLASSES] + sources, 'javac')
    n_cls = sum(len([f for f in fs if f.endswith('.class')]) for _, _, fs in os.walk(CLASSES))
    print('  ✓ 编译出 %d 个 .class' % n_cls)

    clss = []
    for root, _, files in os.walk(CLASSES):
        for f in files:
            if f.endswith('.class'):
                clss.append(os.path.join(root, f))

    run([JAVA, '-cp', D8_JAR, 'com.android.tools.r8.D8',
         '--release', '--min-api', '21',
         '--lib', AJAR,
         '--output', DEXDIR] + clss, 'd8')
    dex = os.path.join(DEXDIR, 'classes.dex')
    need(dex, 'classes.dex')
    print('  ✓ classes.dex  %.1f KB' % (os.path.getsize(dex) / 1024.0))

    # ── 4. 把 dex 塞进 APK ─────────────────────────────────
    head('把 classes.dex 装进 APK')
    withdex = os.path.join(BUILD, 'withdex.apk')
    shutil.copyfile(BASEAPK, withdex)
    with zipfile.ZipFile(withdex, 'a', zipfile.ZIP_DEFLATED) as z:
        z.write(dex, 'classes.dex')
    with zipfile.ZipFile(withdex) as z:
        names = z.namelist()
    print('  ✓ APK 内容：')
    for n in sorted(names):
        print('      ' + n)

    # ── 5. zipalign ────────────────────────────────────────
    head('字节对齐（zipalign）')
    aligned = os.path.join(BUILD, 'aligned.apk')
    run([ZIPALIGN, '-f', '-p', '4', withdex, aligned], 'zipalign')
    print('  ✓ aligned.apk')

    # ── 6. 签名 ────────────────────────────────────────────
    head('签名（apksigner）')
    if not os.path.exists(KS):
        os.makedirs(os.path.dirname(KS), exist_ok=True)
        print('  首次打包，生成签名证书…')
        run([KEYTOOL, '-genkeypair',
             '-keystore', KS,
             '-alias', KS_ALIAS,
             '-keyalg', 'RSA', '-keysize', '2048',
             '-validity', '10000',
             '-storepass', KS_PASS, '-keypass', KS_PASS,
             '-dname', 'CN=Shouhu Ledger, OU=Personal, O=Personal, L=Shanghai, C=CN'],
            'keytool')
        print('  ✓ 已生成 %s' % KS)
    else:
        print('  ✓ 复用已有证书 %s' % KS)

    if os.path.exists(OUT_APK):
        os.remove(OUT_APK)

    run([JAVA, '-jar', SIGN_JAR, 'sign',
         '--ks', KS,
         '--ks-key-alias', KS_ALIAS,
         '--ks-pass', 'pass:' + KS_PASS,
         '--key-pass', 'pass:' + KS_PASS,
         '--v1-signing-enabled', 'true',
         '--v2-signing-enabled', 'true',
         '--v3-signing-enabled', 'true',
         '--out', OUT_APK, aligned], 'apksigner sign')

    # 验证签名
    v = run([JAVA, '-jar', SIGN_JAR, 'verify', '--verbose', OUT_APK],
            'apksigner verify', allow_fail=True)
    ok_v1 = 'v1 scheme (JAR signing): true' in v
    ok_v2 = 'v2 scheme (APK Signature Scheme v2): true' in v
    print('  ✓ 签名验证：v1=%s  v2=%s' % (ok_v1, ok_v2))

    # 读一下 APK 的包信息
    badging = run([AAPT2, 'dump', 'badging', OUT_APK], 'aapt2 dump', allow_fail=True)
    print('\n  ── APK 信息 ──')
    for line in badging.splitlines():
        if re.match(r'^(package|application-label|sdkVersion|targetSdkVersion|launchable-activity|uses-permission)', line):
            print('    ' + line.strip())

    size_mb = os.path.getsize(OUT_APK) / 1048576.0
    print('\n' + '=' * 62)
    print(' 打包完成  %.2f MB   耗时 %.1fs' % (size_mb, time.time() - t0))
    print(' 产物：%s' % OUT_APK)
    print('=' * 62)


if __name__ == '__main__':
    main()
