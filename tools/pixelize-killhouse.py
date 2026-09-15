"""Deterministic 4x2 GPT Image atlas -> eight 32px, 16-colour RGB5 sprites. No campaign files touched."""
from pathlib import Path
from PIL import Image
import hashlib, json
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'art/killhouse-v1/source.png'
out=ROOT/'assets/pixel/killhouse-v1'
names=['floor','wall-face','wall-cap','door-closed','door-broken','door-frame','door-cap','cover']
im=Image.open(source).convert('RGBA'); atlas=Image.new('RGBA',(128,64))
for i,name in enumerate(names):
    x,y=i%4,i//4
    tile=im.crop((round(x*im.width/4),round(y*im.height/2),round((x+1)*im.width/4),round((y+1)*im.height/2))).resize((32,32),Image.Resampling.BOX)
    alpha=tile.getchannel('A').point(lambda v:255 if v>=128 else 0)
    if i not in (4,7): alpha=Image.new('L',(32,32),255)
    rgb=tile.convert('RGB').quantize(colors=16,dither=Image.Dither.NONE).convert('RGB').point(lambda v:round(round(v*31/255)*255/31)).convert('RGBA');rgb.putalpha(alpha)
    out.mkdir(parents=True,exist_ok=True);rgb.save(out/f'{name}.png');atlas.paste(rgb,(x*32,y*32))
atlas.save(out/'atlas.png');atlas.resize((768,384),Image.Resampling.NEAREST).save(ROOT/'art/killhouse-v1/preview.png')
(out/'manifest.json').write_text(json.dumps({'size':32,'columns':4,'names':names,'colorsPerTile':16,'rgbBits':5,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()},indent=2)+'\n')
