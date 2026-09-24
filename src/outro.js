// The end of a run, in three parts (3.177.0, user design; docs/STORY.md 8). src/controller.js plays them:
// 1. on the field: the officer on duty approves the extraction on the header bar (a death has the killed-in-action
//    scene here instead, src/kia.js), then the screen darkens;
// 2. in the middle of the dark screen she speaks: the extraction line, or the loss report. When the purge review finds
//    the unit deficient (status: executed), the overseer cuts in after her with a silence that cannot be tapped away;
// 3. the report (the result screen).
// A replay has no voices and an abandoned run nothing to say: both darken and go to the report. The kill house keeps
// its own results and never comes here.
import {commsLine,dutySpeaker} from './comms.js';
import {kiaSeconds} from './kia.js';
import {purgeReview} from './purge-review.js';
import {t} from './i18n.js';

export const OUTRO_TUNING=Object.freeze({
 darkMs:600,          // the field fades to dark between parts 1 and 2
 cutInMs:400,         // the empty beat after her line before the overseer cuts in
 overseerSeconds:2    // how long his silence holds
});

// Every line here stays as long as the killed-in-action lines (kiaSeconds) and can be tapped away.
const timed=message=>message&&{...message,seconds:kiaSeconds(t(message.line,message.vars))};

// What each part says: `field` is one message for the header bar or null; `channel` the messages for the middle of the
// dark screen, in order. `voiced` is false for a replay.
export function outroPlan(game,{voiced=true,random=Math.random}={}){
 if(!voiced)return {field:null,channel:[]};
 const speaker=dutySpeaker({game});
 const field=game.status==='won'?timed(commsLine(speaker,'extractApproved',{},{random})):null;
 const event={won:'extracted',dead:'lossReport'}[game.status];
 const channel=event?[timed(commsLine(speaker,event,{},{random}))].filter(Boolean):[];
 if(game.status==='won'&&speaker!=='overseer'&&purgeReview(game)?.tier==='deficient'){
  const silence=commsLine('overseer','executed',{},{random});
  if(silence)channel.push({...silence,seconds:OUTRO_TUNING.overseerSeconds,tap:false,cutIn:true});
 }
 return {field,channel};
}
