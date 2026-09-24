"""Installs a hand-edited class atlas (3.177.3). Pillow only; no generation/API calls.

python tools/install_class_atlas.py art/classes-v1/manual/atlas_edit-2026-09-24.png --label 2026-09-24-before-manual-edit

The game draws the class sprites from assets/pixel/classes-v1/atlas.png (src/class-art.js); the sixteen 32px PNGs
beside it are what tests/art.test.mjs checks and what atlas.json hashes. This tool:
1. checks the edit: 128x128, only grey or fully transparent pixels, at most 15 greys in any one cell, and nothing drawn
   outside the sixteen cells;
2. archives the atlas, atlas.json and the sixteen PNGs now in the game under art/classes-v1/archive/<label>/ (refuses
   to overwrite an archive that already exists);
3. copies the edit byte for byte to atlas.png, and cuts each cell into its own 4-bit indexed PNG (index 0 transparent,
   grey palette, the way tools/pixelize_classes.py saves them);
4. records the new hashes in atlas.json, with an entry in `manual_edits` (source, its hash, the archive, each sprite's old and
   new hash). The fallen sprites keep the facing the user calibrated in 3.176.0, so `fallen_facing` takes the new
   hashes of the flipped six; an edit whose fallen silhouette is closer to the mirror image is refused.
tools/pixelize_classes.py refuses to run over a manual edit unless given --force.
"""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/pixel/classes-v1'
ARCHIVE = ROOT / 'art/classes-v1/archive'
NAMES = ['soldier', 'recon', 'engineer', 'druid', 'necromancer', 'bulwark', 'berserker', 'ninja']

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def cell_sprite(cell):
    """One RGBA cell as a 4-bit indexed PNG image: index 0 transparent, then its greys, darkest first."""
    greys = sorted({p[0] for p in cell.getdata() if p[3]})
    if len(greys) > 15:
        raise SystemExit(f'a cell uses {len(greys)} greys; 15 fit a 4-bit sprite beside transparency')
    index = {g: i + 1 for i, g in enumerate(greys)}
    sprite = Image.new('P', cell.size, 0)
    sprite.putpalette([0, 0, 0] + [c for g in greys for c in (g, g, g)])
    sprite.putdata([index[p[0]] if p[3] else 0 for p in cell.getdata()])
    sprite.info['transparency'] = 0
    return sprite

def silhouette(img):
    return [1 if p[3] else 0 for p in img.convert('RGBA').getdata()]

def keeps_facing(before, after):
    """The edited fallen sprite is closer to the calibrated one than to its mirror image."""
    old, new, mirror = silhouette(before), silhouette(after), silhouette(before.convert('RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT))
    return sum(a != b for a, b in zip(old, new)) < sum(a != b for a, b in zip(mirror, new))

def main():
    args = argparse.ArgumentParser()
    args.add_argument('edit'); args.add_argument('--label', required=True)
    opts = args.parse_args()
    edit = (ROOT / opts.edit).resolve(); atlas = Image.open(edit).convert('RGBA')
    meta = json.loads((OUT / 'atlas.json').read_text(encoding='utf-8'))
    if atlas.size != (128, 128):
        raise SystemExit(f'the atlas is {atlas.size}, not 128x128')
    for x, y, (r, g, b, a) in ((x, y, atlas.getpixel((x, y))) for y in range(128) for x in range(128)):
        if a not in (0, 255) or a and not r == g == b:
            raise SystemExit(f'pixel {x},{y} is {(r, g, b, a)}: only grey or fully transparent pixels')
    cells = {key: (e['x'], e['y'], e['x'] + 32, e['y'] + 32) for key, e in meta['sprites'].items()}
    covered = {(x, y) for x0, y0, x1, y1 in cells.values() for y in range(y0, y1) for x in range(x0, x1)}
    if any(atlas.getpixel((x, y))[3] for y in range(128) for x in range(128) if (x, y) not in covered):
        raise SystemExit('something is drawn outside the sixteen cells')
    sprites = {key: cell_sprite(atlas.crop(box)) for key, box in cells.items()}
    flipped = meta.get('fallen_facing', {}).get('flipped', {})
    for name in flipped:
        if not keeps_facing(Image.open(OUT / f'dead-{name}.png'), sprites[f'dead-{name}']):
            raise SystemExit(f'dead-{name}: the edit looks mirrored; recalibrate its facing first')

    target = ARCHIVE / opts.label
    if target.exists():
        raise SystemExit(f'{target} already exists')
    target.mkdir(parents=True)
    for name in ['atlas.png', 'atlas.json', *(f'{key}.png' for key in cells)]:
        shutil.copy2(OUT / name, target / name)

    shutil.copyfile(edit, OUT / 'atlas.png')
    changes = {}
    for key, sprite in sprites.items():
        file = OUT / f'{key}.png'; old = meta['sprites'][key]['sha256']
        sprite.save(file, transparency=0, bits=4, optimize=True)
        meta['sprites'][key]['sha256'] = sha(file); changes[key] = {'before': old, 'after': meta['sprites'][key]['sha256']}
    for name, record in flipped.items():
        record['after'] = meta['sprites'][f'dead-{name}']['sha256']
    if flipped:
        meta['fallen_facing']['revised'] = f'{opts.label}: a manual edit that keeps every fallen facing'
    meta.setdefault('manual_edits', []).append({'label': opts.label, 'source': str(edit.relative_to(ROOT)).replace('\\', '/'),
        'source_sha256': sha(edit), 'archive': str(target.relative_to(ROOT)).replace('\\', '/'), 'sprites': changes})
    (OUT / 'atlas.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')   # the format pixelize_classes.py writes

    preview = Image.new('RGB', (8 * 144, 2 * 160), (38, 44, 47)); draw = ImageDraw.Draw(preview)
    for i, name in enumerate(NAMES):
        for dead in [False, True]:
            key = ('dead-' if dead else '') + name; p = Image.open(OUT / f'{key}.png').convert('RGBA').resize((128, 128), Image.Resampling.NEAREST)
            x, y = i * 144, int(dead) * 160; preview.paste(p, (x + 8, y + 22), p); draw.text((x + 8, y + 5), key, fill=(220, 220, 220))
    preview.save(ROOT / 'art/classes-v1/preview.png')
    print(f'installed {edit.name}; archived the previous art in {target.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
