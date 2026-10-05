"""img/kodama/*.gif を走査して js/sprites.js を生成する。
立ち絵の取得元: http://www.tohofes.com/img/kakera/0/{コダマNo}.gif
使い方: python3 tools/build_sprites.py  （gyokureiki/ で実行）"""
import os, re
ids = sorted(int(m.group(1)) for f in os.listdir('img/kodama') if (m := re.fullmatch(r'(\d+)\.(gif|png)', f)))
files = {i: next(f'img/kodama/{i}.{e}' for e in ('png', 'gif') if os.path.exists(f'img/kodama/{i}.{e}')) for i in ids}
with open('js/sprites.js', 'w') as w:
    w.write('/* 自動生成: tools/build_sprites.py\n * img/kodama/ に {コダマNo}.png か .gif を置いて再生成すると差し替えられます（png優先）。 */\n')
    w.write('window.GK_SPRITES = {\n' + ''.join(f"  {i}: '{files[i]}',\n" for i in ids) + '};\n')
print(len(ids), 'sprites')
