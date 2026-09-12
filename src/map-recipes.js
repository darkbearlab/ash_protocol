// Schema and selection are shared by the build compiler and the pure generator.
export const RECIPE_THEMES=['industrial','sanitary','security','utility','platform','dock','balcony'];
export function recipeGroups(recipe){
  const groups=new Map();recipe.layout.flat().forEach((label,id)=>{if(!groups.has(label))groups.set(label,[]);groups.get(label).push(id);});return [...groups];
}
export function validateRecipe(r){
  const fail=message=>{throw new Error(`Recipe ${r?.id??'?'}: ${message}`);};
  if(!r||typeof r!=='object'||!Object.keys(r).every(k=>['id','name','theme','floors','weight','layout','annex','openings','doorRatio'].includes(k)))fail('unknown field');
  if(typeof r.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(r.id))fail('invalid id');
  if(r.name!==undefined&&(typeof r.name!=='string'||r.name.length>80))fail('invalid name');
  if(r.theme!==undefined&&!RECIPE_THEMES.includes(r.theme))fail('unknown theme');
  if(r.floors!==undefined&&(!Array.isArray(r.floors)||r.floors.length!==2||!r.floors.every(n=>Number.isInteger(n)&&n>=1&&n<=999)||r.floors[0]>r.floors[1]))fail('invalid floors');
  if(r.weight!==undefined&&(!Number.isFinite(r.weight)||r.weight<=0||r.weight>100))fail('invalid weight');
  if(r.doorRatio!==undefined&&(!Number.isFinite(r.doorRatio)||r.doorRatio<0||r.doorRatio>1))fail('invalid doorRatio');
  if(!Array.isArray(r.layout)||r.layout.length!==3||!r.layout.every(row=>Array.isArray(row)&&row.length===3&&row.every(v=>typeof v==='string'&&/^[A-Z]$/.test(v))))fail('layout must be 3×3 letters');
  const groups=recipeGroups(r);let squares=0;
  for(const [,ids]of groups){
    const rows=ids.map(i=>Math.floor(i/3)),cols=ids.map(i=>i%3),h=Math.max(...rows)-Math.min(...rows)+1,w=Math.max(...cols)-Math.min(...cols)+1;
    if(ids.length!==h*w||![1,2,4].includes(ids.length)||ids.length===4&&(h!==2||w!==2||++squares>1))fail('rooms must be singles, adjacent pairs or one 2×2');
  }
  if(groups.length<5||groups.filter(([,ids])=>ids.length===1).length<2)fail('requires two single endpoints and three target rooms');
  if(r.annex!==undefined){
    if(!r.annex||Array.isArray(r.annex)||typeof r.annex!=='object'||Object.keys(r.annex).length>2)fail('at most two annexes');
    for(const [label,value]of Object.entries(r.annex)){
      const ids=groups.find(([l])=>l===label)?.[1],m=typeof value==='string'&&/^(platform|dock|balcony)-(north|east|south|west)$/.exec(value);
      if(!ids||!m||!ids.some(i=>({north:Math.floor(i/3)===0,south:Math.floor(i/3)===2,west:i%3===0,east:i%3===2})[m[2]]))fail('annex must face exterior');
    }
  }
  if(r.openings!==undefined){
    if(!r.openings||typeof r.openings!=='object'||Array.isArray(r.openings))fail('invalid openings');
    for(const [label,range]of Object.entries(r.openings)){
      if(!['default','large'].includes(label)){
        const pair=label.split('-'),a=groups.find(([l])=>l===pair[0])?.[1],b=groups.find(([l])=>l===pair[1])?.[1];
        if(pair.length!==2||pair[0]===pair[1]||!a||!b||!a.some(i=>b.some(j=>Math.abs(i%3-j%3)+Math.abs(Math.floor(i/3)-Math.floor(j/3))===1)))fail('opening labels must be adjacent rooms');
      }
      if(!Array.isArray(range)||range.length!==2||!range.every(n=>Number.isInteger(n)&&n>=1&&n<=3)||range[0]>range[1])fail('opening range must be 1–3');
    }
  }
  return r;
}
export function orderedRecipes(seed,floor,pool){
  const ids=new Set();for(const r of pool){validateRecipe(r);if(ids.has(r.id))throw new Error('Duplicate recipe id');ids.add(r.id);}
  // Weighted permutation independent of population/combat RNG; failed candidates
  // can fall through without redrawing any supplies from a different seed.
  return pool.filter(r=>floor>=(r.floors?.[0]??1)&&floor<=(r.floors?.[1]??999)).map(r=>{
    let n=(seed^Math.imul(floor,2654435761))>>>0;for(const c of r.id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
    n=Math.imul(n^(n>>>16),2246822519)>>>0;n=(n^(n>>>13))>>>0;
    return {r,rank:-Math.log((n+1)/4294967297)/(r.weight??1)};
  }).sort((a,b)=>a.rank-b.rank||a.r.id.localeCompare(b.r.id)).map(v=>v.r);
}
