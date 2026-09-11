"""Rebuild monochrome class sprites. Pillow only; no generation/API calls.
Run: python tools/pixelize_classes.py
The generated source has a baked checker; remove only border-connected matte.
Soldier deliberately preserves the original player and dead-player silhouettes.
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/pixel/classes-v1'
SOURCE = ROOT / 'art/classes-v1/source-atlas.png'
NAMES = ['soldier', 'recon', 'engineer', 'druid', 'necromancer', 'bulwark', 'berserker', 'ninja']
GRAY = [16, 33, 58, 82, 115, 148, 181, 214, 239]
# Hand-reviewed cell borders: generated feet cross the nominal quarter rows.
ROWS = [0, 345, 695, 960, 1254]
COLS = [[0, 313, 627, 940, 1254], [0, 312, 635, 973, 1254],
        [0, 313, 627, 940, 1254], [0, 290, 637, 950, 1254]]

def clear_matte(cell):
    cell = cell.convert('RGBA'); w,h=cell.size; p=cell.load()
    q=deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+
            [(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])
    seen=set()
    while q:
        x,y=q.popleft()
        if not (0<=x<w and 0<=y<h) or (x,y) in seen: continue
        seen.add((x,y)); r,g,b,a=p[x,y]
        if max(r,g,b)-min(r,g,b)>18 or min(r,g,b)<190: continue
        p[x,y]=(r,g,b,0); q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
    return cell

def indexed(cell, size=None, gain=1):
    if size:
        bounds=cell.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
        if not bounds: raise ValueError('Empty sprite')
        cell=cell.crop(bounds); ratio=min(size[0]/cell.width,size[1]/cell.height)
        cell=cell.resize((max(1,round(cell.width*ratio)),max(1,round(cell.height*ratio))),Image.Resampling.BOX)
        canvas=Image.new('RGBA',(32,32)); canvas.alpha_composite(cell,((32-cell.width)//2,(32-cell.height)//2)); cell=canvas
    result=Image.new('P',(32,32))
    palette=[0,0,0]+[v for gray in GRAY for v in [gray]*3]
    result.putpalette(palette+[0]*(768-len(palette)))
    result.putdata([0 if a<128 else 1+min(range(len(GRAY)),key=lambda i:abs(GRAY[i]-(r*.2126+g*.7152+b*.0722)*gain)) for r,g,b,a in cell.getdata()])
    result.info['transparency']=0
    return result

def build():
    OUT.mkdir(parents=True,exist_ok=True); source=Image.open(SOURCE)
    atlas=Image.new('RGBA',(128,128)); meta={'tileSize':32,'columns':4,'palette':GRAY,'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sprites':{}}
    for i in range(16):
        row,col=divmod(i,4); name=NAMES[i%8]; dead=i>=8; key=('dead-' if dead else '')+name
        if name=='soldier':
            original=ROOT/'assets/pixel'/('dead-player.png' if dead else 'player.png')
            sprite=indexed(Image.open(original).convert('RGBA'),gain=1.6)
        else:
            cell=clear_matte(source.crop((COLS[row][col],ROWS[row],COLS[row][col+1],ROWS[row+1])))
            # Keep large bodies large, rather than normalizing every silhouette to equal width.
            limit=(30,28) if name=='bulwark' else (29,27) if name=='berserker' else (27,26)
            sprite=indexed(cell,limit)
        file=OUT/f'{key}.png'; sprite.save(file,transparency=0,bits=4,optimize=True)
        atlas.alpha_composite(sprite.convert('RGBA'),(col*32,row*32))
        meta['sprites'][key]={'x':col*32,'y':row*32,'w':32,'h':32,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    atlas.save(OUT/'atlas.png',optimize=True)
    (OUT/'atlas.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    preview=Image.new('RGB',(8*144,2*160),(38,44,47)); draw=ImageDraw.Draw(preview)
    for i,name in enumerate(NAMES):
        for dead in [False,True]:
            key=('dead-' if dead else '')+name; p=Image.open(OUT/f'{key}.png').convert('RGBA').resize((128,128),Image.Resampling.NEAREST)
            x,y=i*144, int(dead)*160; preview.paste(p,(x+8,y+22),p); draw.text((x+8,y+5),key,fill=(220,220,220))
    preview.save(ROOT/'art/classes-v1/preview.png')
    print('Built 16 monochrome indexed sprites and atlas.')

if __name__=='__main__': build()
