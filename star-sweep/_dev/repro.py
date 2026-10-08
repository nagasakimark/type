import sys; sys.path.insert(0,'.')
from ss_common import *
s=Session()
s.ev("__ssDev.god(true)")
# lock a power-up during 'clear' and flow into the map
s.ev("__ssDev.goto(0,3)")
s.pg.wait_for_timeout(500)
s.ev("(()=>{__ssDev.kill(); __ssDev.set({queue:[]}); __ssDev.power('bomb');})()")
for i in range(40):
    st=s.ev("__SS_STATE()")
    if st['enemies'] and st['enemies'][0]['ok']: break
    s.pg.wait_for_timeout(50)
print(st['mode'], [ (e['text'],e['y'],e['ok']) for e in st['enemies']])
k=st['enemies'][0]['next']; s.pg.keyboard.type(k); s.pg.wait_for_timeout(200)
print('lock', s.ev("__SS_STATE().lock"))
s.ev("__ssDev.speed(1)")
for i in range(60):
    st=s.ev("__SS_STATE()")
    if st['mode']=='fight' and st['sector']==1: break
    s.pg.wait_for_timeout(400)
print(st['mode'], st['sector'], 'lock', st['lock'], 'enemies', len(st['enemies']))
