"""kodama.json（parse_kodama.py の出力）と typechart.json から js/data.js を生成する。

使い方:
  1. tools/scrape.sh で http://www.tohofes.com/data/kodama2.html?check=N を k2/ に保存
  2. python3 tools/parse_kodama.py   -> kodama.json
  3. python3 tools/build_data.py kodama.json typechart.json > js/data.js
"""
import json, sys

kodama = json.load(open(sys.argv[1]))
chart = json.load(open(sys.argv[2]))

descs = []
desc_idx = {}
def di(s):
    if s not in desc_idx:
        desc_idx[s] = len(descs)
        descs.append(s)
    return desc_idx[s]

out = []
for k in kodama:
    if '【未】' in k['name'] or not k['spells']:
        continue
    out.append([
        k['id'], k['name'], ''.join(k['types']), k['hp'], k['atk'], k['df'], k['spd'],
        [[s['name'], s['type'], s['pow'], int(s['cost']) if s['cost'].isdigit() else 0, s['price'], di(s['desc'])] for s in k['spells']],
        [[s['name'], s['desc']] for s in k['skills']],
    ])

order = chart['order']
print('/* 自動生成ファイル: tools/build_data.py で再生成してください。')
print(' * 出典: 東方玉神楽 コダマデータ【玉霊姫版】 http://www.tohofes.com/data/kodama2.html */')
print('(function(){')
print('var T=' + json.dumps(order, ensure_ascii=False) + ';')
print('var C=' + json.dumps({t: chart['chart'][t] for t in order}, ensure_ascii=False, separators=(',', ':')) + ';')
print('var S=' + json.dumps(descs, ensure_ascii=False, separators=(',', ':')) + ';')
print('var K=[')
for row in out:
    print(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + ',')
print('];')
print('''window.GK_DATA={types:T,chart:C,kodama:K.map(function(r){return{
id:r[0],name:r[1],types:Array.from(r[2]),hp:r[3],atk:r[4],df:r[5],spd:r[6],
spells:r[7].map(function(s){return{name:s[0],type:s[1],pow:s[2],cost:s[3],price:s[4],desc:S[s[5]]}}),
skills:r[8].map(function(s){return{name:s[0],desc:s[1]}})}})};''')
print('})();')
