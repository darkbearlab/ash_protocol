"""Deterministic 32px unit delivery. Never writes the live game atlases.
Pillow + numpy; BOX sample -> weighted palette -> RGB5 -> binary alpha -> 4-bit PNG.
The outline is the user-approved exception to RGB5: exactly (12,14,18).
Run from any cwd: python art/units-v2/process.py [unit-id ...]
"""
from pathlib import Path
import sys,json,hashlib,struct
import numpy as np
from PIL import Image,ImageDraw,ImageFont

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
OUT=ROOT/'assets/pixel/units-v2';OUT.mkdir(parents=True,exist_ok=True)
UNITS=json.loads((HERE/'units.json').read_text(encoding='utf-8'))['units']
OUTLINE=(12,14,18)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rgb5(v):return round(round(v*31/255)*255/31)
def pixelize(cell):
    rgba=cell.convert('RGBA');alpha=rgba.getchannel('A').point(lambda a:255 if a>=128 else 0)
    bounds=alpha.getbbox()
    if not bounds:raise ValueError('Empty source sprite')
    rgba=rgba.crop(bounds)
    scale=min(26/rgba.width,26/rgba.height)
    reduced=rgba.resize((max(1,round(rgba.width*scale)),max(1,round(rgba.height*scale))),Image.Resampling.BOX)
    canvas=Image.new('RGBA',(32,32));canvas.alpha_composite(reduced,((32-reduced.width)//2,(32-reduced.height)//2))
    data=np.asarray(canvas).copy();mask=data[:,:,3]>=128
    opaque=data[:,:,:3][mask]
    # Preserve identifying equipment lights, flesh, infection and fuel panels,
    # rather than weighting only the old cyan-visor hue.
    colors=opaque.astype(np.int16)
    accent=opaque[(colors.max(axis=1)>120)&((colors.max(axis=1)-colors.min(axis=1))>55)]
    training=np.concatenate([opaque,np.tile(accent,(5,1))]) if len(accent) else opaque
    img=Image.fromarray(training[None,:,:].astype('uint8'),'RGB')
    q=img.quantize(colors=14,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
    pal=q.getpalette();palette=[]
    for i in sorted(set(np.asarray(q).ravel())):
        c=tuple(rgb5(v) for v in pal[i*3:i*3+3])
        if c not in palette:palette.append(c)
    palarr=np.asarray(palette,dtype=np.int32)
    mapped=np.argmin(((data[:,:,:3,None].transpose(0,1,3,2).astype(np.int32)-palarr)**2).sum(axis=3),axis=2)
    rgb=palarr[mapped]
    # Remove only one outer dark source contour. Do not erode narrow dark weapons
    # without an adjacent brighter body pixel; all internal shading is retained.
    neighbor_empty=np.zeros_like(mask);neighbor_bright=np.zeros_like(mask)
    bright=(rgb.max(axis=2)>57)&mask
    for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
        neighbor_empty |= ~np.roll(mask,(dy,dx),(0,1))
        neighbor_bright |= np.roll(bright,(dy,dx),(0,1))
    old_rim=mask&neighbor_empty&neighbor_bright&(rgb.max(axis=2)<=41)
    body=mask&~old_rim
    outline=np.zeros_like(mask)
    for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
        outline|=np.roll(body,(dy,dx),(0,1))
    outline&=~body
    fullpalette=[(0,0,0),OUTLINE]+palette
    idx=np.zeros((32,32),np.uint8);idx[body]=mapped[body]+2;idx[outline]=1
    # Drop unused interior colors, keeping transparent index 0 and outline index 1.
    used=sorted(set(idx.ravel()));lut={old:i for i,old in enumerate(used)}
    assert used[:2]==[0,1]
    final=[fullpalette[i] for i in used]
    idx=np.asarray([lut[i] for i in idx.ravel()],np.uint8).reshape(32,32)
    image=Image.fromarray(idx,'P');flat=[c for color in final for c in color]
    image.putpalette(flat+[0]*(768-len(flat)));image.info['transparency']=0
    return image,final,dict(sourceCrop=list(bounds),scaledBody=list(reduced.size),removedSourceRimPixels=int(old_rim.sum()),outlinePixels=int(outline.sum()))

def run():
    requested=set(sys.argv[1:]);byname={}
    old=OUT/'sprites.json'
    if old.exists():byname=json.loads(old.read_text(encoding='utf-8'))['sprites']
    for unit in UNITS:
        uid=unit['id'];path=HERE/'sources'/f'{uid}.png'
        if not path.exists() or (requested and uid not in requested):continue
        source=Image.open(path).convert('RGBA')
        assert source.getchannel('A').getextrema()[0]==0,uid+' has no genuine alpha'
        for i,name in enumerate((uid,'dead-'+uid)):
            cell=source.crop((i*source.width//2,0,(i+1)*source.width//2,source.height))
            indexed,palette,info=pixelize(cell)
            dest=OUT/(name+'.png');indexed.save(dest,transparency=0,bits=4,optimize=True)
            byname[name]=dict(file=dest.name,unit=uid,pose='standing' if i==0 else 'corpse',batch=unit['batch'],
                             w=32,h=32,colors=len(palette),palette=palette,paletteIncludesTransparency=True,
                             transparentIndex=0,outlineIndex=1,sha256=sha(dest),source='art/units-v2/sources/'+path.name,
                             source_sha256=sha(path),processing=info)
    metadata=dict(tileSize=32,rgbBits=5,rgb5Exceptions=[dict(color=OUTLINE,reason='Existing outline; explicitly approved by user 2026-10-04')],
                  dither=False,bitDepth=4,colorType=3,alpha='binary',sprites=byname)
    (OUT/'sprites.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    create_previews(byname)
    verify(metadata)
    print(json.dumps(dict(sprites=len(byname),units=len(byname)//2,format='32px indexed PNG / 4-bit / <=16 colors'),ensure_ascii=False))

def create_previews(byname):
    selected=[u for u in UNITS if u['id'] in byname]
    columns=4;cw=280;ch=174;rows=(len(selected)+columns-1)//columns
    sheet=Image.new('RGB',(columns*cw,rows*ch),(22,27,31));draw=ImageDraw.Draw(sheet)
    try:font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
    except OSError:font=ImageFont.load_default()
    for i,u in enumerate(selected):
        x=(i%columns)*cw;y=(i//columns)*ch
        draw.text((x+9,y+7),u['id'],font=font,fill=(208,220,219))
        pair=Image.new('RGBA',(64,32))
        for j,name in enumerate((u['id'],'dead-'+u['id'])):
            image=Image.open(OUT/(name+'.png')).convert('RGBA')
            pair.alpha_composite(image,(j*32,0))
            draw.rectangle((x+8+j*132,y+34,x+135+j*132,y+161),fill=(38,45,46))
            sheet.paste(image.resize((128,128),Image.Resampling.NEAREST),(x+8+j*132,y+34),image.resize((128,128),Image.Resampling.NEAREST))
        pair.resize((256,128),Image.Resampling.NEAREST).save(OUT/(u['id']+'-preview-4x.png'))
    sheet.save(OUT/'preview-4x.png')
    for batch in range(1,6):
        group=[u for u in selected if u['batch']==batch]
        if not group:continue
        preview=Image.new('RGB',(560,len(group)*148),(22,27,31));d=ImageDraw.Draw(preview)
        for i,u in enumerate(group):
            d.text((8,i*148+5),u['id'],font=font,fill=(220,228,221))
            for j,name in enumerate((u['id'],'dead-'+u['id'])):
                im=Image.open(OUT/(name+'.png')).convert('RGBA').resize((128,128),Image.Resampling.NEAREST)
                preview.paste(im,(270+j*136,i*148+10),im)
        preview.save(OUT/f'batch-{batch}-preview-4x.png')

def verify(meta):
    allowed={rgb5(v) for v in range(256)}
    for name,entry in meta['sprites'].items():
        p=OUT/entry['file'];b=p.read_bytes();im=Image.open(p);rgba=im.convert('RGBA')
        assert im.size==(32,32) and im.mode=='P' and b[24:26]==bytes([4,3]),name
        assert im.info.get('transparency')==0 and len(im.getcolors())<=16,name
        assert set(np.asarray(rgba)[:,:,3].ravel())<={0,255},name
        bb=rgba.getbbox();assert bb and bb[0]>=2 and bb[1]>=2 and bb[2]<=30 and bb[3]<=30,(name,bb)
        assert sha(p)==entry['sha256'],name
        for c in entry['palette'][1:]:assert tuple(c)==OUTLINE or all(v in allowed for v in c),(name,c)
        assert tuple(entry['palette'][1])==OUTLINE,name
    return True

if __name__=='__main__':run()
