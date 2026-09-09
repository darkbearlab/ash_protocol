"""Preview-only 4x4 atlas -> sixteen 64x64 / 16-color RGB555 portraits.

python tools/pixelize_portrait_atlas.py
Does not overwrite the live portrait pool. Only Pillow is required.
"""
from pathlib import Path
import hashlib
import json
import argparse
import shutil
from pixelize_portraits import pixelize as pixelize_v1
from PIL import Image, ImageDraw, __version__

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'art/portraits-v2'
BACKGROUND = (16, 24, 33)
LEVELS = {round(i * 255 / 31) for i in range(32)}

def rgb5(value):
    return round(round(value * 31 / 255) * 255 / 31)

def convert(cell):
    # The generated source is already composed with pixel clusters. Sample it
    # with nearest neighbor to avoid inventing blended colors along those edges.
    cell = cell.convert('RGBA')
    cell.putalpha(cell.getchannel('A').point(lambda a: 255 if a >= 224 else 0))
    opaque = Image.new('RGBA', cell.size, (*BACKGROUND, 255))
    opaque.alpha_composite(cell)
    small = opaque.convert('RGB').resize((64, 64), Image.Resampling.NEAREST)
    quantized = small.quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = quantized.getpalette()
    quantized.putpalette([rgb5(v) for v in palette])
    assert quantized.size == (64,64) and len(quantized.getcolors()) <= 16
    assert all(v in LEVELS for count, color in quantized.convert('RGB').getcolors() for v in color)
    return quantized

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--install",action="store_true",help="Install approved v2 portraits into the live asset pool");args=parser.parse_args()
    target = FOLDER / 'cells'; target.mkdir(parents=True, exist_ok=True)
    source = FOLDER / 'source-atlas.png'
    atlas = Image.open(source).convert('RGBA'); w, h = atlas.size
    sheet = Image.new('RGB', (4*212, 4*224), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    compare = Image.new('RGB', (4*212, 2*224), BACKGROUND)
    labels = ImageDraw.Draw(compare)
    records = []
    for i in range(16):
        x,y=i%4,i//4
        bounds=(round(x*w/4),round(y*h/4),round((x+1)*w/4),round((y+1)*h/4))
        sprite = convert(atlas.crop(bounds))
        name=f'{i+1:02d}'; path=target/f'{name}.png'
        sprite.save(path,bits=4,optimize=False)
        sheet.paste(sprite.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(x*212+10,y*224+22))
        draw.text((x*212+10,y*224+5),name,fill=(214,222,198))
        if i<4:
            old = pixelize_v1(Image.open(ROOT / 'art/portraits' / f"{('ember','onyx','silver','cedar')[i]}.png")).convert('RGB')
            compare.paste(old.resize((192,192),Image.Resampling.NEAREST),(x*212+10,22))
            compare.paste(sprite.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(x*212+10,246))
            labels.text((x*212+10,5),f'OLD {name} / 32 colors max',fill=(214,222,198))
            labels.text((x*212+10,229),f'NEW {name} / 16 colors max',fill=(214,222,198))
        records.append({'id':name,'crop':bounds,'colors':len(sprite.getcolors()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    sheet.save(FOLDER / 'preview.png');compare.save(FOLDER / 'comparison.png')
    manifest={'status':'approved-3.14-source','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'pillow':__version__,'grid':[4,4],'size':64,'maxColors':16,'indexBits':4,'rgb':'RGB555','alphaThreshold':224,'sampling':'NEAREST','dither':False,'portraits':records}
    (FOLDER / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    if args.install:
        names=('ember','onyx','silver','cedar')+tuple(f'portrait-{i:02d}' for i in range(5,17))
        for i,name in enumerate(names,1):
            shutil.copyfile(target/f'{i:02d}.png',ROOT/f'assets/pixel/portraits/{name}.png')
        print('Installed approved v2 portrait pool; legacy IDs retained.')
    print('Created 16 preview portraits: 64x64, <=16 colors, RGB555; --install updates live assets only when requested.')

if __name__ == '__main__':
    main()
