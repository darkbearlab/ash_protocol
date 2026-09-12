"""Rebuild connected vehicle parts and panel textures from the generated source.

python tools/pixelize_scenery.py
Explicit source-specific crops, nearest sampling, shared RGB555 palette, no dither.
Never trim or center individual vehicle cells: internal seams must remain joined.
"""
from pathlib import Path
from functools import lru_cache
import hashlib,json
from PIL import Image, __version__
from pixelize_terrain import rgb5,save_indexed,pixels

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/scenery-v1/source-atlas.png'
OUT=ROOT/'assets/pixel/scenery-v1'
NAMES=['rover_0','rover_1','shuttle_0','shuttle_1','rover_2','rover_3','shuttle_2','shuttle_3','rover_4','rover_5','shuttle_4','shuttle_5','desk','pallet','panel-face','panel-cap']

def build():
    source=Image.open(SOURCE).convert('RGBA');w,h=source.size
    if source.getchannel('A').getextrema()[0]==255:raise ValueError('Expected original transparent source')
    # Source generation placed its bottom row slightly above the nominal 3/4 line.
    split=round(h*912/1280)
    canvas=Image.new('RGBA',(128,128))
    crops=[]
    for col in [0,1]:
        box=(round(col*w/2),0,round((col+1)*w/2),split);crops.append(box)
        canvas.alpha_composite(source.crop(box).resize((64,96),Image.Resampling.NEAREST),(col*64,0))
    for col in range(4):
        box=(round(col*w/4),split,round((col+1)*w/4),h);crops.append(box)
        cell=source.crop(box)
        # Texture fills its tile; furniture preserves its transparent silhouette.
        if col>=2:cell=cell.crop(cell.getchannel('A').point(lambda a:255 if a>=224 else 0).getbbox())
        canvas.alpha_composite(cell.resize((32,32),Image.Resampling.NEAREST),(col*32,96))
    visible=[p[:3] for p in pixels(canvas) if p[3]>=224]
    training=Image.new('RGB',(len(visible),1));training.putdata(visible)
    raw=training.quantize(colors=31,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).getpalette()[:93]
    colors=[tuple(rgb5(v) for v in raw[i:i+3]) for i in range(0,93,3)]
    @lru_cache(maxsize=None)
    def index(p):return 1+min(range(len(colors)),key=lambda i:sum((p[k]-colors[i][k])**2 for k in range(3)))
    result=Image.new('P',canvas.size);result.putpalette([0,0,0]+[v for c in colors for v in c]);result.putdata([index(p[:3]) if p[3]>=224 else 0 for p in pixels(canvas)]);result.info['transparency']=0
    OUT.mkdir(parents=True,exist_ok=True);save_indexed(result,OUT/'atlas.png')
    sprites={}
    for i,name in enumerate(NAMES):
        x,y=i%4*32,i//4*32;part=result.crop((x,y,x+32,y+32));save_indexed(part,OUT/f'{name}.png')
        sprites[name]={'x':x,'y':y,'size':32,'sha256':hashlib.sha256((OUT/f'{name}.png').read_bytes()).hexdigest()}
    preview=Image.new('RGBA',result.size,'#172329');preview.alpha_composite(result.convert('RGBA'));preview.resize((768,768),Image.Resampling.NEAREST).convert('RGB').save(OUT/'preview.png')
    (OUT/'atlas.json').write_text(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pillow':__version__,'cropBoxes':crops,'rgbBits':5,'colors':32,'sampling':'nearest','alphaThreshold':224,'dither':False,'sprites':sprites},indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {len(sprites)} indexed 32px pieces; connected vehicle seams retained')

if __name__=='__main__':build()
