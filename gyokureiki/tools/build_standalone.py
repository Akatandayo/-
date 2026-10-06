"""画像・データ・スクリプトをすべて埋め込んだ単体HTMLを生成する。
使い方: python3 tools/build_standalone.py  （gyokureiki/ で実行）
  -> dist/gyokureiki.html         通常版
  -> debug.html                   デバッグ版（GitHub Pages 等でそのまま開ける）
  -> dist/gyokureiki-debug.html   デバッグ版（単体HTML）"""
import base64, os, re, sys
src_html = open('index.html', encoding='utf-8').read()

def debug_html(h):
    """開発者モード付き：セーブ領域を分け、debug.js を読み込む"""
    h = h.replace('<title>東方玉霊姫 対戦シミュレータ</title>', '<title>【DEBUG】東方玉霊姫 対戦シミュレータ</title>')
    h = h.replace('<script src="js/data.js"></script>', '<script>window.GK_STORAGE_PREFIX = "gkdbg_";</script>\n<script src="js/data.js"></script>', 1)
    h = h.replace('<script src="js/app.js"></script>', '<script src="js/app.js"></script>\n<script src="js/debug.js"></script>', 1)
    return h
def inline_js(m):
    src = m.group(1)
    if src == 'js/sprites.js':
        ns = {}
        body = open(src, encoding='utf-8').read()
        items = re.findall(r"(\d+): '([^']+)'", body)
        parts = []
        for i, path in items:
            mime = 'image/png' if path.endswith('.png') else 'image/gif'
            parts.append(f'{i}:"data:{mime};base64,{base64.b64encode(open(path, "rb").read()).decode()}"')
        return '<script>window.GK_SPRITES={' + ','.join(parts) + '};</script>'
    return '<script>\n' + open(src, encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>'
def standalone(html):
    html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)
    return html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + open('css/style.css', encoding='utf-8').read() + '\n</style>')

os.makedirs('dist', exist_ok=True)
dbg = debug_html(src_html)
open('debug.html', 'w', encoding='utf-8').write(dbg)
for path, html in [('dist/gyokureiki.html', standalone(src_html)), ('dist/gyokureiki-debug.html', standalone(dbg))]:
    open(path, 'w', encoding='utf-8').write(html)
    print(path, os.path.getsize(path) // 1024, 'KB')
