// Display tuning (3.116.0, user request): whole-screen brightness and how strongly the operator colour covers the grey
// class art. Both are local display preferences, like the boundary lines; neither touches a save or the rules.
export const SCREEN_BRIGHTNESS=Object.freeze({min:70,max:130,step:5,initial:100});
// OPERATOR_TINT: the operator colour strength. Not in the settings since 3.139.1 (the colour picker is being redesigned).
export const OPERATOR_TINT=Object.freeze({min:0,max:100,step:5,initial:100});
function stepped(value,{min,max,step,initial}){
  if(value===null||value===undefined||value===''||!['number','string'].includes(typeof value))return initial;
  const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n/step)*step)):initial;
}
export const screenBrightnessPercent=value=>stepped(value,SCREEN_BRIGHTNESS);
export const operatorTintPercent=value=>stepped(value,OPERATOR_TINT);
