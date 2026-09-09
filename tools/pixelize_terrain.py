"""Generated 4x4 source -> shared 32-color RGB555 32px terrain sprites.

python tools/pixelize_terrain.py
Deterministic nearest-neighbor sampling, binary alpha, no dithering.
Requires Pillow; source and prompt remain in art/terrain-v1/.
"""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import struct
import zlib
from PIL import Image, ImageDraw, __version__

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/terrain-v1/source-atlas.png'
OUT=ROOT/'assets/pixel/terrain-v1'
NAMES=['floor-metal','floor-grate','floor-restroom','floor-checkpoint',
       'toilet','sink','counter','scanner','locker','bench','cover','barrel',
       'terminal','case','door','partition']
FLOOR_GAIN=[.78,.78,.53,.74]
def pixels(image):return image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata()

def rgb5(v):return round(round(v*31/255)*255/31)

def save_indexed(image,path):
    image.save(path,bits=8,optimize=False,transparency=0)
    # Pillow pads an 8-bit PLTE to 256 slots. Keep only our 32 defined colors;
    # all encoded pixel indices are <=31, so this remains a standard indexed PNG.
    raw=path.read_bytes();out=bytearray(raw[:8]);pos=8
    while pos<len(raw):
        length=struct.unpack('>I',raw[pos:pos+4])[0];kind=raw[pos+4:pos+8];data=raw[pos+8:pos+8+length]
        if kind==b'PLTE':data=data[:96]
        out.extend(struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff));pos+=12+length
    path.write_bytes(out)

def process():
    source=Image.open(SOURCE).convert('RGBA');w,h=source.size;cells=[];bounds=[]
    for i,name in enumerate(NAMES):
        x,y=i%4,i//4;box=(round(x*w/4),round(y*h/4),round((x+1)*w/4),round((y+1)*h/4));bounds.append(box)
        cell=source.crop(box).resize((32,32),Image.Resampling.NEAREST)
        rgba=[]
        for n,(r,g,b,a) in enumerate(pixels(cell)):
            if i<4:
                # Quiet floors sit behind brighter actors and interactive props.
                r,g,b=[round(v*FLOOR_GAIN[i]) for v in (r,g,b)];a=255
            else:
                a=255 if a>=224 else 0
                # Remove generated seam fragments on cell edges; preserve inner silhouette.
                if n%32 in (0,31) or n//32 in (0,31):a=0
            rgba.append((r,g,b,a))
        cell.putdata(rgba);cells.append(cell)
    visible=[p[:3] for cell in cells for p in pixels(cell) if p[3]]
    sample=Image.new('RGB',(len(visible),1));sample.putdata(visible)
    pal=sample.quantize(colors=31,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).getpalette()[:93]
    colors=[tuple(rgb5(v) for v in pal[i:i+3]) for i in range(0,93,3)]
    palette=[0,0,0]+[v for color in colors for v in color]
    @lru_cache(maxsize=None)
    def nearest(rgb):return 1+min(range(len(colors)),key=lambda i:sum((rgb[k]-colors[i][k])**2 for k in range(3)))
    OUT.mkdir(parents=True,exist_ok=True)
    atlas=Image.new('P',(128,128),0);atlas.putpalette(palette);records={}
    preview=Image.new('RGB',(4*164,4*178),(22,35,29));draw=ImageDraw.Draw(preview)
    for i,(name,cell) in enumerate(zip(NAMES,cells)):
        result=Image.new('P',(32,32));result.putpalette(palette)
        result.putdata([nearest(p[:3]) if p[3] else 0 for p in pixels(cell)]);result.info['transparency']=0
        path=OUT/f'{name}.png';save_indexed(result,path)
        atlas.paste(result,((i%4)*32,(i//4)*32))
        enlarged=result.convert('RGBA').resize((144,144),Image.Resampling.NEAREST)
        preview.paste(enlarged,((i%4)*164+10,(i//4)*178+22),enlarged)
        draw.text(((i%4)*164+10,(i//4)*178+5),name,fill=(205,220,194))
        records[name]={'index':i,'crop':bounds[i],'colors':len(result.getcolors()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    save_indexed(atlas,OUT/'atlas.png')
    preview.save(ROOT/'art/terrain-v1/preview.png')
    metadata={'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pillow':__version__,'grid':[4,4],'tileSize':32,'colors':32,'rgb':'RGB555','sampling':'NEAREST','alphaThreshold':224,'floorGain':FLOOR_GAIN,'sprites':records,'atlasSHA256':hashlib.sha256((OUT/'atlas.png').read_bytes()).hexdigest()}
    (OUT/'manifest.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    print('Installed sixteen 32px sprites, shared 32-color palette, binary alpha, RGB555. Preview: art/terrain-v1/preview.png')

if __name__=='__main__':process()
