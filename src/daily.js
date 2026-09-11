// Daily operation (3.44, user requirement): the local date is hashed together with a fixed phrase, so tomorrow's
// seed is no longer simply tomorrow's YYYYMMDD. The phrase ships in the client, so this only raises the bar;
// truly hiding the next day would need a server.
const DAILY_PHRASE='ASH PROTOCOL // 灰燼協定 // DAILY OPERATION';
export const scatter=n=>{let x=n>>>0;x=Math.imul(x^(x>>>16),2246822519);x=Math.imul(x^(x>>>13),3266489917);return (x^(x>>>16))>>>0;};
export const dateKey=(d=new Date())=>d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
// FNV-1a over the date and phrase, then scattered; always a valid map seed (0–999999999).
export function dailySeed(d=new Date()){
  let h=2166136261;
  for(const c of `${dateKey(d)}|${DAILY_PHRASE}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}
  return scatter(h)%1000000000;
}
export const dailyMission=(seed,ids)=>ids[scatter(seed)%ids.length];
