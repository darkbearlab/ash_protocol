// Text inventory for the translation work (2026-09-23, docs/TEXT_INVENTORY.md). Reads the source as text and reports
// where the player-facing Chinese lives, by file and by kind, plus the spots that need rewriting before any language
// table can hold them. Read-only; run with `node tools/text-inventory.mjs [--json out.json]`.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const CJK=/[一-鿿　-〿＀-￯]/g;
const count=text=>(text.match(CJK)||[]).length;

// Every string literal (quotes and template literals, interpolations blanked to {}), comments skipped.
export function literals(src){
 const out=[];let i=0;const n=src.length;
 while(i<n){
  const c=src[i];
  if(c==='/'&&src[i+1]==='/'){const j=src.indexOf('\n',i);i=j<0?n:j;continue;}
  if(c==='/'&&src[i+1]==='*'){const j=src.indexOf('*/',i);i=j<0?n:j+2;continue;}
  if(c==='"'||c==="'"||c==='`'){
   let j=i+1,buf='';
   while(j<n&&src[j]!==c){
    if(src[j]==='\\'){buf+=src.slice(j,j+2);j+=2;continue;}
    if(c==='`'&&src[j]==='$'&&src[j+1]==='{'){let d=1,k=j+2;while(k<n&&d){if(src[k]==='{')d++;else if(src[k]==='}')d--;k++;}buf+='{}';j=k;continue;}
    buf+=src[j++];
   }
   out.push({at:i,text:buf,template:c==='`'});i=j+1;continue;
  }
  i++;
 }
 return out;
}

// What a file's text is, for the plan. Anything not listed is ordinary rules or interface text.
const SHELVED=new Set(['pet-growth.js','pet-ui.js']);
const KIND={
 'controller.js':'介面（HTML 樣板：選單、背包、終端、結算、設定、操作指南）',
 'callout-ui.js':'敵人台詞','story-data.js':'故事碎片（由 content/stories 產生）',
 'killhouse-ui.js':'擊殺屋教學','material-review.js':'開發工具頁',
 'data.js':'資料：武器、敵人、升級、補給名稱與說明','traits.js':'資料：被動特性','skills.js':'資料：主動技能','prepared.js':'資料：道具與投擲物',
 'characters.js':'資料：職業','weapons.js':'資料：武器詞條','enemy-affixes.js':'資料：敵人詞條','missions.js':'資料：任務',
};
const kindOf=f=>SHELVED.has(f)?'德魯伊／死靈法師（下架）':KIND[f]||'規則與介面文字';

export function inventory(){
 const files=readdirSync(resolve(root,'src')).filter(f=>f.endsWith('.js')).sort();
 const rows=[],concat=[],units=[],spoken=[],migration=[];let total=0;
 const shelvedWords=/德魯伊|死靈|獵獸|寵物|召喚物|集結|伴生|飽食|飢餓|共生|群葬|速葬|亡者/;
 let shelvedElsewhere=0;
 for(const f of files){
  const src=readFileSync(resolve(root,'src',f),'utf8'),lits=literals(src).filter(l=>count(l.text));
  const chars=lits.reduce((s,l)=>s+count(l.text),0);if(!chars)continue;total+=chars;
  rows.push({file:f,chars,strings:new Set(lits.map(l=>l.text.trim())).size,kind:kindOf(f)});
  for(const l of lits){
   // Chinese glued to an interpolation: the word order is Chinese, so English needs a whole-sentence template.
   if(l.template&&/[一-鿿]\{\}|\{\}[一-鿿]/.test(l.text))concat.push({file:f,text:l.text.slice(0,70)});
   // A number followed by a counter word: English needs a singular and a plural.
   if(l.template&&/\{\}\s?(回合|格|發|層|次|個|名|點|顆|把|條|秒|階|台|隻|項|份)/.test(l.text))units.push({file:f,text:l.text.slice(0,70)});
   if(/存檔已升級|舊存檔/.test(l.text))migration.push({file:f,chars:count(l.text)});
   if(!SHELVED.has(f)&&shelvedWords.test(l.text)&&l.text.length<400)shelvedElsewhere+=count(l.text);
  }
  // Refusals spoken in the operator's bubble since 3.163.0: the text is never shown.
  for(const m of src.matchAll(/fail\((['`])(.+?)\1,\s*'[a-z_]+'/g))spoken.push({file:f,chars:count(m[2]),text:m[2]});
 }
 rows.sort((a,b)=>b.chars-a.chars);
 return {total,rows,concat,units,spoken,migration,shelvedElsewhere};
}

// The manual (showHelp in controller.js), section by section: <b>title</b><span>body</span>.
export function manualSections(){
 const src=readFileSync(resolve(root,'src/controller.js'),'utf8'),a=src.indexOf('function showHelp('),b=src.indexOf('\nfunction ',a+10),body=src.slice(a,b);
 const out=[],intro=body.slice(body.indexOf('<h2>'),body.indexOf('<div class="help-grid">'));
 out.push({title:'（開頭說明）',chars:count(intro)});
 for(const m of body.matchAll(/<b>([^<]{1,20})<\/b><span>([\s\S]*?)<\/span>(?=<b>|<\/div>)/g))out.push({title:m[1],chars:count(m[2])});
 return out;
}

// Enemy voice lines: how many cues and lines each voice has, and what one line per cue would leave.
export async function voiceLines(){
 const {VOICE_LINES}=await import('../src/callout-ui.js');
 return Object.entries(VOICE_LINES).map(([voice,table])=>{
  const cues=Object.keys(table),lines=cues.flatMap(c=>table[c]);
  return {voice,cues:cues.length,lines:lines.length,chars:lines.reduce((s,l)=>s+count(l),0),oneEach:cues.reduce((s,c)=>s+count(table[c][0]||''),0)};
 });
}

// The settings page (settings() in controller.js): button labels and explanation paragraphs.
export function settingsText(){
 const src=readFileSync(resolve(root,'src/controller.js'),'utf8'),a=src.indexOf('function settings('),b=src.indexOf('\nfunction ',a+10),body=src.slice(a,b);
 const paragraphs=[...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(m=>count(m[1])),buttons=[...body.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m=>count(m[1]));
 return {paragraphs:paragraphs.length,paragraphChars:paragraphs.reduce((s,n)=>s+n,0),buttons:buttons.length,buttonChars:buttons.reduce((s,n)=>s+n,0),total:count(body)};
}

// Names the game gives things: the glossary to settle before translating.
export async function glossary(){
 const data=await import('../src/data.js'),{TRAITS}=await import('../src/traits.js'),{SKILLS}=await import('../src/skills.js');
 const {CHARACTERS}=await import('../src/characters.js'),{PREPARED_CATALOG}=await import('../src/prepared.js'),{GRENADES}=await import('../src/throwables.js');
 const names=(list,get)=>[...new Set(list.map(get).filter(Boolean))];
 return {
  職業:names(Object.values(CHARACTERS),c=>c.label),
  武器:names(data.WEAPONS,w=>w.name),
  敵人:names(Object.values(data.ENEMY_TYPES),e=>e.name),
  被動特性:names(Object.values(TRAITS),t=>t.name),
  主動技能:names(Object.values(SKILLS),s=>s.name),
  升級:names(data.PERKS,p=>p.name),
  道具:names(Object.values(PREPARED_CATALOG.item),i=>i.name),
  投擲物:names(Object.values(GRENADES),g=>g.name),
  補給:names(Object.values(data.SUPPLY_NAMES),n=>n),
 };
}

if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){
 const inv=inventory(),report={inventory:inv,manual:manualSections(),voices:await voiceLines(),settings:settingsText(),glossary:await glossary()};
 const at=process.argv.indexOf('--json');if(at>0)writeFileSync(process.argv[at+1],JSON.stringify(report,null,1));
 console.log('total',inv.total,'files',inv.rows.length,'concat',inv.concat.length,'units',inv.units.length,'spoken',inv.spoken.reduce((s,x)=>s+x.chars,0),'migration',inv.migration.reduce((s,x)=>s+x.chars,0),'shelvedElsewhere',inv.shelvedElsewhere);
 console.log('manual',report.manual.map(s=>`${s.title}:${s.chars}`).join(' '));
 console.log('voices',report.voices.map(v=>`${v.voice}:${v.cues}/${v.lines}/${v.chars}/${v.oneEach}`).join(' '));
 console.log('settings',JSON.stringify(report.settings));
 console.log('glossary',Object.entries(report.glossary).map(([k,v])=>`${k}:${v.length}`).join(' '));
}
