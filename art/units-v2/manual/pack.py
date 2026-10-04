"""Apply the user's hand edit (2026-10-04) to Codex's units-v2 sprites and write the shipped set.

    python art/units-v2/manual/pack.py
    python tools/append_units_v2.py

Input: art/units-v2/codex-v1/ (Codex's 44 delivered sprites and sprites.json) and units-v2-edit-2026-10-04.png, the
sheet the user retouched (outlines cleaned; layout.json says where each sprite sits, 32px cells, no gaps).
Output: assets/pixel/units-v2/ — the 44 sprites, sprites.json and preview-4x.png.

- A cell the user did not touch is Codex's file, byte for byte.
- An edited cell: the user's pure black (0,0,0) becomes the outline colour (12,14,18), the one colour off the RGB5 steps
  the user approved; every other colour stays as drawn (they sit on the RGB5 steps). Written as a 4-bit indexed PNG,
  index 0 transparent and index 1 the outline, like Codex's; the run stops on semi-transparency, a colour off the steps,
  or more than 16 palette entries.
- sprites.json is Codex's with each edited entry's palette, colour count and SHA-256 replaced and `manual` noted.
"""
import hashlib, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
V1 = ROOT / 'art/units-v2/codex-v1'
OUT = ROOT / 'assets/pixel/units-v2'
SHEET = HERE / 'units-v2-edit-2026-10-04.png'
OUTLINE, BLACK = (12, 14, 18), (0, 0, 0)
levels = {round(n * 255 / 31) for n in range(32)}

layout = json.loads((HERE / 'layout.json').read_text(encoding='utf-8'))
meta = json.loads((V1 / 'sprites.json').read_text(encoding='utf-8'))
sheet = Image.open(SHEET).convert('RGBA')
OUT.mkdir(parents=True, exist_ok=True)
edited = []
for name, at in layout['sprites'].items():
    cell = sheet.crop((at['x'], at['y'], at['x'] + 32, at['y'] + 32)); px = cell.load()
    op = Image.open(V1 / f'{name}.png').convert('RGBA').load()
    clear = lambda p: p if p[3] else (0, 0, 0, 0)
    if all(clear(px[x, y]) == clear(op[x, y]) for y in range(32) for x in range(32)):
        shutil.copyfile(V1 / f'{name}.png', OUT / f'{name}.png'); continue
    assert all(px[x, y][3] in (0, 255) for y in range(32) for x in range(32)), f'{name}: semi-transparent pixels'
    colour = lambda x, y: OUTLINE if px[x, y][:3] == BLACK else px[x, y][:3]
    used = {colour(x, y) for y in range(32) for x in range(32) if px[x, y][3]}
    off = [c for c in used if c != OUTLINE and not all(v in levels for v in c)]
    assert not off, f'{name}: colours off the RGB5 steps {off}'
    palette = [(0, 0, 0), OUTLINE] + sorted(used - {OUTLINE}, key=lambda c: (-sum(c), c))   # light to dark
    assert len(palette) <= 16, f'{name}: {len(palette)} palette entries'
    index = {c: i for i, c in enumerate(palette)}
    im = Image.new('P', (32, 32), 0)
    im.putdata([index[colour(x, y)] if px[x, y][3] else 0 for y in range(32) for x in range(32)])
    flat = [v for c in palette for v in c]; im.putpalette(flat + [0] * (48 - len(flat)))
    im.save(OUT / f'{name}.png', transparency=0, bits=4, optimize=False)
    entry = meta['sprites'][name]
    entry.update(colors=len(palette), palette=[list(c) for c in palette],
                 sha256=hashlib.sha256((OUT / f'{name}.png').read_bytes()).hexdigest(),
                 manual={'by': 'user', 'date': '2026-10-04', 'sheet': 'art/units-v2/manual/units-v2-edit-2026-10-04.png',
                         'note': 'outline cleaned by hand; pure black mapped to the outline colour'})
    edited.append(name)
meta['manualEdit'] = {'date': '2026-10-04', 'cells': edited, 'blackToOutline': True}
(OUT / 'sprites.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')

# preview-4x.png: every unit's standing and fallen sprite at 4x on the floor colour, named, four units to a row.
units = list(dict.fromkeys(n.removeprefix('dead-') for n in layout['sprites']))
S, CELL, LABEL, PER = 4, 32 * 4, 16, 4
preview = Image.new('RGBA', (PER * 2 * CELL, -(-len(units) // PER) * (CELL + LABEL)), (16, 19, 19, 255))
draw = ImageDraw.Draw(preview)
try:
    font = ImageFont.truetype('consola.ttf', 13)
except OSError:
    font = ImageFont.load_default()
for i, uid in enumerate(units):
    x, y = i % PER * 2 * CELL, i // PER * (CELL + LABEL)
    draw.text((x + 4, y + 1), uid, fill=(200, 214, 224, 255), font=font)
    for d, name in enumerate((uid, f'dead-{uid}')):
        preview.alpha_composite(Image.open(OUT / f'{name}.png').convert('RGBA').resize((CELL, CELL), Image.NEAREST), (x + d * CELL, y + LABEL))
preview.save(OUT / 'preview-4x.png')
print(len(edited), 'edited,', len(layout['sprites']) - len(edited), 'copied from Codex v1; preview', preview.size)
