// English enemy voice lines (3.167.0, docs/TEXT_INVENTORY.md): one line per cue for now (user decision 2026-09-23);
// the Chinese table (src/voices-zh-tw.js) keeps its variants. Same voices, same cues.
const HUMAN={
 lurk:['Quiet… right here.'],
 grenade:['Grenade!'],bombard:['Coordinates marked!'],aim:['Got you in my sights.'],attack:['Move in!'],
 affix_fast:['Keep up!'],affix_infrared:['Heat signature…'],affix_night_vision:['Dark won\'t hide you.'],affix_suppressor:['Keep their heads down!'],affix_grenadier:['Got explosives.'],
 move:['Push forward!'],cover:['Take cover!'],hold:['Hold position!'],reload:['Reloading!'],flank:['Flank them!'],
 hit:['I\'m hit!'],wounded:['That hurt…'],critical:['Need backup!'],suppressed:['Too much fire!'],pinned:['Pinned down!'],
 spotted:['Contact!'],lost:['Lost them.'],search:['Search the area.'],
};
const MACHINE={
 lurk:['[STANDBY]'],
 grenade:['[THROW ROUTINE]'],bombard:['[BOMBARD LOCK]'],aim:['[TARGET LOCK]'],attack:['[ATTACK ROUTINE]'],
 affix_fast:['[BOOST MODULE]'],affix_infrared:['[IR MODULE]'],affix_night_vision:['[NV MODULE]'],affix_suppressor:['[AUTOFIRE MODULE]'],affix_grenadier:['[THROW MODULE]'],
 move:['[MOVE]'],cover:['[EVADE]'],hold:['[HOLD]'],reload:['[RELOAD]'],flank:['[FLANK PATH]'],
 hit:['[DAMAGED]'],wounded:['[DAMAGE SPREADING]'],critical:['[SYSTEM CRITICAL]'],suppressed:['[SIGNAL JAMMED]'],pinned:['[MOVEMENT BLOCKED]'],
 spotted:['[TARGET CONFIRMED]'],lost:['[TARGET LOST]'],search:['[SCANNING]'],
};
// Creatures only make noises, so their lines follow the category rather than the exact cue.
const CREATURE={danger:['Hsss—!'],affix:['Hsss—!'],tactical:['Hss…'],injury:['Gah—!'],perception:['Hss?']};
const LOYALIST={
 lurk:['Silence. Hold.'],
 grenade:['Frag out, get down!'],bombard:['Requesting fire support!'],aim:['Target locked, standing by.'],attack:['Contact, open fire!'],
 affix_fast:['Fast team, advance!'],affix_infrared:['Thermal scan up.'],affix_night_vision:['NV on, keep searching.'],affix_suppressor:['Suppressing, cover the advance!'],affix_grenadier:['Grenadier in position.'],
 move:['First squad, advance!'],cover:['Find cover, report in!'],hold:['Hold the line!'],reload:['Reloading, cover me!'],flank:['Flank them, go!'],
 hit:['Hit, still in the fight!'],wounded:['Wounded, need support!'],critical:['Man down! Need evac!'],suppressed:['We\'re suppressed!'],pinned:['Pinned, can\'t move!'],
 spotted:['Enemy sighted, reporting!'],lost:['Lost visual.'],search:['Sweep by sector.'],
};
const REBEL={
 lurk:['Shh… not a word.'],
 grenade:['Eat this grenade!'],bombard:['Blow them to pieces!'],aim:['Hold still, target practice…'],attack:['Charge! Kill him!'],
 affix_fast:['Keep up or die!'],affix_infrared:['Smoke won\'t save you!'],affix_night_vision:['I see fine in the dark!'],affix_suppressor:['Light them up!'],affix_grenadier:['Taste this!'],
 move:['Push, you cowards!'],cover:['Get behind something, idiot!'],hold:['I\'m not moving!'],reload:['Reloading, back off!'],flank:['Go round and stab him in the back!'],
 hit:['Damn, I\'m hit!'],wounded:['Not done yet…'],critical:['Help me… anyone!'],suppressed:['That fire\'s insane!'],pinned:['Can\'t move, damn it!'],
 spotted:['There! Kill him!'],lost:['Where\'d he go?!'],search:['Turn this place over!'],
 flee:['I\'m done with this!'],rally:['All right, don\'t shoot!'],
};
const CONSCRIPT={
 lurk:['I-I\'ll wait here…'],
 grenade:['S-sorry, get down!'],bombard:['It\'s gonna blow, run!'],aim:['Please don\'t move…'],attack:['I\'m sorry!'],
 affix_fast:['I just want out of here!'],affix_infrared:['I can see you… please stay back.'],affix_night_vision:['They made me wear these…'],affix_suppressor:['My hands won\'t stop!'],affix_grenadier:['This thing explodes…'],
 move:['I\'m going, I\'m going…'],cover:['Let me hide…'],hold:['I\'m not moving…'],reload:['Where are the bullets…'],flank:['Why is it always me…'],
 hit:['Ah! I\'m hit!'],wounded:['Am I dying…'],critical:['I don\'t want to die…'],suppressed:['Stop shooting!'],pinned:['Don\'t shoot, I give up…'],
 spotted:['S-someone\'s there!'],lost:['He\'s gone… good…'],search:['Do we have to look…'],
 flee:['Let me go!'],rally:['Don\'t kill me, I\'m going back!'],
};
const ENFORCER={
 alarm:['Enemy here! Anyone who runs gets shot!'],execute:['Deserters die. Watch closely!'],
 aim:['Aimed.'],attack:['Fall.'],hold:['Hold.'],cover:['Cover.'],move:['Follow.'],reload:['Reloading.'],flank:['Flank.'],
 hit:['A scratch.'],wounded:['Still standing.'],critical:['Hold… the line…'],suppressed:['You can\'t pin me.'],pinned:['…Damn.'],
 spotted:['There.'],lost:['Lost it. Hold.'],search:['Search. Every tile.'],
};
const CIVILIAN={
 scream:['Guards! Intruders!'],
 flee:['Don\'t hurt us! We\'re only researchers!','The war\'s over, leave us alone!'],
 hit:['Ah! Don\'t shoot!'],wounded:['Please… we\'re unarmed…'],critical:['I just… wanted to go home…'],
 suppressed:['I\'m down, stop!'],pinned:['Please, let me go…'],
};
const INFECTED={
 lurk:['…wait… wait…'],
 grenade:['…throw… throw it…'],bombard:['…coordinates… coordinates…'],aim:['…see… I see…'],attack:['Kill… kill…!'],
 affix_fast:['Fast… so fast…'],affix_infrared:['…hot… so hot…'],affix_night_vision:['…dark… still see…'],affix_suppressor:['Shoot… keep shooting…!'],affix_grenadier:['…explosives… give…'],
 move:['…forward… forward…'],cover:['…hide… must hide…'],hold:['…stay… stay…'],reload:['…bullets… where…'],flank:['…around… go around…'],
 hit:['Aaah…!'],wounded:['…inside… it moves…'],critical:['…let them… out…'],suppressed:['…loud… so loud…'],pinned:['…can\'t… move…'],
 spotted:['…living… a living one…'],lost:['…gone…'],search:['…smell… I smell it…'],
};
export const VOICES={human:HUMAN,machine:MACHINE,loyalist:LOYALIST,rebel:REBEL,civilian:CIVILIAN,infected:INFECTED,conscript:CONSCRIPT,enforcer:ENFORCER};
export {CREATURE};
