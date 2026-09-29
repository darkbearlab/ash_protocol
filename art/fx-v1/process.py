"""Rebuild FX v1. Python 3 + Pillow + numpy; no randomness or game imports."""
from pathlib import Path
import hashlib, json, math
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'assets/pixel/fx-v1'
OUT.mkdir(parents=True, exist_ok=True)
BG = (16, 19, 19, 255)

def rgb5(c):
    return tuple(round(round(v * 31 / 255) * 255 / 31) for v in c)

def palette(hexes):
    return [rgb5(tuple(bytes.fromhex(h))) for h in hexes.split()]

FIRE = palette('571819 872119 b53718 d55318 ef7b21 ffad32 ffd25a ffec9c fff7ce 424a4a 737b7b 9ca5a5')
SMOKE = palette('526575 7b92a5 abc1cd 89999c b5c6c6 d4dfe8 719da5 a5cdd6 deeff7 526b29 8fbf4a c6e586 665139 9c7d53 c8ad87')
VENT = palette('101819 293132 424a4a 5a6262 7b8484 adb5b5 526575 abc1cd 89999c d4dfe8 719da5 deeff7 526b29 c6e586')

def source(name):
    im = Image.open(HERE / ('source-' + name + '.png')).convert('RGBA')
    assert im.getchannel('A').getextrema()[0] == 0, name + ': source needs true alpha'
    return im

def crop(im, c, r, cols, rows):
    w, h = im.size
    return im.crop((round(c*w/cols), round(r*h/rows), round((c+1)*w/cols), round((r+1)*h/rows)))

def fit(im, size=(28,28), bottom=False):
    bbox = im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
    im=im.crop(bbox)
    scale=min(size[0]/im.width,size[1]/im.height)
    im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.BOX)
    out=Image.new('RGBA',(32,32))
    out.paste(im,((32-im.width)//2,30-im.height if bottom else (32-im.height)//2))
    return out

def indexed(im, colors):
    a=np.asarray(im.convert('RGBA')).copy()
    # All selected final colours are RGB5 before nearest-colour mapping, no dithering.
    p=np.array(colors,dtype=np.int32)
    delta=a[:,:,:3].astype(np.int32)[:,:,None,:]-p[None,None,:,:]
    ix=np.argmin((delta*delta).sum(axis=3),axis=2).astype(np.uint8)+1
    ix[a[:,:,3]<128]=0
    result=Image.fromarray(ix).convert('P')
    result.putpalette([0,0,0]+[v for c in colors for v in c]+[0]*(768-3-3*len(colors)))
    result.info['transparency']=0
    return result

def loop_warp(im, frame, smoke=False):
    # Four equal angular steps, so frame 3 -> 0 has the same phase step as 0 -> 1.
    # Inverse nearest-pixel sampling retains exact colour clusters and never interpolates.
    a=np.array(im)
    out=np.zeros_like(a)
    phase=frame*math.pi/2
    for y in range(1,31):
        for x in range(1,31):
            dx=round(math.sin(y*.36+phase)*(1 if smoke else (31-y)/24))
            dy=round(math.cos(x*.29+phase)*.8) if smoke else 0
            sx,sy=x-dx,y-dy
            if 0<=sx<32 and 0<=sy<32: out[y,x]=a[sy,sx]
    return Image.fromarray(out)

def sheet(frames,cols,rows):
    out=Image.new('RGBA',(cols*32,rows*32))
    for i,im in enumerate(frames): out.paste(im,(i%cols*32,i//cols*32))
    return out

SPECS={}
def save(name,im,colors,rows,cols,labels,loop=True,alpha=None):
    p=indexed(im,colors)
    p.save(OUT/(name+'.png'),bits=4,transparency=0,optimize=False)
    preview=p.convert('RGBA')
    bg=Image.new('RGBA',preview.size,BG)
    bg.alpha_composite(preview)
    bg.convert('RGB').resize((im.width*4,im.height*4),Image.Resampling.NEAREST).save(OUT/(name+'-preview-4x.png'))
    SPECS[name]={'file':name+'.png','width':im.width,'height':im.height,'cell':16 if name=='loot-flamer' else 32,'columns':cols,'rows':rows,'frameCount':rows*cols,'rowLabels':labels,'loop':loop,'fps':6 if cols>1 else 0,'alpha':alpha or [1]*rows,'palette':['#00000000']+['#'+bytes(c).hex() for c in colors],'sha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
    return p.convert('RGBA')

# Keep three different fire heights. Generated source rows are not evenly spaced.
src=source('fire')
fire=[]
for r,(y0,y1,height) in enumerate([(0,.40,28),(.405,.695,22),(.70,1,17)]):
    cell=src.crop((0,round(src.height*y0),round(src.width/4),round(src.height*y1)))
    base=fit(cell,(28,height),True)
    fire.extend(loop_warp(base,f) for f in range(4))
save('fire',sheet(fire,4,3),FIRE,3,4,['ignition','steady','embers'])

src=source('smoke')
smoke=[]
for r in range(5):
    base=fit(crop(src,0,r,4,5),(30,30))
    # Explicit family palettes avoid blue/cyan edge artefacts contaminating thin smoke.
    base=indexed(base,SMOKE[r*3:r*3+3]).convert('RGBA')
    smoke.extend(loop_warp(base,f,True) for f in range(4))
save('smoke',sheet(smoke,4,5),SMOKE,5,4,['thick','thin','steam','toxic','spore'],alpha=[.85,.5,.6,.55,.6])

# A single generated metal frame is shared by ALL states. Only authored indicator pixels vary.
base=fit(crop(source('vent'),0,0,5,4),(26,26))
base=indexed(base,VENT[:6]).convert('RGBA')
vents=[]
for r in range(4):
    dim,bright=VENT[6+r*2:8+r*2]
    for c in range(5):
        im=base.copy(); d=ImageDraw.Draw(im)
        for y in (5,26): d.line((13,y,18,y),fill=bright if c in (1,3,4) else dim,width=1)
        if c>=3:
            for k,y in enumerate((10,15,20)):
                d.line((9,y,22,y),fill=bright if (k+c)%2==0 else dim,width=1)
        vents.append(im)
save('vent',sheet(vents,5,4),VENT,4,5,['thick','thin','steam','toxic'])
SPECS['vent']['columnLabels']=['idle','warningA','warningB','activeA','activeB']
SPECS['vent']['loop']=False
SPECS['vent']['stateLoops']={'idle':[0],'warning':[1,2],'active':[3,4]}

# Source is a non-square strip. Use common image-space scale rather than stretching each flame.
src=source('flame-burst'); bursts=[]
for c in range(4):
    cell=crop(src,c,0,4,1)
    # Remove artefact vertical alpha seams on the generated cell boundaries.
    cell=cell.crop((6,0,cell.width-6,cell.height))
    cell=cell.resize((28,round(cell.height*28/cell.width)),Image.Resampling.BOX)
    # Common vertical window centres the jet, including weak ignition and dissipating tails.
    cell=cell.crop((0,round(cell.height*.54)-15,28,round(cell.height*.54)+15))
    im=Image.new('RGBA',(32,32)); im.paste(cell,(2,1)); bursts.append(im)
save('flame-burst',sheet(bursts,4,1),FIRE[:9],1,4,['burst'],loop=False)
SPECS['flame-burst']['direction']='east'
SPECS['flame-burst']['anchor']=[.5,.5]

# Retain the adopted loot silhouette, corners and luminance; bake weak halo over the dark floor.
im=source('loot-reference').crop((0,0,16,16))
a=np.asarray(im).copy(); lum=a[:,:,:3].max(axis=2)/255
alpha=a[:,:,3]/255
brightness=lum*alpha
a[:,:,0]=np.clip(brightness*255,0,255)
a[:,:,1]=np.clip(brightness*116,0,255)
a[:,:,2]=np.clip(brightness*49,0,255)
a[:,:,3]=np.where(alpha>=.12,255,0)
LOOT=palette('211810 392010 522910 6b3110 843910 a54210 c64a18 e65a21 ff7331 ff944a ffb563')
save('loot-flamer',Image.fromarray(a),LOOT,1,1,['fuelWeapon'],loop=False)

manifest={'version':1,'baseCommit':'cbaf1de','baseGameVersion':'3.201.0','bitDepth':4,'colorType':3,'transparentIndex':0,'rgb5':True,'phaseOffset':'(x*3+y*5)%4','assets':SPECS,'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(HERE.glob('source-*.png'))}}
(OUT/'fx-v1.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')

# Preview at intended opacity plus neighbouring tiles with independent phase offsets.
frames=[]
for phase in range(4):
    canvas=Image.new('RGBA',(256,288),BG);d=ImageDraw.Draw(canvas)
    for r in range(3):
        d.text((2,r*32+10),['IGNITE','STEADY','EMBERS'][r],fill='white')
        atlas=Image.open(OUT/'fire.png').convert('RGBA')
        for c in range(4):canvas.alpha_composite(crop(atlas,(phase+c)%4,r,4,3),(96+c*32,r*32))
    atlas=Image.open(OUT/'smoke.png').convert('RGBA')
    for r,opacity in enumerate([.85,.5,.6,.55,.6]):
        d.text((2,(r+3)*32+10),['THICK','THIN','STEAM','TOXIC','SPORE'][r],fill='white')
        for c in range(4):
            tile=crop(atlas,(phase+c*3)%4,r,4,5)
            tile.putalpha(tile.getchannel('A').point(lambda a:round(a*opacity)))
            canvas.alpha_composite(tile,(96+c*32,(r+3)*32))
    d.text((2,266),'BURST / FUEL',fill='white')
    canvas.alpha_composite(crop(Image.open(OUT/'flame-burst.png').convert('RGBA'),phase,0,4,1),(128,256))
    canvas.alpha_composite(Image.open(OUT/'loot-flamer.png').convert('RGBA'),(180,264))
    frames.append(canvas.convert('RGB').resize((768,864),Image.Resampling.NEAREST))
frames[0].save(OUT/'overview.png')
frames[0].save(OUT/'loops-preview.gif',save_all=True,append_images=frames[1:],duration=[170,160,170,170],loop=0)

def validate():
    for name,spec in SPECS.items():
        path=OUT/spec['file']; raw=path.read_bytes(); im=Image.open(path)
        assert raw[24:26]==bytes([4,3]),name+': IHDR'
        assert im.size==(spec['width'],spec['height']) and im.mode=='P'
        assert im.info['transparency']==0
        assert len(im.getpalette())//3<=16
        assert set(np.unique(np.asarray(im.convert('RGBA'))[:,:,3]))=={0,255}
        assert len(im.getcolors())<=16
        assert all(rgb5(tuple(im.getpalette()[i:i+3]))==tuple(im.getpalette()[i:i+3]) for i in range(0,len(im.getpalette()),3))
        cell=spec['cell']
        for y in range(spec['rows']):
            for x in range(spec['columns']):
                assert im.crop((x*cell,y*cell,(x+1)*cell,(y+1)*cell)).convert('RGBA').getchannel('A').getbbox(),(name,x,y)
        print(name,im.size,'4-bit / RGB5 / binary alpha / <=16 colours PASS',spec['sha256'])
validate()
