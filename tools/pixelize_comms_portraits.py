"""Controller expression sheets (art/comms-v1): 4x4 source atlas -> sixteen 64x64 Mega Drive portraits per speaker.

python tools/pixelize_comms_portraits.py [egret wren]             rebuild the previews in art/comms-v1
python tools/pixelize_comms_portraits.py --install [egret wren]   copy approved sheets into assets/pixel/comms-v1

Steps, in the order the user asked for (2026-09-24):
  1. merge similar colours in several small rounds (MERGE_ROUNDS, by look, not by pixel count), each group led by
     its most frequent real colour, so small but important colours (eyes, blush, mouths, the teal line) survive;
  2. into the Mega Drive palette: every colour snapped to the console's 3-bit-per-channel levels (512 colours); one
     16-colour palette shared by all sixteen faces of a speaker, the way one palette line serves a character;
  3. true pixelization: each cell's own virtual pixel grid is measured (the source's pixels are about 8 to 8.4 image
     pixels and start at a different offset in every cell), each virtual pixel takes the colour most of its centre
     shows, and the result is centred on a 64x64 canvas.
  4. palette swaps after review (PALETTE_SWAPS): same pixels, another Mega Drive colour.
Deterministic: no random sampling, no dithering. Only Pillow is required. Rebuilding only touches art/comms-v1; the
game reads assets/pixel/comms-v1, which changes only through --install (and may carry hand edits, see install()).
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import sys
from PIL import Image, ImageChops, __version__

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'art/comms-v1'
GRID, CELL, COLORS, SCALE = 4, 64, 16, 4
# Mega Drive DAC output for the eight 3-bit levels at normal intensity, as measured on hardware (not linear).
MD_LEVELS = (0, 52, 87, 116, 144, 172, 206, 255)

def md_level(value):
    return min(range(8), key=lambda i: abs(MD_LEVELS[i] - value))

def md_word(rgb):
    # The console's colour word: 0000 BBB0 GGG0 RRR0.
    r, g, b = (md_level(v) for v in rgb)
    return f'0x{(b << 9) | (g << 5) | (r << 1):04X}'

MERGE_ROUNDS = (0.010, 0.014, 0.018, 0.022, 0.026, 0.030, 0.034)   # OKLab reach of each merging round, small steps
MIN_SHARE = 0.0001  # a merged colour needs this share of the sheet; smaller specks are blended edges

def pixels_of(image):
    return list(image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata())

def oklab(rgb):
    # OKLab (Ottosson 2020): distances here follow how different two colours look, including in the darks.
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (v / 255 for v in rgb)]
    l = 0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]
    m = 0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]
    s_ = 0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]
    l, m, s_ = (v ** (1 / 3) for v in (l, m, s_))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720145 * s_,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s_,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s_)

_lab = {}
def lab(rgb):
    if rgb not in _lab: _lab[rgb] = oklab(rgb)
    return _lab[rgb]

HUE_WEIGHT = 2   # a hue shift reads worse than a small change in lightness, so colour differences count double

def distance(a, b):
    x, y = lab(a), lab(b)
    return ((x[0] - y[0]) ** 2 + (HUE_WEIGHT * (x[1] - y[1])) ** 2 + (HUE_WEIGHT * (x[2] - y[2])) ** 2) ** 0.5

MD_COLORS = [(r, g, b) for r in MD_LEVELS for g in MD_LEVELS for b in MD_LEVELS]
def md_color(rgb):
    # The Mega Drive colour that looks closest, chosen from all 512 rather than channel by channel, so a dark slate
    # grey does not turn teal because its green channel rounded up alone.
    return min(MD_COLORS, key=lambda c: (distance(c, rgb), c))

def merged_palette(counts):
    """Step 1 and 2: merge similar colours, snap them to the Mega Drive levels, keep at most 16. `counts` holds the
    colour of every virtual pixel's centre, so blended edges between two colours barely enter."""
    total = sum(counts.values())
    # Group near-identical shades first; a group is represented by its most frequent real colour, never an average,
    # so the merged colour is one the source actually drew.
    buckets, best = Counter(), {}
    for colour, n in counts.items():
        key = tuple(v // 8 for v in colour); buckets[key] += n
        if key not in best or (counts[best[key]], best[key]) < (n, colour): best[key] = colour
    # Merge by look in several small rounds (user, 2026-09-24: small steps, many rounds), each allowing a little more
    # distance than the last. In a round, colours are visited most frequent first; one joins the nearest leader within
    # reach, otherwise it leads. The nearest shades pair up first, so a small distinct colour is not swallowed early.
    clusters = [[best[key], n] for key, n in buckets.items()]
    for reach in MERGE_ROUNDS:
        leaders = []
        for colour, n in sorted(clusters, key=lambda c: (-c[1], c[0])):
            near = [c for c in leaders if distance(c[0], colour) <= reach]
            if near: min(near, key=lambda c: (distance(c[0], colour), c[0]))[1] += n
            else: leaders.append([colour, n])
        clusters = leaders
    clusters = [c for c in clusters if c[1] / total >= MIN_SHARE]
    # Into the console's colours; two merged colours that land on the same Mega Drive colour become one.
    snapped = Counter()
    for colour, n in clusters: snapped[md_color(colour)] += n
    palette = sorted(snapped.items(), key=lambda kv: (-kv[1], kv[0]))
    # One palette line holds 16 colours: merge the two most alike until it fits (the rarer joins the commoner), so a
    # rare but distinct colour such as the inside of a mouth outlives two nearly equal skin tones.
    palette = [list(p) for p in palette]
    while len(palette) > COLORS:
        i, j = min(((i, j) for i in range(len(palette)) for j in range(i + 1, len(palette))),
                   key=lambda ij: (distance(palette[ij[0]][0], palette[ij[1]][0]), ij))
        keep, drop = (i, j) if palette[i][1] >= palette[j][1] else (j, i)
        palette[keep][1] += palette[drop][1]; del palette[drop]
    palette.sort(key=lambda p: (-p[1], p[0]))
    return [tuple(c) for c, _ in palette]

def nearest(palette):
    cache = {}
    def index(p):
        if p not in cache:
            cache[p] = min(range(len(palette)), key=lambda i: (distance(p, palette[i]), i))
        return cache[p]
    return index

# The source's virtual pixels are neither exactly 8 image pixels wide nor lined up with the cell's corner, and each
# cell is off by its own amount; a fixed 8x8 block grid cuts features in half and bends mouths (user, 2026-09-24).
# So every cell's grid is measured: the pitch and phase whose lines sit on the strongest colour edges, per axis.
PITCHES = [round(6.0 + 0.02 * i, 2) for i in range(351)]   # 6.0 .. 13.0 image pixels per virtual pixel
INNER = 0.25   # a virtual pixel votes with its centre only, this share trimmed from each side

def edge_profile(cell, axis):
    """How strongly the colour changes between neighbouring columns (x) or rows (y), averaged across the cell."""
    w, h = cell.size
    if axis == 'x':
        diff = ImageChops.difference(cell.crop((1, 0, w, h)), cell.crop((0, 0, w - 1, h))).convert('L')
        return pixels_of(diff.resize((w - 1, 1), Image.Resampling.BOX))
    diff = ImageChops.difference(cell.crop((0, 1, w, h)), cell.crop((0, 0, w, h - 1))).convert('L')
    return pixels_of(diff.resize((1, h - 1), Image.Resampling.BOX))

def best_phase(profile, pitch):
    # Contrast, not just edge strength: the true grid has strong edges on its lines and calm centres. Double the pitch
    # also lands on real edges, but its centres are real edges too; half the pitch puts lines in calm centres.
    best = None
    last = len(profile) - 1
    for q in range(int(pitch * 4)):
        phase = q / 4
        count = int((len(profile) - phase) / pitch) + 1
        lines = [profile[min(last, int(round(phase + k * pitch)))] for k in range(count)]
        centres = [profile[min(last, int(round(phase + (k + 0.5) * pitch)))] for k in range(count)]
        score = sum(lines) / count - sum(centres) / count
        if best is None or score > best[0]: best = (score, phase)
    return best

def sheet_pitch(profiles):
    """Virtual pixels are square and the whole sheet is drawn at one scale, so one pitch serves every cell and both
    axes; only the phase is measured per cell and axis. Fitting a pitch per axis alone let weak vertical edges pick
    anything from 59 to 68 rows."""
    return max(PITCHES, key=lambda pitch: (sum(best_phase(p, pitch)[0] for p in profiles), -pitch))

def spans(size, pitch, phase):
    """The virtual pixels along one axis as [start, end) in image pixels; a sliver under half a pitch is dropped."""
    edges = [int(round(phase + k * pitch)) + 1 for k in range(int((size - phase) / pitch) + 2)]
    edges = [0] + [e for e in edges if 0 < e < size] + [size]
    return [(a, b) for a, b in zip(edges, edges[1:]) if b - a >= pitch / 2]

def median(values):
    ordered = sorted(values); return ordered[len(ordered) // 2]

def centre_grid(cell, pitch):
    """Step 3a: the colour at the centre of every virtual pixel (per-channel median of its middle), row by row."""
    data = cell.load()
    cols = spans(cell.width, pitch, best_phase(edge_profile(cell, 'x'), pitch)[1])
    rows = spans(cell.height, pitch, best_phase(edge_profile(cell, 'y'), pitch)[1])
    grid = []
    for y0, y1 in rows:
        my = int((y1 - y0) * INNER); line = []
        for x0, x1 in cols:
            mx = int((x1 - x0) * INNER)
            region = [data[x, y] for y in range(y0 + my, y1 - my) for x in range(x0 + mx, x1 - mx)]
            line.append(tuple(median([p[c] for p in region]) for c in range(3)))
        grid.append(line)
    return grid

def place(grid, palette, flat):
    """Step 3b: every virtual pixel to its palette colour, centred on a 64x64 canvas padded with the background."""
    index = nearest(palette)
    values = [[index(c) for c in line] for line in grid]
    border = Counter(values[0] + values[-1] + [r[0] for r in values] + [r[-1] for r in values])
    background = max(border.items(), key=lambda kv: (kv[1], -kv[0]))[0]
    out = Image.new('P', (CELL, CELL), background)
    out.putpalette(flat + [0] * (768 - len(flat)))
    oy, ox = (CELL - len(values)) // 2, (CELL - len(values[0])) // 2
    for gy, line in enumerate(values):
        for gx, value in enumerate(line):
            x, y = gx + ox, gy + oy
            if 0 <= x < CELL and 0 <= y < CELL: out.putpixel((x, y), value)
    return out

# Palette swaps after review (user, 2026-09-24): Wren's skin one step lighter, same pixels.
PALETTE_SWAPS = {
    'wren': {(255, 206, 144): (255, 206, 172), (206, 144, 87): (206, 172, 116)},
}

def process(name):
    source = FOLDER / f'source-{name}.png'
    with Image.open(source) as image:
        sheet = image.convert('RGB')
    folder = FOLDER / name; (folder / 'cells').mkdir(parents=True, exist_ok=True)
    atlas = Image.new('P', (CELL * GRID, CELL * GRID))
    cells = []
    cw, ch = sheet.width // GRID, sheet.height // GRID
    crops = [sheet.crop((i % GRID * cw, i // GRID * ch, (i % GRID + 1) * cw, (i // GRID + 1) * ch)) for i in range(GRID * GRID)]
    pitch = sheet_pitch([edge_profile(c, axis) for c in crops for axis in 'xy'])
    grids = [centre_grid(c, pitch) for c in crops]
    palette = merged_palette(Counter(colour for grid in grids for line in grid for colour in line))
    swaps = PALETTE_SWAPS.get(name, {})
    missing = [c for c in swaps if c not in palette]
    if missing: raise SystemExit(f'{name}: palette swap source not in the palette: {missing}')
    shown = [swaps.get(c, c) for c in palette]
    flat = [v for p in shown for v in p]
    atlas.putpalette(flat + [0] * (768 - len(flat)))
    for i in range(GRID * GRID):
        x, y = i % GRID, i // GRID
        cell, native = place(grids[i], palette, flat), (len(grids[i][0]), len(grids[i]))
        path = folder / 'cells' / f'{i + 1:02d}.png'
        cell.save(path, bits=4, optimize=False)
        atlas.paste(cell, (x * CELL, y * CELL))
        cells.append({'file': path.relative_to(ROOT).as_posix(), 'native': list(native), 'colors': len(set(pixels_of(cell))), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    atlas.save(folder / 'sheet.png', bits=4, optimize=False)
    preview = atlas.convert('RGB').resize((atlas.width * SCALE, atlas.height * SCALE), Image.Resampling.NEAREST)
    swatch_h = 24
    board = Image.new('RGB', (preview.width, preview.height + swatch_h), (8, 10, 12))
    board.paste(preview, (0, 0))
    step = preview.width // len(palette)
    for i, c in enumerate(shown):
        board.paste(c, (i * step, preview.height, (i + 1) * step - 2, preview.height + swatch_h))
    board.save(folder / 'preview.png')
    manifest = {
        'source': source.relative_to(ROOT).as_posix(), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'grid': GRID, 'cell': CELL, 'palette': ['#%02X%02X%02X' % c for c in shown], 'megadrive_words': [md_word(c) for c in shown],
        'pitch': pitch,
        'palette_swaps': {'#%02X%02X%02X' % a: '#%02X%02X%02X' % b for a, b in swaps.items()},
        'md_levels': MD_LEVELS, 'steps': [f'merge colours in rounds of OKLab reach {MERGE_ROUNDS} (most frequent real colour leads), drop specks under {MIN_SHARE:.2%}', 'snap each colour to the closest-looking of the 512 Mega Drive colours (OKLab); over 16, merge the two most alike until 16 remain', 'one pitch for the sheet (6.0-13.0) and a phase per cell and axis, fitted to edge contrast (lines against centres); each virtual pixel votes from its centre; centred on 64x64', 'palette swaps after review'],
        'pillow': __version__, 'cells': cells,
    }
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return manifest

GAME = ROOT / 'assets/pixel/comms-v1'
INSTALLED = FOLDER / 'installed.json'

def install(names, force=False):
    """Copy the approved sheets into the game (assets/pixel/comms-v1/<name>.png). Hand edits are made to those game
    files (user, 2026-09-24: a few pixels at a time), so an install refuses to overwrite a game file that no longer
    matches what was installed last, unless forced."""
    record = json.loads(INSTALLED.read_text(encoding='utf-8')) if INSTALLED.exists() else {}
    GAME.mkdir(parents=True, exist_ok=True)
    for name in names:
        target, sheet = GAME / f'{name}.png', FOLDER / name / 'sheet.png'
        if target.exists() and not force:
            current = hashlib.sha256(target.read_bytes()).hexdigest()
            if current != record.get(name, {}).get('sha256'):
                raise SystemExit(f'{target.relative_to(ROOT)} was edited by hand since the last install; keep it, or pass --force')
        target.write_bytes(sheet.read_bytes())
        record[name] = {'from': sheet.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        print('installed', target.relative_to(ROOT).as_posix())
    INSTALLED.write_text(json.dumps(record, ensure_ascii=False, indent=1) + chr(10), encoding='utf-8')

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = args or ['egret', 'wren']
    if '--install' in sys.argv:
        install(names, force='--force' in sys.argv)
        return
    for name in names:
        m = process(name)
        print(name, len(m['palette']), 'colors', ' '.join(m['megadrive_words']))

if __name__ == '__main__':
    main()
