"""Convert a GPT Image 4x4 atlas into real 32px, 16-color indexed sprites.

Usage: python tools/pixelize.py --source art/source-atlas.png --out assets/pixel
Requires Pillow. No model/API calls. Transparent pixels occupy palette index 0.
RGB channels are quantized to SNES-style 5-bit values, then expanded to PNG RGB.
"""
from pathlib import Path
from PIL import Image
import argparse
import hashlib
import json

NAMES = ['player','rifleman','raider','sniper','brute','drone','warden','boss',
         'crawler','bomber','cover','barrel','med','ammo','grenade','terminal']

def data(image):
    return getattr(image,'get_flattened_data',image.getdata)()

def rgb5(v):
    return round(round(v * 31 / 255) * 255 / 31)

def pixelize_cell(cell, size=32, colors=16):
    cell = cell.convert('RGBA')
    # Real generated alpha is retained, hardened at 128; no opaque matte is guessed.
    mask = cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError('Empty atlas cell')
    cell = cell.crop(bounds)
    scale = min((size-4)/cell.width, (size-4)/cell.height)
    cell = cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))), Image.Resampling.BOX)
    canvas = Image.new('RGBA',(size,size))
    canvas.alpha_composite(cell,((size-cell.width)//2,(size-cell.height)//2))
    pixels = list(data(canvas))
    opaque = [p[:3] for p in pixels if p[3] >= 128]
    # Give rare bright visor/status-light colors enough weight to survive a 15-color palette.
    accents=[p for p in opaque if max(p)>135 and max(p)-min(p)>55 and p[1]>p[0]*1.15 and p[2]>p[0]*1.15]
    training=opaque+accents*10
    samples = Image.new('RGB',(len(training),1));samples.putdata(training)
    quantized = samples.quantize(colors=colors-1,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
    source_palette = quantized.getpalette()
    palette = []
    for index in sorted(set(data(quantized))):
        color = tuple(rgb5(v) for v in source_palette[index*3:index*3+3])
        if color not in palette: palette.append(color)
    # Map directly to the final hardware-constrained palette, with no dithering.
    def nearest(pixel):
        if pixel[3] < 128: return 0
        return 1 + min(range(len(palette)),key=lambda i:sum((pixel[c]-palette[i][c])**2 for c in range(3)))
    indexed = Image.new('P',(size,size),0)
    raw_palette = [0,0,0] + [v for color in palette for v in color]
    indexed.putpalette(raw_palette + [0]*(768-len(raw_palette)))
    indexed.putdata([nearest(p) for p in pixels])
    indexed.info['transparency'] = 0
    return indexed,palette

def build(source,out,size=32):
    out.mkdir(parents=True,exist_ok=True)
    image=Image.open(source).convert('RGBA')
    if image.getchannel('A').getextrema()[0] == 255:
        raise ValueError('Input must contain real transparency; remove background explicitly before running.')
    atlas=Image.new('RGBA',(size*4,size*4))
    metadata={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'tileSize':size,'columns':4,
              'format':'indexed PNG, <=16 colors per sprite including transparency','rgbBits':5,'dither':False,'sprites':{}}
    for index,name in enumerate(NAMES):
        x,y=index%4,index//4
        cell=image.crop((round(x*image.width/4),round(y*image.height/4),round((x+1)*image.width/4),round((y+1)*image.height/4)))
        sprite,palette=pixelize_cell(cell,size)
        path=out/f'{name}.png';sprite.save(path,optimize=True,transparency=0,bits=4)
        atlas.alpha_composite(sprite.convert('RGBA'),(x*size,y*size))
        metadata['sprites'][name]={'x':x*size,'y':y*size,'w':size,'h':size,'colors':len(palette)+1,'palette':[list(c) for c in palette],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    atlas.save(out/'atlas.png',optimize=True)
    atlas.resize((size*16,size*16),Image.Resampling.NEAREST).save(out/'preview-4x.png',optimize=True)
    (out/'atlas.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Created {len(NAMES)} indexed {size}x{size} sprites, atlas and nearest-neighbor preview at {out}')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=Path('art/source-atlas.png'))
    parser.add_argument('--out',type=Path,default=Path('assets/pixel'))
    parser.add_argument('--size',type=int,default=32)
    args=parser.parse_args()
    build(args.source,args.out,args.size)
