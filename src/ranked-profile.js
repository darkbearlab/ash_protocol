// Ranked daily identity (3.224.0, docs/LEADERBOARD.md): the player's random key, made the first time they open ranked
// daily, and the three-character arcade callsign of their last report (3.225.0: typed when a report is submitted, so a
// key without a name is a whole identity). The leaderboard server keeps only the key's hash, so the key is the player;
// it lives in the profile, and a backup carries it to another browser.
export const validRankedKey=key=>typeof key==='string'&&/^[A-Za-z0-9_-]{22,128}$/.test(key);
export const validRankedName=name=>typeof name==='string'&&/^[A-Z0-9]{3}$/.test(name);
// What the name field keeps of what was typed: letters and digits, upper case, three at most.
export const rankedName=text=>String(text??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
export const validRankedProfile=r=>Boolean(r)&&typeof r==='object'&&!Array.isArray(r)&&validRankedKey(r.key)&&(r.name===undefined||validRankedName(r.name));
// What the profile keeps: the key, and the callsign when it is a valid one (a damaged callsign is asked for again).
export const rankedIdentity=r=>r&&typeof r==='object'&&validRankedKey(r.key)?{key:r.key,...(validRankedName(r.name)?{name:r.name}:{})}:undefined;
export function newRankedKey(){
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(24));
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
