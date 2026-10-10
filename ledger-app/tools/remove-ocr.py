# -*- coding: utf-8 -*-
"""
从 app.js 里整块摘除「识图记账」功能。
全部用内容锚点匹配，不依赖行号；每一步都断言锚点唯一，防止删错。
"""
import io
import sys

P = 'app.js'
s = io.open(P, encoding='utf-8').read()
orig_len = len(s)


def cut(start_anchor, end_anchor, keep_end=True, label=''):
    """删掉 [start_anchor, end_anchor) 之间的内容（end_anchor 保留）。"""
    global s
    assert s.count(start_anchor) == 1, '起点锚点不唯一或不存在: %r (%s)' % (start_anchor[:60], label)
    i = s.index(start_anchor)
    assert s.count(end_anchor) == 1, '终点锚点不唯一或不存在: %r (%s)' % (end_anchor[:60], label)
    j = s.index(end_anchor)
    assert j > i, '终点在起点之前: %s' % label
    s = s[:i] + s[j:]
    print('  已切除 %-28s (%d 字符)' % (label, j - i))


# 1) openSheet 里的 setOcrMode 调用
s2 = s.replace("""  syncEntry();
  setOcrMode(curType === 'ocr');

  $('sheetLayer').classList.add('is-on');""",
"""  syncEntry();

  $('sheetLayer').classList.add('is-on');""")
assert s2 != s, 'openSheet 未命中'
s = s2
print('  已切除 openSheet 的 setOcrMode')

# 2) closeSheet 里两行
s2 = s.replace("""  $('sheetLayer').classList.remove('is-on');
  $('sheetLayer').classList.remove('sheet-ocr-mode');
  $('ocrPanel').hidden = true;
  $('catPills').classList.remove('is-on');""",
"""  $('sheetLayer').classList.remove('is-on');
  $('catPills').classList.remove('is-on');""")
assert s2 != s, 'closeSheet 未命中'
s = s2
print('  已切除 closeSheet 的两行')

# 2b) syncEntry 开头的识图守卫
s2 = s.replace("""function syncEntry(){
  if(curType === 'ocr') return;            // 识图模式没有常规输入，不解析
  parsed  = parseEntry($('entryInput').value);""",
"""function syncEntry(){
  parsed  = parseEntry($('entryInput').value);""")
assert s2 != s, 'syncEntry 守卫未命中'
s = s2
print('  已切除 syncEntry 的识图守卫')

# 3) 整个识图模块（注释块 → renderTypeSeg 之前）
cut('/* ────────────────────────────────────────────────────────────\n   识图记账',
    'function renderTypeSeg(){', label='识图模块主体')

# 4) typeSeg 点击里的 ocr 分支
s2 = s.replace("""    curType = btn.dataset.type;
    if(curType !== 'ocr' && !findCat(curType, curCat)){ curCat = null; catLocked = false; }
    renderTypeSeg();
    syncEntry();
    setOcrMode(curType === 'ocr');
  });""",
"""    curType = btn.dataset.type;
    if(!findCat(curType, curCat)){ curCat = null; catLocked = false; }
    renderTypeSeg();
    syncEntry();
  });""")
assert s2 != s, 'typeSeg 未命中'
s = s2
print('  已切除 typeSeg 的 ocr 分支')

# 5) bindEvents 里整个识图事件段（到 btnDate 绑定之前）
cut('  /* 识图记账 */', "  $('btnDate').addEventListener('click', pickDate);", label='识图事件绑定')

# 6) __ledger 导出里的 parseBillText
s2 = s.replace('  parseEntry, guessCat, CATS, QUOTES_BUILTIN, THEME_SPEC,\n  parseBillText, timeDDOptions,',
               '  parseEntry, guessCat, CATS, QUOTES_BUILTIN, THEME_SPEC,\n  timeDDOptions,')
assert s2 != s, '__ledger 导出未命中'
s = s2
print('  已切除 __ledger.parseBillText 导出')

# 终检：不应再有识图痕迹
for bad in ['setOcrMode', 'ocrItems', 'ocrPanel', 'parseBillText', 'hasEmbeddedOcr',
            'runOcrFile', 'renderOcrList', 'importOcrItems', 'catPickGrid', 'fileOcr',
            "data-type=\"ocr\"", "'ocr'"]:
    assert bad not in s, '残留识图引用: %r' % bad

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('完成：%d → %d 字符（-%d）' % (orig_len, len(s), orig_len - len(s)))
