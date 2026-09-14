"""Compare every original atlas pixel against fac5503. Read-only, requires Pillow."""
from pathlib import Path
from PIL import Image
from io import BytesIO
import hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1]
for name in ['atlas','aftermath']:
    before=Image.open(BytesIO(subprocess.check_output(['git','show',f'fac5503:assets/pixel/{name}.png'],cwd=ROOT))).convert('RGBA')
    after=Image.open(ROOT/f'assets/pixel/{name}.png').convert('RGBA')
    assert after.size==(128,160)
    assert after.crop((0,0,128,128)).tobytes()==before.tobytes()
    print(name, 'all 16 original cells identical',hashlib.sha256(before.tobytes()).hexdigest())
for name in ['civilian','dead-civilian']:
    image=Image.open(ROOT/f'assets/pixel/civilians-v1/{name}.png')
    assert image.mode=='P' and image.size==(32,32) and len(image.getcolors())<=16
    assert image.info['transparency']==0
    print(name,'32x32 indexed, <=16 colours, alpha index0')
