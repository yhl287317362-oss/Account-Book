# -*- coding: utf-8 -*-
"""
生成两张「整图规格 1080 × 4520」的 PNG：

  1. 主题图示例-海洋.png        —— 可以直接在 App「设置 → 主题外观」里上传试效果
  2. 主题图规格-1080x4520.png   —— 带分区标注 + 定位网格，丢给画图的人照着画

分区（和 app.js 的 THEME_SPEC、style.css 第 ⑤ 节保持一致）：
  ① 首页顶栏   1080 × 200   @ (0,    0)
  ② 统计顶栏   1080 × 560   @ (0,  200)
  ③ 底部栏     1080 × 160   @ (0,  760)
  ④ 首页装饰层 1080 × 1800  @ (0,  920)     透明底
  ⑤ 统计装饰层 1080 × 1800  @ (0, 2720)     透明底

跑法：
  C:/Users/28731/.workbuddy/binaries/python/envs/default/Scripts/python.exe \
    tools/gen-sample-theme.py <输出目录>

注意：①②③ 上方压的是深色文字（自制主题走 --hero-text:#1f2733），
      所以这三块要画浅色；④⑤ 浮在白色卡片上，用中低透明度的彩色。
"""
import sys, os, math

from PIL import Image, ImageDraw

W, H = 1080, 4520
SS   = 2                                    # 超采样倍数，缩小后自带抗锯齿

ZONES = [
    ('①', '首页顶栏',   0,       200,  '深色文字压在上面 → 画浅色'),
    ('②', '统计顶栏',   200,     560,  '深色文字压在上面 → 画浅色'),
    ('③', '底部栏',     760,     160,  '深色文字压在上面 → 画浅色'),
    ('④', '首页装饰层', 920,     1800, '透明底，浮在白色卡片上 → 用彩色'),
    ('⑤', '统计装饰层', 2720,    1800, '透明底，浮在白色卡片上 → 用彩色'),
]

FONT_CANDIDATES = [
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/msyhbd.ttc',
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/simsun.ttc',
]


def font(size):
    from PIL import ImageFont
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def layer(box, painter):
    """在 box 范围内画一块，2× 超采样后缩回，边缘更干净。"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    lay = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    painter(ImageDraw.Draw(lay), w * SS, h * SS)
    return lay.resize((w, h), Image.LANCZOS), (x0, y0)


# ────────────────────────── 基础图形 ──────────────────────────
def vgrad(d, w, h, c1, c2, alpha=255):
    for i in range(h):
        d.line([(0, i), (w, i)], fill=lerp(c1, c2, i / max(1, h - 1)) + (alpha,))


def cloud(d, cx, cy, r, color):
    for dx, dy, rr in [(0, 0, r), (r * .76, r * .12, r * .72), (-r * .78, r * .16, r * .68),
                       (r * .30, -r * .40, r * .62), (-r * .36, -r * .32, r * .55)]:
        d.ellipse([cx + dx - rr, cy + dy - rr, cx + dx + rr, cy + dy + rr], fill=color)
    d.ellipse([cx - r * 1.02, cy + r * .04, cx + r * 1.06, cy + r * .98], fill=color)


def starfish(d, cx, cy, r, color, rot=-90):
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36)
        rr = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=color)
    for i in range(5):
        a = math.radians(rot + i * 72)
        d.line([(cx, cy), (cx + r * .78 * math.cos(a), cy + r * .78 * math.sin(a))],
               fill=(255, 255, 255, 70), width=max(2, int(r * .07)))


def shell(d, cx, cy, r, color):
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 195, 345, fill=color)
    for i in range(6):
        a = math.radians(198 + i * 29.4)
        d.line([(cx, cy), (cx + r * math.cos(a), cy + r * math.sin(a))],
               fill=(255, 255, 255, 90), width=max(2, int(r * .06)))
    d.ellipse([cx - r * .16, cy - r * .16, cx + r * .16, cy + r * .16], fill=(255, 255, 255, 110))


def bubble(d, cx, cy, r, color, wid=3):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=wid)
    d.ellipse([cx - r * .42, cy - r * .62, cx - r * .06, cy - r * .26], fill=color)


def fish(d, cx, cy, r, color):
    d.ellipse([cx - r, cy - r * .56, cx + r, cy + r * .56], fill=color)
    d.polygon([(cx - r * .86, cy), (cx - r * 1.72, cy - r * .62), (cx - r * 1.72, cy + r * .62)], fill=color)
    d.ellipse([cx + r * .34, cy - r * .22, cx + r * .56, cy], fill=(255, 255, 255, 210))


def weed(d, x, y, hgt, color, amp=26, phase=0):
    pts = []
    n = 22
    for i in range(n + 1):
        t = i / n
        pts.append((x + math.sin(phase + t * 3.1) * amp * t,
                    y - hgt * t))
    for off in (-1, 0, 1):
        d.line([(px + off * 7, py) for px, py in pts], fill=color,
               width=max(3, int(hgt * .022)), joint='curve')


def wave(d, w, cy, amp, color, wid, phase=0.0):
    pts = [(x, cy + math.sin(phase + x / w * 5.4) * amp) for x in range(0, w + 1, 6)]
    d.line(pts, fill=color, width=wid, joint='curve')


# ────────────────────────── ① ② ③ 背景条 ──────────────────────────
def draw_zone1(d, w, h):
    """首页顶栏：干净的浅蓝天空 + 右上角一朵柔云"""
    vgrad(d, w, h, (170, 215, 244), (229, 244, 253))
    cloud(d, w * .85, h * .34, h * .185, (255, 255, 255, 150))
    cloud(d, w * .71, h * .64, h * .120, (255, 255, 255, 105))


def draw_zone2(d, w, h):
    """统计顶栏：天空渐变 + 云只放在下半部空白处
    （上半部依次是：月份条、支出/收入分段、共支出金额 —— 别在那儿放东西）"""
    vgrad(d, w, h, (148, 203, 240), (237, 249, 255))
    cloud(d, w * .86,  h * .885, h * .062, (255, 255, 255, 150))
    cloud(d, w * .575, h * .965, h * .046, (255, 255, 255, 118))
    cloud(d, w * .965, h * .775, h * .048, (255, 255, 255, 112))


def draw_zone3(d, w, h):
    """底部栏：浅色海面 + 两道浪花（文字是深色，所以整体走浅）"""
    vgrad(d, w, h, (213, 239, 253), (244, 251, 255))
    wave(d, w, h * .46, h * .11, (152, 210, 244, 145), max(3, int(h * .032)))
    wave(d, w, h * .80, h * .07, (255, 255, 255, 190), max(2, int(h * .028)), phase=1.6)


# ────────────────────────── ④ ⑤ 自由装饰层 ──────────────────────────
# 装饰层是浮在白色卡片【上层】的，一定和文字重叠。
# 所以这里统一走「淡水印」路线：低透明度 + 中等尺寸，有氛围但不抢字。
C_SAND  = (243, 178, 108, 62)    # 海星
C_SHELL = (240, 160, 175, 56)    # 贝壳
C_FISH  = (132, 190, 234, 58)    # 小鱼
C_BUB   = (146, 198, 234, 72)    # 气泡
C_WEED  = (128, 196, 162, 58)    # 海草


def draw_zone4(d, w, h):
    """首页装饰层：透明底，淡水印风格的贝壳 / 海星 / 小鱼 / 气泡"""
    # 顶部卡片缝隙一带
    starfish(d, w * .075, h * .028, h * .017, C_SAND, rot=-104)
    bubble(d, w * .74,  h * .020, h * .009, C_BUB)
    bubble(d, w * .795, h * .037, h * .006, C_BUB)
    shell(d, w * .945, h * .088, h * .019, C_SHELL)

    # 「最近常用」卡右侧空白
    fish(d, w * .925, h * .240, h * .026, C_FISH)
    bubble(d, w * .13, h * .200, h * .008, C_BUB)

    # 卡片下沿缝隙
    starfish(d, w * .10, h * .425, h * .016, C_SAND, rot=-72)
    weed(d, w * .955, h * .50, h * .10, C_WEED, amp=16, phase=.6)

    # 流水区左右两侧
    bubble(d, w * .045, h * .60, h * .010, C_BUB)
    fish(d, w * .93, h * .655, h * .022, C_FISH)
    shell(d, w * .095, h * .775, h * .017, C_SHELL)
    bubble(d, w * .145, h * .555, h * .006, C_BUB)

    # 底部（滚下去才看得到）
    starfish(d, w * .89, h * .885, h * .017, C_SAND, rot=-120)
    weed(d, w * .06, h * .93, h * .09, C_WEED, amp=15, phase=2.1)
    bubble(d, w * .50, h * .965, h * .008, C_BUB)


def draw_zone5(d, w, h):
    """统计装饰层：同风格换元素，避免和首页撞图"""
    bubble(d, w * .085, h * .030, h * .010, C_BUB)
    bubble(d, w * .135, h * .052, h * .006, C_BUB)
    shell(d, w * .94, h * .026, h * .018, C_SHELL)

    weed(d, w * .055, h * .175, h * .115, C_WEED, amp=17, phase=.2)
    fish(d, w * .935, h * .235, h * .023, C_FISH)
    starfish(d, w * .875, h * .395, h * .016, C_SAND, rot=-84)

    bubble(d, w * .17, h * .545, h * .008, C_BUB)
    shell(d, w * .075, h * .545, h * .017, C_SHELL)
    weed(d, w * .95, h * .70, h * .105, C_WEED, amp=16, phase=1.4)
    fish(d, w * .80, h * .815, h * .021, C_FISH)
    starfish(d, w * .12, h * .915, h * .017, C_SAND, rot=-100)
    bubble(d, w * .58, h * .975, h * .008, C_BUB)


# ────────────────────────── 组装 ──────────────────────────
def build_sample():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    def put(zx, zy, zw, zh, painter):
        lay, (ox, oy) = layer((zx, zy, zx + zw, zy + zh), painter)
        img.alpha_composite(lay, (ox, oy))

    put(0, 0,    1080, 200,  draw_zone1)
    put(0, 200,  1080, 560,  draw_zone2)
    put(0, 760,  1080, 160,  draw_zone3)
    put(0, 920,  1080, 1800, draw_zone4)
    put(0, 2720, 1080, 1800, draw_zone5)
    return img


def build_spec_sheet():
    """标注图：分区框 + 说明文字 + 定位网格"""
    img = Image.new('RGBA', (W, H), (250, 251, 253, 255))
    d = ImageDraw.Draw(img)

    tints = [(90, 160, 220), (90, 200, 190), (150, 150, 210), (240, 170, 90), (235, 120, 150)]

    for (no, name, y, h, note), tint in zip(ZONES, tints):
        # 底色（很淡）
        d.rectangle([0, y, W, y + h], fill=tint + (26,))
        # 边框
        d.rectangle([2, y + 1, W - 3, y + h - 2], outline=tint + (255,), width=4)
        # 网格：每 100px 一条浅线，帮人定位
        for gy in range(y + 100, y + h, 100):
            d.line([(2, gy), (W - 3, gy)], fill=tint + (60,), width=1)
        for gx in range(100, W, 100):
            d.line([(gx, y + 1), (gx, y + h - 2)], fill=tint + (40,), width=1)
        # 中轴线
        d.line([(W // 2, y + 1), (W // 2, y + h - 2)], fill=tint + (110,), width=2)

        # 文字块（高度控制在 150，① 区只有 200 高，别把整块盖满）
        f_big = font(56)
        f_mid = font(34)
        f_sm  = font(26)
        pad = 26
        BH = 150
        d.rectangle([0, y, W, y + BH], fill=(255, 255, 255, 234))
        d.rectangle([0, y + BH, W, y + BH + 5], fill=tint + (255,))
        d.text((pad, y + 14), no + '  ' + name, font=f_big, fill=tint + (255,))
        d.text((pad, y + 84),
               '尺寸 1080 × ' + str(h) + '      左上角坐标 (0, ' + str(y) + ')',
               font=f_mid, fill=(70, 82, 98, 255))
        d.text((W - pad - d.textlength('(' + str(y) + ' ~ ' + str(y + h) + ')', font=f_mid), y + 16),
               '(' + str(y) + ' ~ ' + str(y + h) + ')', font=f_mid, fill=(158, 168, 182, 255))

        # 第一块顺便当总说明，省得顶部再压一条横条把 ① 区的标注盖住
        if no == '①':
            d.text((pad, y + 118),
                   '整图 1080 × 4520    ·    浅灰网格 = 每 100px    ·    右侧数字 = y 坐标',
                   font=f_sm, fill=(146, 156, 170, 255))

        # 用途说明只写在大块里（小块写不下，会和标注打架）
        if h > 300:
            d.text((pad, y + h - 52), note, font=f_sm, fill=tint + (235,))

    # 32px 竖直标尺（每 200px 一个刻度）
    f_ruler = font(26)
    for yy in range(0, H, 200):
        d.line([(W - 96, yy), (W - 3, yy)], fill=(150, 160, 175, 160), width=1)
        d.text((W - 92, yy + 4), str(yy), font=f_ruler, fill=(140, 150, 165, 255))

    return img


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    os.makedirs(outdir, exist_ok=True)

    a = os.path.join(outdir, '主题图示例-海洋.png')
    build_sample().save(a, 'PNG', optimize=True)
    print('已生成 ' + a + '  (' + str(round(os.path.getsize(a) / 1024)) + ' KB)')

    b = os.path.join(outdir, '主题图规格-1080x4520.png')
    build_spec_sheet().save(b, 'PNG', optimize=True)
    print('已生成 ' + b + '  (' + str(round(os.path.getsize(b) / 1024)) + ' KB)')


if __name__ == '__main__':
    main()
