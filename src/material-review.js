import {MATERIALS,MATERIAL_SELECTION,validateSelection,materialSprite,TERRAIN_ATLAS} from './materials.js';
import {ArtToneCache} from './art-tone.js';
import {drawWall} from './walls.js';
const $=id=>document.getElementById(id),roles=['floor','face','cap'],labels={floor:'地板',face:'立面',cap:'頂板'},images=new Map(),tones=new ArtToneCache();
let draft=structuredClone(MATERIAL_SELECTION),dirty=false,ready=false;
function status(message){$('status').textContent=message;}
function valid(){try{validateSelection(draft);return true;}catch(error){status(error.message);return false;}}
function drawMaterial(ctx,id,role,x,y,size){const sprite=materialSprite(id),image=images.get(sprite.url);if(!image?.naturalWidth)return;const toned=role==='original'?null:tones.get(image,sprite,role);ctx.imageSmoothingEnabled=false;ctx.drawImage(toned||image,toned?0:sprite.x,toned?0:sprite.y,32,32,x,y,size,size);}
function scene(){
  if(!ready||!valid())return;const c=$('scene').getContext('2d'),tile=40;c.clearRect(0,0,320,260);c.fillStyle='#142020';c.fillRect(0,0,320,260);c.save();c.translate(0,20);
  const grid=Array.from({length:6},(_,y)=>Array.from({length:8},(_,x)=>x>0&&x<7&&y>0&&y<5?1:0));
  const g={grid,seed:321,floor:1,rooms:[{x:1,y:1,w:6,h:4,wallStyle:{face:$('face').value,cap:$('cap').value}}]};
  for(let y=0;y<6;y++)for(let x=0;x<8;x++)if(grid[y][x]===1)drawMaterial(c,$('floor').value,'floor',x*tile,y*tile,tile);
  for(let y=0;y<6;y++)for(let x=0;x<8;x++)if(!grid[y][x])drawWall(c,g,x,y,tile,{x:x*tile+20,y:y*tile+20},images,'industrial',tones,draft);
  const prop=images.get(TERRAIN_ATLAS);if(prop?.naturalWidth){const cell={x:0,y:32,size:32};c.drawImage(tones.get(prop,cell,'prop'),48,50,32,32);}
  const units=images.get('units');if(units?.naturalWidth)for(const [index,x,y]of [[0,124,126],[1,204,86]]){c.save();c.shadowColor='rgba(0,0,0,.9)';c.shadowBlur=8;c.drawImage(tones.get(units,{x:index*32,y:0,size:32},'unit'),x,y,32,32);c.restore();}
  c.restore();
}
function update(){
  const ok=valid();$('download').disabled=!ok;
  for(const role of roles){const select=$(role),old=select.value;select.replaceChildren(...draft[role].map(id=>new Option(id+' '+MATERIALS[id].name,id)));if(draft[role].includes(old))select.value=old;}
  document.querySelectorAll('[data-material]').forEach(card=>{const id=card.dataset.material;for(const role of roles)card.querySelector('[data-role='+role+']').checked=draft[role].includes(id);if(ready)drawMaterial(card.querySelector('canvas').getContext('2d'),id,$('tone').value,0,0,32);});
  if(ok){status(roles.map(role=>labels[role]+' '+draft[role].length+' 張').join(' · ')+(dirty?' · 有未下載的變更':''));scene();}
}
for(const [id,m]of Object.entries(MATERIALS)){
  const card=document.createElement('section');card.className='card';card.dataset.material=id;
  const heading=document.createElement('strong');heading.textContent=id+' '+m.name;card.append(heading);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;card.append(canvas);
  for(const role of roles){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.role=role;input.addEventListener('change',()=>{draft[role]=input.checked?[...draft[role],id]:draft[role].filter(v=>v!==id);dirty=true;update();});label.append(input,document.createTextNode(labels[role]));card.append(label);}
  $('catalog').append(card);
}
for(const id of [...roles,'tone'])$(id).addEventListener('change',id==='tone'?update:scene);
$('download').addEventListener('click',()=>{if(!valid())return;const blob=new Blob([JSON.stringify(validateSelection(draft),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;update();});
$('load').addEventListener('click',()=>$('import').click());
$('import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16384)throw Error('設定檔過大。');draft=validateSelection(JSON.parse(await file.text()));dirty=true;update();}catch(error){status('匯入失敗：'+error.message);}finally{e.target.value='';}});
$('reset').addEventListener('click',()=>{draft=structuredClone(MATERIAL_SELECTION);dirty=false;update();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
update();
await Promise.all([...new Set(Object.values(MATERIALS).map(m=>m.url)),'units'].map(key=>new Promise(resolve=>{const image=new Image();images.set(key,image);image.onload=resolve;image.onerror=resolve;image.src=key==='units'?new URL('../assets/pixel/atlas.png',import.meta.url).href:key;})));
ready=true;update();if([...images.values()].some(i=>!i.naturalWidth))status('部分圖片載入失敗，請重新整理；選用設定仍可下載。');
