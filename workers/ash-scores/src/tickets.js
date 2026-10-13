// Run tickets: one per attempt, signed by the server. A ticket names the player, the day and variant and when the run
// began, and is good for one submission (the tickets table marks it used).
import {b64urlEncode,b64Decode,hmac,sameText} from './crypto.js';

export const TICKET_VERSION=1;
const sign=async(secret,body)=>b64urlEncode(await hmac(secret,`ticket|${body}`));

export async function signTicket(secret,{id,player,day,variant,iat}){
 const body=b64urlEncode(JSON.stringify({v:TICKET_VERSION,id,player,day,variant,iat}));
 return `${body}.${await sign(secret,body)}`;
}
// The ticket's payload, or null when it is malformed or not ours.
export async function readTicket(secret,ticket){
 if(typeof ticket!=='string'||ticket.length>600)return null;
 const [body,sig,...rest]=ticket.split('.');if(!body||!sig||rest.length)return null;
 if(!sameText(sig,await sign(secret,body)))return null;
 try{
  const p=JSON.parse(new TextDecoder().decode(b64Decode(body)));
  return p&&p.v===TICKET_VERSION&&typeof p.id==='string'&&typeof p.player==='string'&&typeof p.day==='string'&&typeof p.variant==='string'&&Number.isSafeInteger(p.iat)?p:null;
 }catch{return null;}
}
