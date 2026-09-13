"""Generated 4x2 sheet -> eight 32px sprites, shared RGB555 palette, binary alpha.
Run: python tools/pixelize_nests.py. No dithering; source/prompt are retained.
"""
from pathlib import Path
from functools import lru_cache
import hashlib,json
from PIL import Image, __version__
from pixelize_terrain import rgb5,save_indexed,pixels
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/nests-v1/source-atlas.png'
OUT=ROOT/'assets/pixel/nests-v1'
NAMES=[f'{kind}-{state}' for kind in ['burrow','rift'] for state in ['dormant','active','collapse','ruins']]
def build():
    source=Image.open(SOURCE).convert('RGBA');w,h=source.size;cells=[]
    for i in range(8):
        x,y=i%4,i//4
        cell=source.crop((round(x*w/4),round(y*h/2),round((x+1)*w/4),round((y+1)*h/2))).resize((32,32),Image.Resampling.NEAREST)
        cell.putdata([(r,g,b,255 if a>=160 else 0) for r,g,b,a in pixels(cell)]);cells.append(cell)
    visible=[p[:3] for cell in cells for p in pixels(cell) if p[3]]
    sample=Image.new('RGB',(len(visible),1));sample.putdata(visible)
    raw=sample.quantize(colors=31,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).getpalette()[:93]
    colors=[tuple(rgb5(v) for v in raw[i:i+3]) for i in range(0,93,3)]
    palette=[0,0,0]+[v for c in colors for v in c]
    @lru_cache(maxsize=None)
    def index(p):return 1+min(range(len(colors)),key=lambda i:sum((p[k]-colors[i][k])**2 for k in range(3)))
    OUT.mkdir(parents=True,exist_ok=True);atlas=Image.new('P',(128,64),0);atlas.putpalette(palette);records={}
    for i,(name,cell) in enumerate(zip(NAMES,cells)):
        out=Image.new('P',(32,32));out.putpalette(palette);out.putdata([index(p[:3]) if p[3] else 0 for p in pixels(cell)])
        save_indexed(out,OUT/f'{name}.png');x,y=i%4*32,i//4*32;atlas.paste(out,(x,y))
        records[name]={'x':x,'y':y,'size':32,'sha256':hashlib.sha256((OUT/f'{name}.png').read_bytes()).hexdigest()}
    save_indexed(atlas,OUT/'atlas.png')
    preview=Image.new('RGBA',atlas.size,(30,43,40,255));preview.alpha_composite(Image.open(OUT/'atlas.png').convert('RGBA'));preview.resize((768,384),Image.Resampling.NEAREST).save(ROOT/'art/nests-v1/preview.png')
    (OUT/'atlas.json').write_text(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pillow':__version__,'sampling':'nearest','rgbBits':5,'colors':31,'dither':False,'sprites':records},indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':build()
