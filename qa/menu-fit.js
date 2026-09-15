// Menu fit check for phones (3.97.0, user request). Run it in the dev page (?test=1) during a run, at the phone
// viewport (375x635 matches iPhone Safari with toolbars):
//   const {checkMenus}=await import('/qa/menu-fit.js');const r=await checkMenus();console.table(r.rows);r.ok
// It opens the backpack tabs, settings, mission, map, combat log and journal, and reports how far each menu body
// overflows and whether its pinned footer is fully on screen. ok is false when any footer is missing or off screen, or
// when a backpack tab overflows at all (user rule: the backpack fits one screen with a typical loadout).
// The deploy pages and the result screen need other game states; measure them by hand with measureMenu().
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const dialog=()=>document.querySelector('#modal');
const click=selector=>{const el=document.querySelector(selector);el?.click();return Boolean(el);};
async function closeMenu(){const d=dialog();if(d?.open)d.close();await sleep(120);}

export function measureMenu(label){
  const d=dialog();if(!d?.open)return {label,open:false,overflowPx:null,footer:false,footerOnScreen:false};
  const box=d.getBoundingClientRect(),footer=d.querySelector('.modal-footer'),f=footer?.getBoundingClientRect();
  return {label,open:true,overflowPx:Math.max(0,d.scrollHeight-d.clientHeight),footer:Boolean(footer),
    footerOnScreen:Boolean(f&&f.top>=box.top-1&&f.bottom<=Math.min(box.bottom,innerHeight)+1)};
}

export async function checkMenus({wait=250}={}){
  const rows=[];await closeMenu();
  if(click('[data-action="bag"]')){
    await sleep(wait);
    for(const tab of ['weapon','grenade','item','skill']){click(`[data-inventory-tab="${tab}"]`);await sleep(wait);rows.push({...measureMenu(`backpack:${tab}`),mustFit:true});}
    await closeMenu();
  }
  for(const action of ['settings','mission','map']){if(click(`[data-action="${action}"]`)){await sleep(wait);rows.push(measureMenu(action));await closeMenu();}}
  for(const entry of ['log','journal']){
    if(!click('[data-action="settings"]'))continue;await sleep(wait);
    if(click(`#modal [data-modal="${entry}"]`)){await sleep(wait);rows.push(measureMenu(entry));}
    await closeMenu();
  }
  const ok=rows.length>0&&rows.every(r=>r.open&&r.footer&&r.footerOnScreen&&(!r.mustFit||r.overflowPx===0));
  return {viewport:`${innerWidth}x${innerHeight}`,ok,rows};
}
