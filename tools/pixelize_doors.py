"""Generated atlas -> four true 32px textures, shared RGB555 palette, no dither."""
from pathlib import Path
from functools import lru_cache
import hashlib,json
from PIL import Image, __version__
from pixelize_terrain import rgb5,save_indexed,pixels
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/doors-v1/source-atlas.png'
OUT=ROOT/'assets/pixel/doors-v1'
def build():
    source=Image.open(SOURCE).convert('RGB')
    canvas=source.resize((64,64),Image.Resampling.NEAREST)
    raw=canvas.quantize(colors=24,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).getpalette()[:72]
    colors=[tuple(rgb5(v) for v in raw[i:i+3]) for i in range(0,72,3)]
    @lru_cache(maxsize=None)
    def index(p):return 1+min(range(len(colors)),key=lambda i:sum((p[k]-colors[i][k])**2 for k in range(3)))
    result=Image.new('P',canvas.size);result.putpalette([0,0,0]+[v for c in colors for v in c]);result.putdata([index(p) for p in pixels(canvas)])
    OUT.mkdir(parents=True,exist_ok=True);save_indexed(result,OUT/'atlas.png')
    sprites={}
    for i,name in enumerate(['closed','cap','jamb','damaged']):
        x,y=i%2*32,i//2*32;save_indexed(result.crop((x,y,x+32,y+32)),OUT/f'{name}.png')
        sprites[name]={'x':x,'y':y,'size':32,'sha256':hashlib.sha256((OUT/f'{name}.png').read_bytes()).hexdigest()}
    result.resize((512,512),Image.Resampling.NEAREST).save(OUT/'preview.png')
    (OUT/'atlas.json').write_text(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pillow':__version__,'rgbBits':5,'colors':24,'sampling':'nearest','dither':False,'sprites':sprites},indent=2)+'\n',encoding='utf-8')
    print('Wrote four 32px door textures')
if __name__=='__main__':build()
