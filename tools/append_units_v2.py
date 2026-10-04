"""Append the units-v2 sprites (docs/UNIT_SPRITES_HANDOFF.md, 3.223.0) to the shipped atlases.

Standing cells go to assets/pixel/atlas.png and corpses to assets/pixel/aftermath.png, in UNITS order, after the 18 cells
each atlas already holds; src/enemy-visuals.js lists the same names in the same order (SPRITE_NAMES, AFTERMATH_NAMES), and
a cell's place is its index: x = index % 4 * 32, y = index // 4 * 32. The first 18 cells are copied from the current file
and never change, so running this twice gives the same atlases. The atlases' new SHA-256 go into units-v2/sprites.json,
which tests/unit-sprites.test.mjs checks.

    python tools/append_units_v2.py
"""
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PIXEL = ROOT / 'assets/pixel'
UNITS = ['designator', 'gunline', 'arsonist', 'burnline', 'hive_beast', 'hive_matriarch', 'dog', 'fodder', 'brood',
         'giant_bug', 'turret', 'munition', 'bomber_bot', 'heavy_flamer', 'enforcer', 'squad_leader', 'gunner',
         'rifleman_infected', 'raider_infected', 'pet', 'rifleman_armored', 'raider_armored']
OLD_CELLS, CELL, COLUMNS = 18, 32, 4
place = lambda i: (i % COLUMNS * CELL, i // COLUMNS * CELL)

hashes = {}
for stem, prefix in (('atlas', ''), ('aftermath', 'dead-')):
    path = PIXEL / f'{stem}.png'
    old = Image.open(path).convert('RGBA')
    total = OLD_CELLS + len(UNITS)
    out = Image.new('RGBA', (COLUMNS * CELL, -(-total // COLUMNS) * CELL), (0, 0, 0, 0))
    for i in range(OLD_CELLS):
        x, y = place(i); out.paste(old.crop((x, y, x + CELL, y + CELL)), (x, y))
    for n, uid in enumerate(UNITS):
        x, y = place(OLD_CELLS + n)
        out.paste(Image.open(PIXEL / 'units-v2' / f'{prefix}{uid}.png').convert('RGBA'), (x, y))
    for i in range(OLD_CELLS):
        x, y = place(i)
        assert out.crop((x, y, x + CELL, y + CELL)).tobytes() == old.crop((x, y, x + CELL, y + CELL)).tobytes(), f'{stem} cell {i} changed'
    out.save(path, optimize=True)
    hashes[stem] = hashlib.sha256(path.read_bytes()).hexdigest()
    print(stem, out.size, f'{OLD_CELLS} old cells kept, {len(UNITS)} appended', hashes[stem])

meta_path = PIXEL / 'units-v2/sprites.json'
meta = json.loads(meta_path.read_text(encoding='utf-8'))
meta['atlasOrder'] = UNITS
meta['atlases'] = {stem: {'file': f'assets/pixel/{stem}.png', 'firstCell': OLD_CELLS, 'sha256': h} for stem, h in hashes.items()}
meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
