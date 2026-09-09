"""GPT Image 4x4 opaque atlas -> sixteen 32px RGB555 modular wall textures.

python tools/pixelize_walls.py
Shares the terrain pipeline's indexed PNG writer; no dithering or interpolation.
"""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
from PIL import Image, ImageDraw, __version__
from pixelize_terrain import pixels, rgb5, save_indexed

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/walls-v1/source-atlas.png'
OUT=ROOT/'assets/pixel/walls-v1'
FACES=['armored','reinforced','concrete','ribbed','conduit','vent','hazard','access']
CAPS=['steel','olive','concrete','grille','cables','grid','hazard','bolted']
NAMES=['face-'+n for n in FACES]+['cap-'+n for n in CAPS]

def process():
    source=Image.open(SOURCE).convert('RGB');w,h=source.size;cells=[];bounds=[]
    for i in range(16):
        x,y=i%4,i//4;box=(round(x*w/4),round(y*h/4),round((x+1)*w/4),round((y+1)*h/4));bounds.append(box)
        cell=source.crop(box).resize((32,32),Image.Resampling.NEAREST)
        # Wall faces stay darker than raised caps, both quieter than actors.
        gain=.70 if i<8 else .88
        cell.putdata([tuple(round(v*gain) for v in p) for p in pixels(cell)]);cells.append(cell)
    sample=Image.new('RGB',(16*32*32,1));sample.putdata([p for cell in cells for p in pixels(cell)])
    pal=sample.quantize(colors=31,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).getpalette()[:93]
    colors=[tuple(rgb5(v) for v in pal[i:i+3]) for i in range(0,93,3)]
    palette=[0,0,0]+[v for color in colors for v in color]
    @lru_cache(maxsize=None)
    def nearest(rgb):return 1+min(range(len(colors)),key=lambda i:sum((rgb[k]-colors[i][k])**2 for k in range(3)))
    OUT.mkdir(parents=True,exist_ok=True);atlas=Image.new('P',(128,128));atlas.putpalette(palette);records={}
    preview=Image.new('RGB',(656,712),(19,29,28));draw=ImageDraw.Draw(preview)
    results=[]
    for i,(name,cell) in enumerate(zip(NAMES,cells)):
        result=Image.new('P',(32,32));result.putpalette(palette);result.putdata([nearest(p) for p in pixels(cell)]);results.append(result)
        path=OUT/(name+'.png');save_indexed(result,path);atlas.paste(result,(i%4*32,i//4*32))
        preview.paste(result.convert('RGB').resize((144,144),Image.Resampling.NEAREST),(i%4*164+10,i//4*178+22))
        draw.text((i%4*164+10,i//4*178+5),name,fill=(205,220,194))
        records[name]={'index':i,'crop':bounds[i],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'colors':len(result.getcolors())}
    save_indexed(atlas,OUT/'atlas.png');preview.save(ROOT/'art/walls-v1/preview.png')
    # All 8x8 combinations at native resolution, enlarged only for inspection.
    combos=Image.new('RGB',(8*40,8*72),(17,26,25))
    for face in range(8):
        for cap in range(8):
            combos.paste(results[8+cap].convert('RGB'),(cap*40+4,face*72+4))
            combos.paste(results[face].convert('RGB'),(cap*40+4,face*72+36))
    combos.resize((640,1152),Image.Resampling.NEAREST).save(ROOT/'art/walls-v1/combinations.png')
    meta={'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pillow':__version__,'grid':[4,4],'tileSize':32,'colors':32,'rgb':'RGB555','sampling':'NEAREST','opaque':True,'faceGain':.70,'capGain':.88,'sprites':records,'atlasSHA256':hashlib.sha256((OUT/'atlas.png').read_bytes()).hexdigest()}
    (OUT/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    print('Built sixteen 32px wall textures, 64 combinations, shared RGB555 palette.')

if __name__=='__main__':process()
