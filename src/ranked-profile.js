// Ranked daily identity (3.224.0, docs/LEADERBOARD.md): the player's random key, made the first time they join, and
// their three-character arcade name. The leaderboard server keeps only the key's hash, so the key is the player; it
// lives in the profile, and a backup carries it to another browser.
export const validRankedKey=key=>typeof key==='string'&&/^[A-Za-z0-9_-]{22,128}$/.test(key);
export const validRankedName=name=>typeof name==='string'&&/^[A-Z0-9]{3}$/.test(name);
// What the name field keeps of what was typed: letters and digits, upper case, three at most.
export const rankedName=text=>String(text??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
export const validRankedProfile=r=>Boolean(r)&&typeof r==='object'&&!Array.isArray(r)&&validRankedKey(r.key)&&validRankedName(r.name);
export function newRankedKey(){
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(24));
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
