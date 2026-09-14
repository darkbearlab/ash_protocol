"""Append two generated 32px indexed sprites. Existing seventeen atlas cells never change.
Run: python tools/pixelize_swarm.py (Pillow only, no API calls).
"""
from pathlib import Path
import hashlib,json
from PIL import Image
from pixelize import pixelize_cell

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/swarm-v1/source.png'
OUT=ROOT/'assets/pixel/swarm-v1'
OUT.mkdir(parents=True,exist_ok=True)
source=Image.open(SOURCE).convert('RGBA')
assert source.getchannel('A').getextrema()[0]==0, 'Source needs genuine alpha'
metadata={'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'tileSize':32,'rgbBits':5,'dither':False,'sprites':{}}
preview=Image.new('RGBA',(64,32))
for i,(name,stem) in enumerate([('spitter','atlas'),('dead-spitter','aftermath')]):
    cell=source.crop((i*source.width//2,0,(i+1)*source.width//2,source.height))
    sprite,palette=pixelize_cell(cell)
    sprite.save(OUT/f'{name}.png',transparency=0,bits=4)
    preview.alpha_composite(sprite.convert('RGBA'),(i*32,0))
    path=ROOT/f'assets/pixel/{stem}.png'
    old=Image.open(path).convert('RGBA').copy()
    atlas=Image.new('RGBA',(128,160));atlas.alpha_composite(old);atlas.paste((0,0,0,0),(32,128,64,160));atlas.alpha_composite(sprite.convert('RGBA'),(32,128))
    assert atlas.crop((0,0,32,160)).tobytes()==old.crop((0,0,32,160)).tobytes() and atlas.crop((0,0,128,128)).tobytes()==old.crop((0,0,128,128)).tobytes()
    atlas.save(path,optimize=True)
    metadata['sprites'][name]={'x':32,'y':128,'w':32,'h':32,'palette':palette,'colors':len(palette)+1,'originalCellsSha256':hashlib.sha256(old.crop((0,0,128,128)).tobytes()+old.crop((0,128,32,160)).tobytes()).hexdigest()}
preview.resize((512,256),Image.Resampling.NEAREST).save(OUT/'preview.png')
(OUT/'sprites.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
