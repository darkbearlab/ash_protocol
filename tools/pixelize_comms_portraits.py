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
     shows; the figure is framed on a 64x64 canvas (3.172.0: stray slivers from the neighbouring cell dropped, the
     head centred across the cell, every head of a sheet at one height).
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

def indexed(grid, palette):
    """Step 3b: every virtual pixel to its palette colour; the background is the commonest colour on the border."""
    index = nearest(palette)
    values = [[index(c) for c in line] for line in grid]
    border = Counter(values[0] + values[-1] + [r[0] for r in values] + [r[-1] for r in values])
    return values, max(border.items(), key=lambda kv: (kv[1], -kv[0]))[0]

# 3.172.0 (user: Egret's face was off centre): the figure is framed, not the sampled grid. The source's cells do not
# hold the figure at the same place, and a cell's edge can catch a sliver of its neighbour.
HEAD_ROWS = 14   # the top of the head (hair) sets the horizontal centre; lower rows carry the headset's boom mic

def figure(values, background):
    """Keeps the figure: the largest patch of non-background pixels, plus any patch that does not touch the cell's
    edge (a patch on the edge that is not the figure came from the neighbouring cell). Returns the cleaned grid, the
    head's top row and the head's horizontal centre."""
    h, w = len(values), len(values[0])
    # A head never reaches the top of its cell; anything on the first row is the collar of the cell above (Egret's
    # bottom row sits so high in the source that the cell's edge runs through the crown).
    values = [[background] * w] + [line[:] for line in values[1:]]
    seen, patches = set(), []
    for sy in range(h):
        for sx in range(w):
            if (sx, sy) in seen or values[sy][sx] == background: continue
            patch, stack = [], [(sx, sy)]; seen.add((sx, sy))
            while stack:
                x, y = stack.pop(); patch.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and values[ny][nx] != background:
                            seen.add((nx, ny)); stack.append((nx, ny))
            patches.append(patch)
    body = max(patches, key=len)
    cleaned = [line[:] for line in values]
    for patch in patches:
        if patch is not body and any(x in (0, w - 1) or y in (0, h - 1) for x, y in patch):
            for x, y in patch: cleaned[y][x] = background
    top = min(y for _, y in body)
    head = [x for x, y in body if y < top + HEAD_ROWS]
    return cleaned, top, (min(head) + max(head)) / 2

def place(values, background, ox, oy):
    """Step 3c: the grid on a 64x64 canvas padded with the background, offset so the figure is framed."""
    out = [[background] * CELL for _ in range(CELL)]
    for gy, line in enumerate(values):
        for gx, value in enumerate(line):
            x, y = gx + ox, gy + oy
            if 0 <= x < CELL and 0 <= y < CELL: out[y][x] = value
    return out

# 3.172.0 (user: enlarge Egret a little so she reaches the bottom of the frame). Pixel art only scales cleanly by whole
# numbers, so the sheet grows by repeating single rows and columns where a repeat shows least: lines that already
# match a neighbour in most of the sixteen faces (hair, uniform), never features such as eyes. The same lines are
# repeated in every cell so the faces stay aligned, and columns are repeated in mirrored pairs so the face stays
# symmetric. ENLARGE names the speakers; the rows added are what it takes for the typical figure to touch the bottom.
ENLARGE = {'egret'}
SPREAD = 4   # repeated lines at least this far apart, so no feature is stretched twice

def repeat_cost(cells, background, line, axis):
    """How much repeating one row (axis 'y') or column ('x') would show: in each cell, the pixels where it differs
    from its closer-matching neighbour. The worst face counts first: a line that is plain forehead in fifteen faces
    but the raised brows of the sixteenth would thicken those brows."""
    costs = []
    for cell in cells:
        get = (lambda i: cell[i]) if axis == 'y' else (lambda i: [row[i] for row in cell])
        here = get(line)
        if all(v == background for v in here): costs.append(0); continue
        costs.append(min(sum(a != b for a, b in zip(here, get(line + d))) for d in (-1, 1)))
    return (max(costs), sum(costs))

def pick(costs, count):
    chosen = []
    for key in sorted(costs, key=lambda k: (costs[k], k)):
        if len(chosen) == count: break
        if all(abs(key - c) >= SPREAD for c in chosen): chosen.append(key)
    return sorted(chosen)

def enlarge(cells, background):
    bottoms = [max(y for y in range(CELL) if any(v != background for v in cell[y])) for cell in cells]
    tops = [min(y for y in range(CELL) if any(v != background for v in cell[y])) for cell in cells]
    lefts = [min(x for x in range(CELL) if any(row[x] != background for row in cell)) for cell in cells]
    rights = [max(x for x in range(CELL) if any(row[x] != background for row in cell)) for cell in cells]
    rows = CELL - 1 - round(median(bottoms))
    height, width = median(bottoms) - median(tops) + 1, median(rights) - median(lefts) + 1
    pairs = round(rows * width / height / 2)
    top, bottom = round(median(tops)), round(median(bottoms))
    repeat_rows = pick({y: repeat_cost(cells, background, y, 'y') for y in range(top + 1, bottom)}, rows)
    # Mirrored pairs about the cell's centre line (between columns 31 and 32): distance d gives columns 31-d and 32+d.
    def pair_cost(d):
        left, right = repeat_cost(cells, background, 31 - d, 'x'), repeat_cost(cells, background, 32 + d, 'x')
        return (max(left[0], right[0]), left[1] + right[1])
    repeat_pairs = pick({d: pair_cost(d) for d in range(0, 31 - min(lefts))}, pairs)
    columns = sorted([31 - d for d in repeat_pairs] + [32 + d for d in repeat_pairs])
    grown = []
    for cell in cells:
        tall = [line for y, line in enumerate(cell) for _ in range(2 if y in repeat_rows else 1)][:CELL]
        wide = [[v for x, v in enumerate(line) for _ in range(2 if x in columns else 1)] for line in tall]
        cut = len(columns) // 2
        if any(v != background for line in wide for v in line[:cut] + line[-cut:]):
            raise SystemExit('enlarge: the figure would leave the cell')
        grown.append([line[cut:cut + CELL] for line in wide])
    return grown, {'rows': repeat_rows, 'columns': columns}

def bottom_on_frame(cells, background):
    """Moves the sheet down so the typical figure's bottom row is the cell's last row (user: reach the frame)."""
    shift = CELL - 1 - round(median([max(y for y in range(CELL) if any(v != background for v in cell[y])) for cell in cells]))
    if shift <= 0: return cells, 0
    return [[[background] * CELL for _ in range(shift)] + cell[:CELL - shift] for cell in cells], shift

# Fixed touch-ups, cell number (1-16) -> the colour the figure's top row should be. Egret 13: the source's cell edge
# blends her crown outline with the collar above, which comes out grey-purple; the other faces draw it dark.
CROWN_FIXES = {'egret': {13: (52, 52, 52)}}

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
    # Framing: each head centred across the cell, and every head of the sheet at one height, the one that centres the
    # typical figure top to bottom, so the face does not jump when the expression changes.
    framed = []
    for grid in grids:
        values, background = indexed(grid, palette)
        cleaned, top, centre = figure(values, background)
        bottom = max(y for y, line in enumerate(cleaned) for v in line if v != background)
        framed.append((cleaned, background, top, centre, bottom))
    head_top = round(median([(CELL - (bottom - top + 1)) / 2 for _, _, top, _, bottom in framed]))
    backgrounds = {background for _, background, _, _, _ in framed}
    if len(backgrounds) != 1: raise SystemExit(f'{name}: cells disagree on the background: {backgrounds}')
    background = backgrounds.pop()
    # A head of odd width sits on the cell's exact centre.
    canvases = [place(cleaned, background, int(CELL / 2 - centre), head_top - top) for cleaned, _, top, centre, _ in framed]
    grown = None
    if name in ENLARGE: canvases, grown = enlarge(canvases, background)
    canvases, lowered = bottom_on_frame(canvases, background)
    for number, colour in CROWN_FIXES.get(name, {}).items():
        cell = canvases[number - 1]
        top = min(y for y in range(CELL) if any(v != background for v in cell[y]))
        cell[top] = [palette.index(colour) if v != background else v for v in cell[top]]
    for i in range(GRID * GRID):
        x, y = i % GRID, i // GRID
        cell, native = Image.new('P', (CELL, CELL)), (len(grids[i][0]), len(grids[i]))
        cell.putpalette(flat + [0] * (768 - len(flat)))
        cell.putdata([v for line in canvases[i] for v in line])
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
        'pitch': pitch, 'repeated_lines': grown, 'lowered_rows': lowered, 'crown_fixes': {str(k): '#%02X%02X%02X' % v for k, v in CROWN_FIXES.get(name, {}).items()},
        'palette_swaps': {'#%02X%02X%02X' % a: '#%02X%02X%02X' % b for a, b in swaps.items()},
        'md_levels': MD_LEVELS, 'steps': [f'merge colours in rounds of OKLab reach {MERGE_ROUNDS} (most frequent real colour leads), drop specks under {MIN_SHARE:.2%}', 'snap each colour to the closest-looking of the 512 Mega Drive colours (OKLab); over 16, merge the two most alike until 16 remain', 'one pitch for the sheet (6.0-13.0) and a phase per cell and axis, fitted to edge contrast (lines against centres); each virtual pixel votes from its centre', 'framed on 64x64: edge slivers from neighbouring cells dropped, each head centred across the cell, one head height for the whole sheet; ENLARGE speakers grow by repeating the least visible rows and mirrored column pairs until the figure reaches the bottom; every figure lowered onto the bottom edge', 'palette swaps after review'],
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
            if record.get(name, {}).get('packed'):
                raise SystemExit(f'{target.relative_to(ROOT)} is a packed hand edit (tools/pack_comms_sheet.py; src/comms.js maps its cells); keep it, or pass --force')
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
