// Cosmetic choices never consume the map/combat RNG. IDs are persisted with the run.
export const PORTRAITS=Object.freeze(['ember','onyx','silver','cedar']);
export const validPortrait=id=>typeof id==='string'&&PORTRAITS.includes(id);
export function portraitForLegacy(key){let hash=2166136261;for(const c of String(key))hash=Math.imul(hash^c.charCodeAt(0),16777619);return PORTRAITS[(hash>>>0)%PORTRAITS.length];}
export function pickPortrait(random=Math.random){return PORTRAITS[Math.min(PORTRAITS.length-1,Math.max(0,Math.floor(random()*PORTRAITS.length)))];}
export function deploymentPortraits(characters,random=Math.random){
  const pool=[...PORTRAITS],result={};
  for(const id of characters){if(!pool.length)pool.push(...PORTRAITS);result[id]=pool.splice(Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length))),1)[0];}
  return result;
}
export const portraitPath=id=>`./assets/pixel/portraits/${validPortrait(id)?id:PORTRAITS[0]}.png`;
export function portraitMarkup(id,outcome='playing'){
  const dead=outcome==='dead';
  return `<span class="operator-portrait${dead?' is-kia':''}"><img src="${portraitPath(id)}" width="64" height="64" alt="行動員頭像" draggable="false">${dead?'<b class="kia-stamp" aria-label="陣亡">KIA</b>':''}</span>`;
}
