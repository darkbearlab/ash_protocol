"""Rebuild the smoke field textures (3.202.0). Python 3 + Pillow + numpy; no randomness, no game imports.

  python art/smoke-field-v1/process.py

Writes assets/pixel/smoke-field-v1/:
- layers.png: the five kinds' 256px textures side by side (1280x256), 4-bit, the fx-v1 smoke palette (three shades a
  kind, RGB5), hard alpha. The game stacks three offset copies of it at run time (src/renderer.js cloudField).
- baked-<kind>.png: the same three-layer stack pre-composited into one 256px texture per kind (the 'light' smoke
  setting), colour-reduced again to 15 colours plus transparency, RGB5, alpha in quarters. One file a kind keeps each
  image within 16 colours (docs/PIXEL_ART.md).
Previews go to art/smoke-field-v1/preview-*.png, never into assets/.
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'assets/pixel/smoke-field-v1'
OUT.mkdir(parents=True, exist_ok=True)
N = 256
KINDS = ['smoke', 'haze', 'steam', 'toxic', 'spore']
BG = (16, 19, 19, 255)

def rgb5(c):
    return tuple(round(round(v * 31 / 255) * 255 / 31) for v in c)

# The fx-v1 smoke families (art/fx-v1/process.py SMOKE), three shades a kind.
SMOKE = [rgb5(tuple(bytes.fromhex(h))) for h in '526575 7b92a5 abc1cd 89999c b5c6c6 d4dfe8 719da5 a5cdd6 deeff7 526b29 8fbf4a c6e586 665139 9c7d53 c8ad87'.split()]

# The run-time stack, mirrored from src/renderer.js (FIELD_STACKS.layers, CLOUD_TONES[kind][0], FIELD_VEIL).
TONES = {'smoke': '#abc1cd66', 'haze': '#c9d3da2e', 'steam': '#e3f1f55c', 'toxic': '#8fbf4a55', 'spore': '#9c7d5366'}
VEIL = .5
LAYERS = [((0, 0), .9, (8, 12, 14, .45)), ((131, 71), .55, None), ((57, 199), .45, (235, 242, 246, .3))]

def seamless(im):
    """Premultiplied RGBA float, made to wrap: the source in the middle, a half-offset copy at the edges."""
    a = np.asarray(im.convert('RGBA')).astype(np.float64) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    r = np.roll(a, (N // 2, N // 2), axis=(0, 1))
    u = np.abs(np.arange(N) * 2 / (N - 1) - 1)
    w = np.outer(1 - u, 1 - u)
    w = (w * w * (3 - 2 * w))[:, :, None]
    o = w * a + (1 - w) * r
    rgb = np.where(o[:, :, 3:4] > 0, o[:, :, :3] / np.maximum(o[:, :, 3:4], 1e-6), 0)
    return np.concatenate([rgb, o[:, :, 3:4]], axis=2)

def nearest(a, colors):
    p = np.array(colors, dtype=np.float64) / 255
    d = a[:, :, None, :3] - p[None, None]
    ix = np.argmin((d * d).sum(axis=3), axis=2) + 1
    ix[a[:, :, 3] < .5] = 0
    return ix

def save_indexed(path, ix, palette, alphas=None):
    img = Image.fromarray(ix.astype(np.uint8), 'P')
    img.putpalette([0, 0, 0] + [v for c in palette for v in c] + [0] * (768 - 3 - 3 * len(palette)))
    trns = bytes([0] + (alphas or [255] * len(palette)))
    img.save(path, bits=4, transparency=trns, optimize=False)
    return img

def median_cut(px, count):
    boxes = [px]
    while len(boxes) < count:
        i = max(range(len(boxes)), key=lambda b: np.ptp(boxes[b], axis=0).max() if len(boxes[b]) > 1 else -1)
        b = boxes.pop(i)
        ch = int(np.argmax(np.ptp(b, axis=0)))
        b = b[np.argsort(b[:, ch], kind='stable')]
        h = len(b) // 2
        boxes += [b[:h], b[h:]]
    return np.array([b.mean(axis=0) for b in boxes])

# 1. layers.png
atlas = np.zeros((N, N * 5), dtype=np.uint8)
for k, kind in enumerate(KINDS):
    im = Image.open(HERE / f'source-{kind}.png').convert('RGBA').resize((N, N), Image.Resampling.BOX)
    ix = nearest(seamless(im), SMOKE[k * 3:k * 3 + 3])
    atlas[:, k * N:(k + 1) * N] = np.where(ix > 0, ix + k * 3, 0)
save_indexed(OUT / 'layers.png', atlas, SMOKE)
layers = np.asarray(Image.open(OUT / 'layers.png').convert('RGBA')).astype(np.float64) / 255

# 2. baked-<kind>.png
def rgba(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5, 7)]

for k, kind in enumerate(KINDS):
    t = layers[:, k * N:(k + 1) * N].copy()
    t[:, :, :3] *= t[:, :, 3:4]
    v = rgba(TONES[kind])
    acc = np.zeros_like(t)
    acc[:, :, 3] = v[3] * VEIL
    acc[:, :, :3] = np.array(v[:3]) * v[3] * VEIL
    for (ax, ay), alpha, tint in LAYERS:
        l = np.roll(t, (-ay, -ax), axis=(0, 1)).copy()   # texture pixel (x+at) shows at x, as the renderer offsets it
        if tint:
            tc = np.array(tint[:3]) / 255 * tint[3]
            l[:, :, :3] = l[:, :, :3] * (1 - tint[3]) + tc * l[:, :, 3:4]   # source-atop: tint only where the layer is
        l *= alpha
        acc = l + acc * (1 - l[:, :, 3:4])
    flat = acc.reshape(-1, 4)
    p = median_cut(flat[flat[:, 3] > .02], 15)
    a = np.clip(np.round(p[:, 3] * 4) / 4, .25, 1)
    rgb = np.clip(p[:, :3] / np.maximum(p[:, 3:4], 1e-6), 0, 1)
    rgb = np.round(np.round(rgb * 31) / 31 * 255) / 255
    pp = np.concatenate([rgb * a[:, None], a[:, None]], axis=1)
    ix = np.argmin(((flat[:, None, :] - pp[None]) ** 2).sum(axis=2), axis=1) + 1
    ix[flat[:, 3] <= .02] = 0
    save_indexed(OUT / f'baked-{kind}.png', ix.reshape(N, N), [tuple(int(round(c * 255)) for c in rgb[i]) for i in range(len(pp))], [int(round(x * 255)) for x in a])

# 3. manifest and previews (previews stay in art/)
files = ['layers.png'] + [f'baked-{k}.png' for k in KINDS]
manifest = {'version': 1, 'gameVersion': '3.202.0', 'textureSize': N, 'kinds': KINDS, 'files': {f: hashlib.sha256((OUT / f).read_bytes()).hexdigest() for f in files},
            'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(HERE.glob('source-*.png'))}}
(HERE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
prev = Image.new('RGBA', (N * 5, N * 2), BG)
prev.alpha_composite(Image.open(OUT / 'layers.png').convert('RGBA'), (0, 0))
for k, kind in enumerate(KINDS):
    prev.alpha_composite(Image.open(OUT / f'baked-{kind}.png').convert('RGBA'), (k * N, N))
prev.convert('RGB').save(HERE / 'preview-textures.png')

def validate():
    for f in files:
        raw = (OUT / f).read_bytes()
        im = Image.open(OUT / f)
        assert raw[24:26] == bytes([4, 3]), f + ': 4-bit indexed'
        assert len(im.getcolors()) <= 16 and len(im.getpalette()) // 3 <= 16, f
        pal = im.getpalette()
        assert all(rgb5(tuple(pal[i:i + 3])) == tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)), f + ': RGB5'
        trns = im.info['transparency']
        assert (trns == 0 if isinstance(trns, int) else trns[0] == 0), f + ': index 0 transparent'
        print(f, im.size, '4-bit / RGB5 / <=16 colours PASS')
validate()
