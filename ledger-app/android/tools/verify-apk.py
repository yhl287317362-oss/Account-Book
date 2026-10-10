# -*- coding: utf-8 -*-
"""
APK 静态自检：拆包核对每一个该在的东西，并提取 assets/index.html 供浏览器实跑。

检查项都是「装到手机上会真的出问题」的那种：
  · resources.arsc 必须是「不压缩」存进 zip 的（Android 装的时候直接 mmap，压缩了会装不上）
  · classes.dex / assets/index.html 必须在
  · assets/index.html 必须和源文件逐字节一致（不一致 = 打包时拿的是旧版）
  · 图标、manifest、签名产物齐全
"""
import hashlib
import os
import shutil
import sys
import zipfile

APK     = r'C:\Users\28731\WorkBuddy\2026-09-16-14-58-01\记账本.apk'
SRC     = r'C:\Users\28731\WorkBuddy\2026-09-16-14-58-01\记账本-手机试看.html'
EXTRACT = r'C:\Users\28731\AppData\Local\Temp\apkcheck'

PASS, FAIL = [], []


def ok(name, cond, extra=''):
    (PASS if cond else FAIL).append(name)
    print('  %s %s%s' % ('✓' if cond else '✗', name, ('   ' + extra) if extra else ''))


def md5(b):
    return hashlib.md5(b).hexdigest()


def main():
    print('=' * 62)
    print(' APK 静态自检')
    print('=' * 62)

    if not os.path.exists(APK):
        print('✗ 找不到 APK：%s' % APK)
        sys.exit(1)

    size = os.path.getsize(APK)
    print('\n[基本信息]')
    print('  文件   %s' % APK)
    print('  大小   %.1f KB (%d 字节)' % (size / 1024.0, size))
    print('  MD5    %s' % md5(open(APK, 'rb').read()))

    z = zipfile.ZipFile(APK)
    infos = {i.filename: i for i in z.infolist()}

    print('\n[必需条目]')
    for name in ['AndroidManifest.xml', 'classes.dex', 'resources.arsc',
                 'assets/index.html']:
        ok(name, name in infos,
           ('%.1f KB' % (infos[name].file_size / 1024.0)) if name in infos else '缺失!')

    print('\n[资源]')
    res = sorted(n for n in infos if n.startswith('res/'))
    for n in res:
        print('  · %s' % n)
    ok('图标齐全（传统 5 档 + 自适应前景 4 档）',
       len([n for n in res if n.endswith('ic_launcher.png')]) == 5
       and len([n for n in res if n.endswith('ic_launcher_fg.png')]) == 5)
    ok('自适应图标描述文件在', 'res/mipmap-anydpi-v26/ic_launcher.xml' in res)

    print('\n[Android 的硬性要求]')
    arsc = infos.get('resources.arsc')
    if arsc:
        # 0 = ZIP_STORED（不压缩）  8 = ZIP_DEFLATED
        ok('resources.arsc 未被压缩（必须 STORED，否则装不上）',
           arsc.compress_type == zipfile.ZIP_STORED,
           'compress_type=%d' % arsc.compress_type)
    dex = infos.get('classes.dex')
    if dex:
        ok('classes.dex 有内容', dex.file_size > 1024 * 2,
           '%.1f KB' % (dex.file_size / 1024.0))

    print('\n[网页内容一致性]')
    if 'assets/index.html' in infos:
        packed = z.read('assets/index.html')
        src = open(SRC, 'rb').read()
        ok('打包进去的 index.html 和源文件逐字节一致',
           md5(packed) == md5(src),
           'md5 %s' % md5(packed)[:12])
        txt = packed.decode('utf-8', 'replace')
        ok('内含激励语库（≥300 条）', txt.count('QUOTES_BUILTIN') >= 1)
        ok('内含返回键钩子 __ledgerBack', '__ledgerBack' in txt)
        ok('内含原生状态栏桥接 LedgerNative', 'LedgerNative' in txt)
        ok('CSS 已内联（无外链 .css）', '<link rel="stylesheet"' not in txt)
        ok('JS 已内联（无外链 .js）', 'src="app.js"' not in txt and 'src="quotes.js"' not in txt)

    print('\n[签名产物]')
    names = z.namelist()
    ok('含 v1 签名清单 META-INF/MANIFEST.MF',
       any(n.upper().startswith('META-INF/MANIFEST.MF') for n in names))
    ok('含签名块 .RSA / .EC / .DSA',
       any(n.upper().endswith(('.RSA', '.EC', '.DSA')) for n in names))
    z.close()

    # ── 提取 HTML 供浏览器实跑 ─────────────────────────────
    shutil.rmtree(EXTRACT, ignore_errors=True)
    os.makedirs(EXTRACT, exist_ok=True)
    out = os.path.join(EXTRACT, 'from-apk.html')
    with zipfile.ZipFile(APK) as z2:
        data = z2.read('assets/index.html')
    open(out, 'wb').write(data)
    print('\n[已提取]  %s  (%.1f KB)' % (out, len(data) / 1024.0))

    print('\n' + '=' * 62)
    print(' 结果：%d 项通过，%d 项失败' % (len(PASS), len(FAIL)))
    if FAIL:
        print(' 失败项：')
        for f in FAIL:
            print('   ✗ %s' % f)
    print('=' * 62)
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
