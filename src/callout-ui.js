// Callout bubbles (3.76.4, Claude): line table, throttling and placement for REAL_MODE callout events.
// The rules layer decides what is heard and hides identity; this only words and paces it. Line picks hash the
// event and a board counter, never the combat RNG.
import {ENEMY_TYPES} from './engine.js';

export const CALLOUT_UI_TUNING=Object.freeze({generalMs:2500,dangerMs:4000,heardFactor:.7,mergeMs:1500,maxOnScreen:4,fadeMs:400,edgeMargin:30});

const HUMAN={
 grenade:['手榴彈！','丟雷了！','投彈，找掩護！'],bombard:['標定座標！','轟炸就位！'],aim:['鎖定目標。','瞄準中……','別動……'],attack:['衝上去！','準備開火！','壓上去！'],
 affix_fast:['跟上速度！','動作快！'],affix_infrared:['熱源顯示……','紅外線啟動。'],affix_night_vision:['夜視開啟。','黑暗藏不住你。'],affix_suppressor:['火力壓制！','別讓他抬頭！'],affix_grenadier:['我帶了炸藥。','準備投擲。'],
 move:['推進！','往前壓。','移動！'],cover:['找掩護！','躲好！'],hold:['守住位置！','原地開火！'],reload:['換彈！','裝填中！'],flank:['繞過去！','從側面包抄！'],
 hit:['我中彈了！','被打中了！'],wounded:['傷得不輕……','還撐得住……'],critical:['需要支援！','撐不住了……'],suppressed:['火力太猛！','抬不起頭！'],pinned:['被壓住了！','動不了！'],
 spotted:['發現目標！','在那裡！'],lost:['跟丟了。','人呢？'],search:['搜索這一區。','他跑不遠。'],
};
const MACHINE={
 grenade:['〔投擲程序〕'],bombard:['〔轟炸座標鎖定〕'],aim:['〔鎖定〕'],attack:['〔攻擊程序〕'],
 affix_fast:['〔加速模組〕'],affix_infrared:['〔紅外線模組〕'],affix_night_vision:['〔夜視模組〕'],affix_suppressor:['〔連射模組〕'],affix_grenadier:['〔投擲模組〕'],
 move:['〔移動〕'],cover:['〔規避〕'],hold:['〔固守〕'],reload:['〔裝填〕'],flank:['〔側翼路徑〕'],
 hit:['〔受損〕'],wounded:['〔損傷擴大〕'],critical:['〔系統危急〕'],suppressed:['〔訊號干擾〕'],pinned:['〔行動受阻〕'],
 spotted:['〔目標確認〕'],lost:['〔目標遺失〕'],search:['〔掃描中〕'],
};
// Creatures only make noises, so their lines follow the category rather than the exact cue.
const CREATURE={danger:['嘶嘶——！','咯咯咯！'],affix:['嘶——！'],tactical:['嘶……','咯……'],injury:['嘎——！','嗚……'],perception:['嘶？','咯……']};
const CREATURES=new Set(['fodder','brood','crawler','bomber']);

// Heard callouts carry no unit type, so they always use the neutral human voice and never hint at what spoke.
export const calloutVoice=event=>event.visibility!=='visible'?'human':ENEMY_TYPES[event.enemyType]?.mechanical?'machine':CREATURES.has(event.enemyType)?'creature':'human';
const hash=text=>{let h=2166136261;for(const c of text){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export function calloutLine(event,variant=0){
 const voice=calloutVoice(event),lines=voice==='creature'?CREATURE[event.category]:(voice==='machine'?MACHINE:HUMAN)[event.cue];
 return lines?.length?lines[hash(`${event.actorId||event.direction||''}:${event.cue}:${variant}`)%lines.length]:'';
}

const RANK={high:3,medium:2,low:1};
// One bubble per unit (or per direction when only heard); repeats count up; the same quieter cue from another
// unit inside mergeMs is counted on the first bubble; a screen cap drops the quietest, oldest bubble.
export class CalloutBoard{
 constructor(tuning=CALLOUT_UI_TUNING){this.tuning=tuning;this.items=[];this.sequence=0;}
 clear(){this.items=[];}
 duration(event){const t=this.tuning,base=event.priority==='high'?t.dangerMs:t.generalMs;return Math.round(event.visibility==='visible'?base:base*t.heardFactor);}
 add(event,now){
  if(event?.type!=='callout'||!event.cue)return null;
  this.prune(now);
  const key=event.visibility==='visible'?`actor:${event.actorId}`:`dir:${event.direction}`,expires=now+this.duration(event);
  const same=this.items.find(i=>i.key===key);
  if(same&&same.event.cue===event.cue){same.count++;same.expires=Math.max(same.expires,expires);return same;}
  if(same&&RANK[same.event.priority]>RANK[event.priority])return null;
  if(event.priority!=='high'){
   const echo=this.items.find(i=>i.event.cue===event.cue&&i.event.visibility===event.visibility&&now-i.started<=this.tuning.mergeMs);
   if(echo){echo.count++;echo.expires=Math.max(echo.expires,expires);return echo;}
  }
  if(same)this.items.splice(this.items.indexOf(same),1);
  const item={key,event,text:calloutLine(event,this.sequence++),count:1,started:now,expires};
  this.items.push(item);
  while(this.items.length>this.tuning.maxOnScreen){const drop=[...this.items].sort((a,b)=>RANK[a.event.priority]-RANK[b.event.priority]||a.started-b.started)[0];this.items.splice(this.items.indexOf(drop),1);}
  return this.items.includes(item)?item:null;
 }
 prune(now){this.items=this.items.filter(i=>now<i.expires);}
 active(now){this.prune(now);return this.items;}
}

export const bubbleText=item=>item.count>1?`${item.text} ×${item.count}`:item.text;
export const bubbleAlpha=(item,now,tuning=CALLOUT_UI_TUNING)=>(item.event.visibility==='visible'?1:.6)*Math.max(0,Math.min(1,(item.expires-now)/tuning.fadeMs));

const VECTORS={east:[1,0],southeast:[1,1],south:[0,1],southwest:[-1,1],west:[-1,0],northwest:[-1,-1],north:[0,-1],northeast:[1,-1]};
export const DIRECTION_ARROWS=Object.freeze({east:'→',southeast:'↘',south:'↓',southwest:'↙',west:'←',northwest:'↖',north:'↑',northeast:'↗'});
// A heard callout only knows its direction, so it sits where that direction meets the screen edge.
export function edgePoint(direction,width,height,margin=CALLOUT_UI_TUNING.edgeMargin){
 const [dx,dy]=VECTORS[direction]||VECTORS.north,cx=width/2,cy=height/2;
 const scale=Math.min(dx?(cx-margin)/Math.abs(dx):Infinity,dy?(cy-margin)/Math.abs(dy):Infinity);
 return {x:cx+dx*scale,y:cy+dy*scale};
}
