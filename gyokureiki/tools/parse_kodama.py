import re,json,os,glob,html
T={11:'無',12:'樹',13:'闘',14:'毒',15:'地',16:'風',17:'虫',18:'岩',19:'鋼',20:'霊',21:'水',22:'雷',23:'氷',24:'理',25:'炎',26:'神',27:'闇',28:'然'}
def clean(s):
    s=re.sub(r'<br\s*/?>','',s); s=re.sub(r'<[^>]*>','',s); return html.unescape(s).strip()
out=[]
for f in sorted(glob.glob('k2/*.html'),key=lambda x:int(os.path.basename(x)[:-5])):
    h=open(f).read()
    if 'KodamaWrap' not in h: continue
    tables=re.findall(r'<table[^>]*>(.*?)</table>',h[h.index('KodamaWrap'):],re.S)
    k=None; spells=[]; skills=[]
    for t in tables:
        rows=re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S)
        head=clean(rows[0]) if rows else ''
        for r in rows[1:]:
            cells=re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)
            if head.startswith('画像No'):
                types=[T[int(x)] for x in re.findall(r'type/(\d+)\.gif',r)]
                c=[clean(x) for x in cells]
                nums=[int(x) for x in c if re.fullmatch(r'\d+',x)]
                k=dict(id=nums[0],name=c[1],types=list(dict.fromkeys(types)),hp=nums[1],atk=nums[2],df=nums[3],spd=nums[4],total=nums[5])
            elif head.startswith('スキル名'):
                c=[clean(x) for x in cells]; skills.append(dict(name=c[0],desc=c[1]))
            elif head.startswith('スペル名'):
                ty=re.findall(r'type/(\d+)\.gif',r)
                c=[clean(x) for x in cells]
                spells.append(dict(name=c[0],type=T[int(ty[0])] if ty else '無',pow=c[2],cost=c[3],price=c[4],desc=c[5]))
    if k:
        k['skills']=skills;k['spells']=spells;out.append(k)
json.dump(out,open('kodama.json','w'),ensure_ascii=False,indent=0)
print(len(out))
