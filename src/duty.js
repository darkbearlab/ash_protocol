// Comms duty rota (3.169.0, user decision 2026-09-24; docs/STORY.md 8): who speaks to the operative on a mission.
// The device's local date picks the day's officer by the last digit of its hash: 0-5 Egret, 6-8 Wren, 9 the overseer.
// The overseer only takes the day's first mission, so he stays rare; later missions that day go to Egret. Deploying
// counts as a mission, abandoned or not. The officer is fixed when the mission starts and saved with the run.
export const DUTY_SPEAKERS=Object.freeze(['egret','wren','overseer']);
export const DEFAULT_DUTY='egret';
export const validDuty=id=>DUTY_SPEAKERS.includes(id);

const pad=n=>String(n).padStart(2,'0');
export const localDateKey=(date=new Date())=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
// FNV-1a over the date key, then its last decimal digit.
export function dateDigit(key){
 let hash=2166136261;
 for(const c of String(key))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return (hash>>>0)%10;
}
export function dutyFor(key,missionsToday=0){
 const digit=dateDigit(key);
 if(digit<=5)return 'egret';
 if(digit<=8)return 'wren';
 return missionsToday===0?'overseer':'egret';
}

// The profile keeps the day and how many missions were deployed on it ({date:'YYYY-MM-DD', count}).
export const validDutyRecord=r=>Boolean(r)&&typeof r==='object'&&!Array.isArray(r)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isSafeInteger(r.count)&&r.count>=0;
// Who is on duty for a mission deployed now, and the record to keep afterwards.
export function nextDuty(record,now=new Date()){
 const key=localDateKey(now),count=validDutyRecord(record)&&record.date===key?record.count:0;
 return {duty:dutyFor(key,count),record:{date:key,count:count+1}};
}
