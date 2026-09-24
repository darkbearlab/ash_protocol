"""Makes every class's fallen sprite read as "knocked down by an attack from the left" (3.176.0).

python tools/normalize_fallen_facing.py

The user calibrated the eight fallen sprites on a preview page (2026-09-24,
https://claude.ai/artifact/MMDyJr4CXFAGRNwRoe2oRL): six were drawn as if hit from the right, so they are mirrored
here, once. The killed-in-action scene then mirrors the fallen sprite whenever the killing blow comes from the right
(src/kia-art.js). The per-sprite PNGs and their cells in atlas.png are flipped together and atlas.json records the new
hashes; a sprite whose hash no longer matches its pre-flip hash is left alone, so running this again changes nothing.
tools/pixelize_classes.py rebuilds the original (unflipped) art; run this after it if that is ever done.
"""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/pixel/classes-v1'
# The user's calibration: the fallen art of these classes was drawn as if hit from the right.
FROM_RIGHT = ['soldier', 'recon', 'engineer', 'druid', 'necromancer', 'bulwark']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    meta_path = OUT / 'atlas.json'
    meta = json.loads(meta_path.read_text(encoding='utf-8'))
    record = meta.setdefault('fallen_facing', {'from': 'left', 'calibrated': '2026-09-24', 'flipped': {}})
    atlas = Image.open(OUT / 'atlas.png').convert('RGBA')
    changed = []
    for name in FROM_RIGHT:
        key = f'dead-{name}'
        path, entry = OUT / f'{key}.png', meta['sprites'][key]
        current = sha(path)
        if name in record['flipped']:
            if current != record['flipped'][name]['after']:
                raise SystemExit(f'{key}.png changed since it was flipped; check it by hand')
            continue
        sprite = Image.open(path)
        flipped = ImageOps.mirror(sprite)
        flipped.info['transparency'] = 0
        flipped.save(path, transparency=0, bits=4, optimize=True)
        atlas.paste(ImageOps.mirror(atlas.crop((entry['x'], entry['y'], entry['x'] + 32, entry['y'] + 32))), (entry['x'], entry['y']))
        entry['sha256'] = sha(path)
        record['flipped'][name] = {'before': current, 'after': entry['sha256']}
        changed.append(key)
    if changed:
        atlas.save(OUT / 'atlas.png', optimize=True)
        meta_path.write_text(json.dumps(meta, indent=2) + chr(10), encoding='utf-8')   # the format tools/pixelize_classes.py writes
    print('flipped:', ', '.join(changed) if changed else 'nothing (already done)')

if __name__ == '__main__':
    main()
