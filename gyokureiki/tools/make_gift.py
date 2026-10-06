"""ギフトコードの登録行を作る。出力を js/gifts.js の GK_GIFTS 配列に貼り付ける。

使い方:
  python3 tools/make_gift.py コード "タイトル" '{"money":10000,"items":{"chibi":3},"kodama":[{"id":9001,"lv":20}]}' [開始日] [終了日]
例:
  python3 tools/make_gift.py HITORI-GIFT "ひとり配布" '{"kodama":[{"id":9001,"lv":20}]}' 2026-10-01 2026-12-31

報酬（rewards）に使えるもの:
  money: 銭 / items: {chibi, random, book, scroll} / contracts: [{id, lv}] 契約書 / kodama: [{id, lv}] 直接加入
"""
import hashlib, json, re, sys, unicodedata

SALT = 'gyokureiki-gift-v1:'

def normalize(code):
    out = []
    for c in code:
        o = ord(c)
        if 0xFF01 <= o <= 0xFF5E:
            c = chr(o - 0xFEE0)
        out.append(c)
    s = re.sub(r'[\s\-‐－ー_　]', '', ''.join(out))
    return s.upper()

if len(sys.argv) < 4:
    print(__doc__); sys.exit(1)
code, title, rewards = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
entry = {'h': hashlib.sha256((SALT + normalize(code)).encode()).hexdigest(), 'title': title, 'rewards': rewards}
if len(sys.argv) > 4 and sys.argv[4]: entry['from'] = sys.argv[4]
if len(sys.argv) > 5 and sys.argv[5]: entry['until'] = sys.argv[5]
print(f'  // コード: {normalize(code)}（配布時はこの行のコメントを消してください）')
print('  ' + json.dumps(entry, ensure_ascii=False) + ',')
