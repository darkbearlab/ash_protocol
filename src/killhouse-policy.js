// Pending product decisions live here; no campaign defaults are changed.
export const KILLHOUSE_OPTIONS={tutorialDeath:'restart',scoreScope:'shared',armory:'all',tutorialUpgrades:false,tutorialDrops:false};
export const isSimulation=g=>g?.simulation?.kind==='killhouse';
export const simulationUpgrades=g=>!isSimulation(g)||(g.simulation.mode==='tutorial'&&g.simulation.options.tutorialUpgrades);
export const simulationDrops=g=>!isSimulation(g)||(g.simulation.mode==='tutorial'&&g.simulation.options.tutorialDrops);
export function simulationConfig(mode,options={}){
 if(!['tutorial','arcade'].includes(mode))throw Error('Unknown Kill house mode');
 const o={...KILLHOUSE_OPTIONS,...options};
 if(!['restart','menu'].includes(o.tutorialDeath)||!['shared','character'].includes(o.scoreScope)||!['all','class'].includes(o.armory)||typeof o.tutorialUpgrades!=='boolean'||typeof o.tutorialDrops!=='boolean')throw Error('Invalid Kill house options');
 return {kind:'killhouse',mode,phase:mode==='tutorial'?'tutorial':'armory',options:o,entered:[],roomEvents:[],battleStartTurn:null};
}
