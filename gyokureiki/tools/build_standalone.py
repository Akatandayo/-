"""画像・データ・スクリプトをすべて埋め込んだ単体HTMLを生成する。
使い方: python3 tools/build_standalone.py  （gyokureiki/ で実行） -> dist/gyokureiki.html"""
import base64, os, re
html = open('index.html', encoding='utf-8').read()
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
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + open('css/style.css', encoding='utf-8').read() + '\n</style>')
os.makedirs('dist', exist_ok=True)
open('dist/gyokureiki.html', 'w', encoding='utf-8').write(html)
print('dist/gyokureiki.html', os.path.getsize('dist/gyokureiki.html') // 1024, 'KB')
