import re,sys
from fontTools.ttLib import TTFont
from fontTools import subset, merge
W=sys.argv[1]
extra=open(sys.argv[2],encoding='utf8').read() if len(sys.argv)>2 else ''
chars=set(extra)
for row in list(range(1,9)):
    for cell in range(1,95):
        try: chars.add(bytes([0xA0+row,0xA0+cell]).decode('euc_jp'))
        except: pass
css=open(f'package/{W}.css').read()
cps=set(ord(c) for c in chars)
files=[]
for m in re.finditer(r'/\* (m-plus-rounded-1c-\[?(\d+|japanese)\]?-%s-normal) \*/.*?unicode-range: ([^;]+);'%W,css,re.S):
    rng=m.group(3); s=set()
    for part in rng.split(','):
        part=part.strip()[2:]
        if '-' in part:
            a,b=part.split('-'); s.update(range(int(a,16),int(b,16)+1))
        else: s.add(int(part,16))
    need=cps&s
    if need: files.append((m.group(1).replace('[','').replace(']',''),need))
print(len(files),'slices')
import tempfile,os
tmp=tempfile.mkdtemp(); outs=[]
for name,need in files:
    f=TTFont(f'package/files/{name}.woff')
    o=subset.Options(); o.layout_features=['*']; o.notdef_outline=True; o.name_IDs=['*']
    sub=subset.Subsetter(o); sub.populate(unicodes=need); sub.subset(f)
    f.flavor=None; p=f'{tmp}/{name}.ttf'; f.save(p); outs.append(p)
m=merge.Merger(); font=m.merge(outs)
font.flavor='woff2'; font.save(f'mplus-rounded-ja-{W}.woff2')
import os; print(os.path.getsize(f'mplus-rounded-ja-{W}.woff2'))
