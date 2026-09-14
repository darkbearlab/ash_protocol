"""Append two generated 32px indexed sprites. Existing 4x4 atlas pixels never change.
Run: python tools/pixelize_civilians.py (Pillow only, no API calls).
"""
from pathlib import Path
import hashlib,json
from PIL import Image
from pixelize import pixelize_cell

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/civilians-v1/source.png'
OUT=ROOT/'assets/pixel/civilians-v1'
OUT.mkdir(parents=True,exist_ok=True)
source=Image.open(SOURCE).convert('RGBA')
assert source.getchannel('A').getextrema()[0]==0, 'Source needs genuine alpha'
metadata={'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'tileSize':32,'rgbBits':5,'dither':False,'sprites':{}}
preview=Image.new('RGBA',(64,32))
for i,(name,stem) in enumerate([('civilian','atlas'),('dead-civilian','aftermath')]):
    cell=source.crop((i*source.width//2,0,(i+1)*source.width//2,source.height))
    sprite,palette=pixelize_cell(cell)
    sprite.save(OUT/f'{name}.png',transparency=0,bits=4)
    preview.alpha_composite(sprite.convert('RGBA'),(i*32,0))
    path=ROOT/f'assets/pixel/{stem}.png'
    old=Image.open(path).convert('RGBA').crop((0,0,128,128))
    atlas=Image.new('RGBA',(128,160));atlas.alpha_composite(old);atlas.alpha_composite(sprite.convert('RGBA'),(0,128))
    assert atlas.crop((0,0,128,128)).tobytes()==old.tobytes()
    atlas.save(path,optimize=True)
    metadata['sprites'][name]={'x':0,'y':128,'w':32,'h':32,'palette':palette,'colors':len(palette)+1,'originalCellsSha256':hashlib.sha256(old.tobytes()).hexdigest()}
preview.resize((512,256),Image.Resampling.NEAREST).save(OUT/'preview.png')
(OUT/'sprites.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
