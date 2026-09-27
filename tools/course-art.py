# Joins the training course's captured clips into card pictures (3.198.0; clips from tools/course-shots.mjs).
#   python tools/course-art.py [rawDir] [outDir]
# A scene with several clips is laid side by side on the card's dark ground; rings from a clip's .json sidecar are
# drawn in the course's amber; the cover chips are enlarged pixel for pixel. Deterministic: same clips, same files.
import json, os, re, sys
from PIL import Image, ImageDraw

RAW = sys.argv[1] if len(sys.argv) > 1 else 'qa/course-shots'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/course'
GROUND, RING, EDGE = (11, 16, 13), (234, 177, 96), (58, 70, 54)
GAP, PAD, MAX_W = 20, 14, 720

def clip(path):
    img = Image.open(path).convert('RGB')
    marks = path[:-4] + '.json'
    if os.path.exists(marks):
        d = ImageDraw.Draw(img)
        for x, y, w, h in json.load(open(marks)):
            d.rounded_rectangle([x - 3, y - 3, x + w + 3, y + h + 3], radius=8, outline=RING, width=4)
    return img

def lay(images, scale=1):
    images = [i.resize((i.width * scale, i.height * scale), Image.NEAREST) if scale != 1 else i for i in images]
    w = sum(i.width for i in images) + GAP * (len(images) - 1) + PAD * 2
    h = max(i.height for i in images) + PAD * 2
    sheet = Image.new('RGB', (w, h), GROUND)
    x = PAD
    for i in images:
        y = (h - i.height) // 2
        sheet.paste(i, (x, y))
        ImageDraw.Draw(sheet).rectangle([x - 1, y - 1, x + i.width, y + i.height], outline=EDGE)
        x += i.width + GAP
    if sheet.width > MAX_W:
        sheet = sheet.resize((MAX_W, round(sheet.height * MAX_W / sheet.width)), Image.LANCZOS)
    return sheet

os.makedirs(OUT, exist_ok=True)
groups = {}
for f in sorted(os.listdir(RAW)):
    m = re.match(r'^(.+?)(\.en)?-(\d+)\.png$', f)
    if m: groups.setdefault(m.group(1) + (m.group(2) or ''), []).append((int(m.group(3)), os.path.join(RAW, f)))
for name, parts in sorted(groups.items()):
    images = [clip(p) for _, p in sorted(parts)]
    sheet = lay(images, scale=3 if name.startswith('cover-status') else 1)
    target = os.path.join(OUT, name + '.png')
    sheet.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE).save(target, optimize=True)
    print(f'{target} {sheet.width}x{sheet.height} {os.path.getsize(target)//1024}KB')
