"""Deterministic GPT atlas -> 28 RGB5/16-colour 32px material/object tiles."""
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'art/killhouse-v2/source.png'
out=ROOT/'assets/pixel/killhouse-v2'
names=['partitionFace','partitionCap','lowFace','lowCap','case','barrel','terminal','toilet','sink','counter','scanner','locker','bench','desk','pallet','grate','rover_0','rover_1','shuttle_0','shuttle_1','rover_2','rover_3','shuttle_2','shuttle_3','rover_4','rover_5','shuttle_4','shuttle_5']
im=Image.open(source).convert('RGBA'); atlas=Image.new('RGBA',(128,224));out.mkdir(parents=True,exist_ok=True)
for i,name in enumerate(names):
    x,y=i%4,i//4
    tile=im.crop((round(x*im.width/4),round(y*im.height/7),round((x+1)*im.width/4),round((y+1)*im.height/7)))
    if i<4 or i>=16:
        box=tile.getchannel('A').point(lambda v:255 if v>=128 else 0).getbbox()
        if box: tile=tile.crop(box)
    tile=tile.resize((32,32),Image.Resampling.BOX)
    alpha=tile.getchannel('A').point(lambda v:255 if v>=128 else 0)
    if i<4 or i==15: alpha=Image.new('L',(32,32),255)
    rgb=tile.convert('RGB').quantize(colors=16,dither=Image.Dither.NONE).convert('RGB').point(lambda v:round(round(v*31/255)*255/31)).convert('RGBA');rgb.putalpha(alpha)
    rgb.save(out/f'{name}.png');atlas.paste(rgb,(x*32,y*32))
atlas.save(out/'atlas.png');atlas.resize((512,896),Image.Resampling.NEAREST).save(ROOT/'art/killhouse-v2/preview.png')
(out/'manifest.json').write_text(json.dumps({'size':32,'columns':4,'names':names,'colorsPerTile':16,'rgbBits':5,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()},indent=2)+'\n')
