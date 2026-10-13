// Small Web Crypto helpers (the same API in Workers and in Node, so the tests run these as they are).
const enc=new TextEncoder();

export async function hmac(secret,message){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
export async function sha256(data){
 return new Uint8Array(await crypto.subtle.digest('SHA-256',typeof data==='string'?enc.encode(data):data));
}
export const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');

export function b64urlEncode(data){
 const bytes=typeof data==='string'?enc.encode(data):data;let s='';
 for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function b64Decode(text){
 const s=atob(text.replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(s.length);
 for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);
 return out;
}
export const randomId=(bytes=16)=>b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));

// Constant-time comparison of two strings of the same length.
export function sameText(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
 return d===0;
}

// gunzip with a ceiling on the inflated size.
export async function gunzipText(bytes,limit){
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const parts=[];let size=0;
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  size+=value.length;if(size>limit){await reader.cancel();throw new Error('too-large');}
  parts.push(value);
 }
 const all=new Uint8Array(size);let at=0;for(const p of parts){all.set(p,at);at+=p.length;}
 return new TextDecoder().decode(all);
}
