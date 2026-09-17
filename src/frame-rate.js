// Display frame rate (3.119.0, user request): phones ran hot because the battlefield canvas redrew at the screen's full
// rate even when nothing moved. The player picks how often it redraws, one rate for the whole game (menus are page
// elements and are not redrawn every frame). Every animation is timed by the clock, not by counting frames, so a lower
// rate only looks less smooth; nothing plays slower. A local display preference: never saved with a run.
// 15 is for old phones (user request): short flashes such as a submachine gun's muzzle flash can fall between frames.
export const FRAME_RATES=Object.freeze([15,30,60]);
export const FRAME_RATE_DEFAULT=60;
export const frameRate=value=>{
  if(value===null||value===undefined||value==='')return FRAME_RATE_DEFAULT;
  const n=Number(value);return FRAME_RATES.includes(n)?n:FRAME_RATE_DEFAULT;
};
// The button steps down, 60 → 30 → 15, and back to 60.
export const nextFrameRate=rate=>FRAME_RATES[(FRAME_RATES.indexOf(frameRate(rate))+FRAME_RATES.length-1)%FRAME_RATES.length];
// requestAnimationFrame ticks at the screen's refresh rate, a little early or late each time. Frames are due on a fixed
// schedule (`due`), and each is drawn on the tick closest to its time: now, unless waiting one more tick (`tick`, the last
// gap between ticks) would land nearer. Keeping the schedule rather than restarting it at each draw holds the average
// at the chosen rate on any screen (60 on 90 Hz or 144 Hz too), and timing jitter never drops a frame.
export const frameDue=(now,due,tick=0)=>now+tick/2>=due;
// The next frame's time after drawing one. A page that fell far behind (a long stall) restarts the schedule from now
// instead of drawing every tick to catch up.
export const nextDue=(due,now,rate)=>{const interval=1000/rate,next=due+interval;return next<now-interval?now+interval:next;};
