# 単体版（画像・シナリオ込みの1ファイル）を作るスクリプト
#   python3 build.py  →  アカルア_単体版.html
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
sc = open(os.path.join(here, 'scenario.js'), encoding='utf-8').read()
s = s.replace('<script src="scenario.js"></script>', '<script>\n' + sc + '\n</script>')
for f in os.listdir(os.path.join(here, 'img')):
    if f.endswith('.png'):
        b = base64.b64encode(open(os.path.join(here, 'img', f), 'rb').read()).decode()
        s = s.replace(f"'img/{f}'", f"'data:image/png;base64,{b}'")
open(os.path.join(here, 'アカルア_単体版.html'), 'w', encoding='utf-8').write(s)
print('built', len(s))
