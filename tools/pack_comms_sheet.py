"""Packs a hand-edited comms portrait sheet down to the faces the game uses (3.177.4). Pillow only.

python tools/pack_comms_sheet.py egret art/comms-v1/manual/egret_edit-2026-09-25.png --cells 5,2,3,6,7,8,10,13 --label 2026-09-25-before-manual-edit

The edit is a 4x4 sheet of 64x64 faces in the order tools/pixelize_comms_portraits.py draws them; --cells lists the ones
to keep (numbered 1-16, left to right, top to bottom), in the order they go into the packed sheet, four to a row. Which
expression names point at which packed cell is src/comms.js (COMMS_SPEAKERS), kept by hand. This tool:
1. checks the edit: 256x256, indexed, at most 16 colours;
2. archives the sheet now in the game (assets/pixel/comms-v1/<name>.png) under art/comms-v1/archive/<label>/ (refuses to
   overwrite an archive that already exists);
3. writes the packed sheet with the edit's own palette, pixel for pixel;
4. records it in art/comms-v1/installed.json with `packed` (source, its hash, the cells, the archive), so
   pixelize_comms_portraits.py --install will not put an unpacked sheet back over it without --force.
"""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'assets/pixel/comms-v1'
FOLDER = ROOT / 'art/comms-v1'
CELL = 64

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    args = argparse.ArgumentParser()
    args.add_argument('name'); args.add_argument('edit')
    args.add_argument('--cells', required=True); args.add_argument('--label', required=True)
    opts = args.parse_args()
    edit = (ROOT / opts.edit).resolve(); sheet = Image.open(edit)
    if sheet.size != (4 * CELL, 4 * CELL) or sheet.mode != 'P':
        raise SystemExit(f'the edit is {sheet.mode} {sheet.size}, not an indexed 256x256 sheet')
    if len(sheet.getcolors(256) or []) > 16:
        raise SystemExit('the edit uses more than 16 colours')
    cells = [int(n) for n in opts.cells.split(',')]
    if not cells or len(set(cells)) != len(cells) or any(n < 1 or n > 16 for n in cells):
        raise SystemExit('--cells takes distinct numbers from 1 to 16')

    target = FOLDER / 'archive' / opts.label
    if target.exists():
        raise SystemExit(f'{target} already exists')
    target.mkdir(parents=True)
    game = GAME / f'{opts.name}.png'
    shutil.copy2(game, target / game.name)

    rows = (len(cells) + 3) // 4
    packed = Image.new('P', (4 * CELL, rows * CELL), 0)
    packed.putpalette(sheet.getpalette())
    for i, n in enumerate(cells):
        x, y = (n - 1) % 4 * CELL, (n - 1) // 4 * CELL
        packed.paste(sheet.crop((x, y, x + CELL, y + CELL)), (i % 4 * CELL, i // 4 * CELL))
    packed.save(game)

    record_path = FOLDER / 'installed.json'
    record = json.loads(record_path.read_text(encoding='utf-8')) if record_path.exists() else {}
    record[opts.name] = {'from': str(edit.relative_to(ROOT)).replace('\\', '/'), 'sha256': sha(game),
                         'packed': {'label': opts.label, 'source_sha256': sha(edit), 'cells': cells,
                                    'archive': str(target.relative_to(ROOT)).replace('\\', '/')}}
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=1) + chr(10), encoding='utf-8')   # the format pixelize_comms_portraits.py writes
    print(f'packed {len(cells)} faces into {game.relative_to(ROOT).as_posix()} ({packed.size[0]}x{packed.size[1]}); archived the old sheet in {target.relative_to(ROOT).as_posix()}')

if __name__ == '__main__':
    main()
