// Detection alerts (3.207.0, user 2026-09-29: build it generically, the rift will use it later; docs/BOSSES.md section 5).
// Something hidden from your side comes near, and the officer on duty warns you — her sensors read it, the feed shows
// nothing. A module that hides something registers a detector here; the comms events (src/comms-events.js) ask every
// detector after each action and raise its event (a line group of src/comms.js) when a contact is within its range,
// at most once per `cooldown` rounds for that event. Presentation only: rules, saves and replays never see it.
// A leaf, like src/enemy-specials.js: it imports nothing.
const DETECTORS=new Map();
// kind: an id; event: the comms event it raises; range: steps from you; cooldown: rounds before that event again;
// contacts(g): what is hidden now, each with its x and y.
export function registerDetector({kind,event,range,cooldown,contacts}){
 if(DETECTORS.has(kind))throw new Error(`detector ${kind}: registered twice`);
 DETECTORS.set(kind,Object.freeze({kind,event,range,cooldown,contacts}));
}
export const detectors=()=>[...DETECTORS.values()];
// The hidden contacts near the player for one detector.
export const nearContacts=(g,d)=>(g?.player?.hp>0?d.contacts(g):[]).filter(c=>Math.abs(c.x-g.player.x)+Math.abs(c.y-g.player.y)<=d.range);
