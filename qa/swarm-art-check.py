"""Read-only comparison with pre-swarm-rules art; never rewrites a baseline."""
from pathlib import Path
from io import BytesIO
import subprocess,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[1]
for stem in ['atlas','aftermath']:
    before=Image.open(BytesIO(subprocess.check_output(['git','show',f'b4f9c91:assets/pixel/{stem}.png'],cwd=root))).convert('RGBA')
    after=Image.open(root/f'assets/pixel/{stem}.png').convert('RGBA')
    assert before.size==after.size
    original=[]
    for i in range(17):
        x,y=i%4*32,i//4*32
        a,b=before.crop((x,y,x+32,y+32)),after.crop((x,y,x+32,y+32))
        assert a.tobytes()==b.tobytes(),f'{stem} cell {i} changed'
        original.append(a.tobytes())
    print(stem,'17 original cells identical',hashlib.sha256(b''.join(original)).hexdigest())
for name in ['spitter','dead-spitter']:
    img=Image.open(root/f'assets/pixel/swarm-v1/{name}.png')
    assert img.mode=='P' and img.size==(32,32) and len(img.getcolors())<=16 and img.info['transparency']==0
    print(name,'32px indexed <=16 colours, alpha index 0')
