# -*- coding: utf-8 -*-
"""
生成记账本的应用图标。

产出两类：
  1. mipmap-<dpi>/ic_launcher.png      —— 传统图标（Android 7 及以下直接用这个）
  2. mipmap-<dpi>/ic_launcher_fg.png   —— 自适应图标的前景层（透明底，只有符号）

Android 8+ 会用 mipmap-anydpi-v26/ic_launcher.xml，底色由 drawable/ic_bg.xml 提供，
前景就是这里的 ic_launcher_fg.png —— 所以那个文件的符号要留在中间安全区里，
不然系统裁成圆形/水滴时会切掉笔画。
"""
import os
from PIL import Image, ImageDraw

RES = r'C:\Users\28731\WorkBuddy\2026-09-16-14-58-01\ledger-app\android\res'

# dpi 倍数 → (传统图标边长, 自适应前景边长)
#   传统图标 48dp；自适应前景 108dp（中间 72dp 是安全区）
DPIS = {
    'mdpi':    (48,  108),
    'hdpi':    (72,  162),
    'xhdpi':   (96,  216),
    'xxhdpi':  (144, 324),
    'xxxhdpi': (192, 432),
}

BG_TOP = (0x63, 0xAD, 0xF5)      # #63ADF5  和 ic_bg.xml 的渐变对齐
BG_BOT = (0x2A, 0x67, 0xBE)      # #2A67BE


def diag_gradient(size, c1, c2):
    """左上 → 右下的线性渐变"""
    g = Image.new('RGB', (size, size))
    px = g.load()
    span = 2 * (size - 1) if size > 1 else 1
    for y in range(size):
        for x in range(size):
            t = (x + y) / span
            px[x, y] = (
                int(c1[0] + (c2[0] - c1[0]) * t),
                int(c1[1] + (c2[1] - c1[1]) * t),
                int(c1[2] + (c2[2] - c1[2]) * t),
            )
    return g


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def yen_layer(size, half_w_ratio, stroke_ratio, color):
    """画一个几何「¥」：两斜笔 + 一竖 + 两横，超采样后缩回来做抗锯齿"""
    SS = 4
    S = size * SS
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cx = cy = S / 2.0
    s = S * half_w_ratio
    lw = max(2, int(round(S * stroke_ratio)))
    r = lw / 2.0

    # Y 的两笔（从上方左右汇聚到中心偏上）
    join_y = cy + s * 0.02
    d.line([(cx - s, cy - s * 1.02), (cx, join_y)], fill=color, width=lw)
    d.line([(cx + s, cy - s * 1.02), (cx, join_y)], fill=color, width=lw)
    # 竖笔
    d.line([(cx, join_y), (cx, cy + s * 1.12)], fill=color, width=lw)

    # 两横
    hw = s * 0.84
    bar1 = cy + s * 0.44
    bar2 = cy + s * 0.82
    d.line([(cx - hw, bar1), (cx + hw, bar1)], fill=color, width=lw)
    d.line([(cx - hw, bar2), (cx + hw, bar2)], fill=color, width=lw)

    # 所有端点 / 拐角补圆头，笔画才不会是秃的
    caps = [
        (cx - s, cy - s * 1.02), (cx + s, cy - s * 1.02), (cx, cy + s * 1.12),
        (cx - hw, bar1), (cx + hw, bar1), (cx - hw, bar2), (cx + hw, bar2),
        (cx, join_y),
    ]
    for p in caps:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)

    return layer.resize((size, size), Image.LANCZOS)


def main():
    white = (255, 255, 255, 255)
    for dpi, (legacy, fg) in DPIS.items():
        out = os.path.join(RES, 'mipmap-' + dpi)
        os.makedirs(out, exist_ok=True)

        # ── 传统图标：圆角方底 + 白色 ¥ ──────────────────────
        SS = 4
        big = legacy * SS
        base = diag_gradient(big, BG_TOP, BG_BOT).convert('RGBA')
        base.putalpha(rounded_mask(big, int(big * 0.235)))
        base.alpha_composite(yen_layer(big, 0.215, 0.076, white))
        base.resize((legacy, legacy), Image.LANCZOS).save(
            os.path.join(out, 'ic_launcher.png'), 'PNG', optimize=True)

        # ── 自适应前景：透明底 + 白色 ¥（留在中间安全区）────────
        fg_img = yen_layer(fg, 0.200, 0.070, white)
        fg_img.save(os.path.join(out, 'ic_launcher_fg.png'), 'PNG', optimize=True)

    print('图标生成完毕：')
    for dpi, (legacy, fg) in DPIS.items():
        p = os.path.join(RES, 'mipmap-' + dpi)
        print('  %-9s ic_launcher.png %-4d   ic_launcher_fg.png %d' % (dpi, legacy, fg))


if __name__ == '__main__':
    main()
