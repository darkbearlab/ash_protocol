export const REAL_MODE_TUNING=Object.freeze({protocolPercent:10});
export const terminalRun=g=>['won','dead','abandoned'].includes(g.status);
export function lockRealMode(game,value){if(typeof value!=='boolean')throw new Error('Invalid real mode');Object.defineProperty(game,'realMode',{value,enumerable:true,writable:false,configurable:false});}
export function protocolSettlement(game){const base=game.protocol?.earned||0,bonus=game.realMode&&terminalRun(game)?Math.floor(base*REAL_MODE_TUNING.protocolPercent/100):0;return {realMode:game.realMode===true,base,bonus,total:base+bonus};}
