"""Deterministic opaque portraits: 64x64, <=32 colors, RGB555, no dithering.

Run: python tools/pixelize_portraits.py
Source images and prompts stay in art/portraits; only tiny final PNGs ship.
Future atlas input can be cut into equal cells before the same pixelize() step.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageOps, __version__

ROOT = Path(__file__).resolve().parents[1]
IDS = ('ember', 'onyx', 'silver', 'cedar')

def rgb5(v):
    return round(round(v * 31 / 255) * 255 / 31)

def pixelize(source):
    small = ImageOps.fit(source.convert('RGB'), (64, 64), method=Image.Resampling.BOX)
    # Reserve rare eye / visor colors by learning the palette from an enlarged
    # saturated subset as well as the whole face. No random sampling or dithering.
    pixels = list(small.get_flattened_data() if hasattr(small, 'get_flattened_data') else small.getdata())
    accents = [p for p in pixels if max(p)-min(p)>35 and (p[2]>p[0]*1.15 or p[1]>p[0]*1.15)]
    sample = pixels + accents * 8
    swatch = Image.new('RGB', (len(sample), 1)); swatch.putdata(sample)
    quantized = swatch.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    raw = quantized.getpalette()
    palette = list(dict.fromkeys(tuple(rgb5(v) for v in raw[i:i+3]) for i in range(0, 96, 3)))
    indexed = Image.new('P', small.size)
    flat = [v for p in palette for v in p]
    indexed.putpalette(flat + [0] * (768-len(flat)))
    indexed.putdata([min(range(len(palette)), key=lambda i:sum((p[c]-palette[i][c])**2 for c in range(3))) for p in pixels])
    return indexed

def main():
    output = ROOT / 'assets/pixel/portraits'; output.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGB', (256*4, 256)); records = []
    for i, name in enumerate(IDS):
        source = ROOT / f'art/portraits/{name}.png'
        with Image.open(source) as image:
            sprite = pixelize(image)
        target = output / f'{name}.png'; sprite.save(target, bits=8, optimize=False)
        assert sprite.size == (64, 64) and len(sprite.getcolors()) <= 32
        preview.paste(sprite.convert('RGB').resize((256,256), Image.Resampling.NEAREST), (i*256, 0))
        records.append({'id':name, 'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(), 'outputSHA256':hashlib.sha256(target.read_bytes()).hexdigest(), 'colors':len(sprite.getcolors()), 'bytes':target.stat().st_size})
    preview.save(ROOT / 'art/portraits/preview.png')
    (ROOT / 'art/portraits/manifest.json').write_text(json.dumps({'size':64,'maxColors':32,'channels':'RGB555','dither':False,'pillow':__version__,'portraits':records}, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(records, indent=2))

if __name__ == '__main__':
    main()
