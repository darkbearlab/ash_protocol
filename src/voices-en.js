// English enemy voice lines (3.167.0, docs/TEXT_INVENTORY.md). 3.177.7 (user request): the same variants as the Chinese
// table (src/voices-zh-tw.js), line for line in the same order, so both languages vary as much. Same voices, same cues.
const HUMAN={
 lurk:['Quiet…','Right here. Wait.'],
 grenade:['Grenade!','Frag out!','Throwing, take cover!'],bombard:['Coordinates marked!','Barrage ready!'],aim:['Got you in my sights.','Aiming…','Hold still…'],attack:['Move in!','Ready to fire!','Press them!'],
 affix_fast:['Keep up!','Move it!'],affix_infrared:['Heat signature…','Infrared on.'],affix_night_vision:['Night vision on.','Dark won\'t hide you.'],affix_suppressor:['Suppressing fire!','Keep his head down!'],affix_grenadier:['Got explosives.','Ready to throw.'],
 move:['Push forward!','Press on.','Moving!'],cover:['Take cover!','Stay down!'],hold:['Hold position!','Fire from here!'],reload:['Changing mags!','Reloading!'],flank:['Go around!','Flank them!'],
 hit:['I\'m hit!','Took one!'],wounded:['That\'s bad…','I can hold on…'],critical:['Need backup!','Can\'t hold…'],suppressed:['Too much fire!','Can\'t get my head up!'],pinned:['Pinned down!','Can\'t move!'],
 spotted:['Contact!','Over there!'],lost:['Lost them.','Where\'d they go?'],search:['Search the area.','He can\'t have gone far.'],
};
const MACHINE={
 lurk:['[STANDBY]','[WAITING]'],
 grenade:['[THROW ROUTINE]'],bombard:['[BOMBARD LOCK]'],aim:['[TARGET LOCK]'],attack:['[ATTACK ROUTINE]'],
 affix_fast:['[BOOST MODULE]'],affix_infrared:['[IR MODULE]'],affix_night_vision:['[NV MODULE]'],affix_suppressor:['[AUTOFIRE MODULE]'],affix_grenadier:['[THROW MODULE]'],
 move:['[MOVE]'],cover:['[EVADE]'],hold:['[HOLD]'],reload:['[RELOAD]'],flank:['[FLANK PATH]'],
 hit:['[DAMAGED]'],wounded:['[DAMAGE SPREADING]'],critical:['[SYSTEM CRITICAL]'],suppressed:['[SIGNAL JAMMED]'],pinned:['[MOVEMENT BLOCKED]'],
 spotted:['[TARGET CONFIRMED]'],lost:['[TARGET LOST]'],search:['[SCANNING]'],
};
// Creatures only make noises, so their lines follow the category rather than the exact cue.
const CREATURE={danger:['Hsss—!','Krrk-krrk!'],affix:['Hsss—!'],tactical:['Hss…','Krk…'],injury:['Gah—!','Hnnn…'],perception:['Hss?','Krk…']};
const LOYALIST={
 lurk:['Silence, all of you.','In position. Stay quiet.'],
 grenade:['Frag out, get down!','Grenade away, heads up!'],bombard:['Requesting fire support!','Coordinates sent, barrage incoming!'],aim:['Target locked, standing by.','Marksman in position.'],attack:['Contact, open fire!','Advance and engage!'],
 affix_fast:['Pick up the pace!','Mobile team, keep up!'],affix_infrared:['Thermal scan up.','Infrared confirms target.'],affix_night_vision:['Night vision ready.','Darkness is no problem, keep searching.'],affix_suppressor:['Suppressing, cover the advance!','Keep up the suppression!'],affix_grenadier:['Grenadier in position.','Grenade support ready.'],
 move:['Move up, cover each other!','Keep formation, forward!'],cover:['Find cover!','Get to cover, report in!'],hold:['Hold the line!','Stand fast, await orders!'],reload:['Reloading, cover me!','Changing mags!'],flank:['Flank them, go!','Swing around the side!'],
 hit:['Hit, still in the fight!','Hit, continuing the mission!'],wounded:['Wounded, need support!','Wounded, losing strength!'],critical:['Badly hurt! Need evac!','Can\'t hold, requesting extraction!'],suppressed:['We\'re suppressed!','Too much fire, can\'t look up!'],pinned:['Pinned, can\'t move!','Stuck here, need cover!'],
 spotted:['Enemy sighted, reporting!','Contact! Target confirmed!'],lost:['Lost visual.','Contact lost, reporting last position.'],search:['Sweep by sector, stay in contact.','Search forward, watch the corners.'],
};
const REBEL={
 lurk:['Shh… not a word.','We wait right here.'],
 grenade:['Eat this grenade!','Blow up, you bastard!'],bombard:['Blow them to pieces!','Bomb them!'],aim:['Hold still, target practice…','Lined up. Hope you like lead.'],attack:['Charge! Kill him!','Go! Go! Go!'],
 affix_fast:['Keep up or die!','Move it, stop dragging!'],affix_infrared:['Smoke won\'t save you!','I see you plain as day!'],affix_night_vision:['In the dark? I still see you!','Pitch black. Perfect.'],affix_suppressor:['Light them up!','Bullets are free, spray!'],affix_grenadier:['Taste this!','Hug this and die!'],
 move:['Push, you cowards!','Rush them!'],cover:['Get behind something, idiot!','Get down, don\'t be a hero!'],hold:['I\'m not moving!','Come get me if you dare!'],reload:['Reloading, back off!','Out of rounds, damn it!'],flank:['Go round and stab him in the back!','Hit him from the side, move!'],
 hit:['Damn, I\'m hit!','Bastard shot me!'],wounded:['Not done yet…','That hurts, you\'ll pay for this!'],critical:['Help me… anyone!','I don\'t wanna die here!'],suppressed:['That fire\'s insane!','Can\'t even lift my head!'],pinned:['Can\'t move, damn it!','I\'m stuck here!'],
 spotted:['There! Kill him!','Found you, scum!'],lost:['Where\'d he go?!','He slipped away, damn it!'],search:['Turn this place over!','Come out, quit hiding!'],
 flee:['I\'m done with this!','Cover me, I\'m pulling out!'],rally:['All right, don\'t shoot!','I\'m back, don\'t look at me!'],
};
const CONSCRIPT={
 lurk:['I-I\'ll wait here…','Please don\'t come this way…'],
 grenade:['I-I\'m throwing it!','S-sorry, get down!'],bombard:['It\'s gonna blow, run!','Don\'t blame me…'],aim:['I\'m aiming… please don\'t move…','Don\'t make me shoot…'],attack:['I\'m sorry!','I don\'t want this…'],
 affix_fast:['I just want out of here!','Don\'t chase me!'],affix_infrared:['I can see you in the smoke… please stay back.','I can see you…'],affix_night_vision:['They made me wear these…','I can see in the dark…'],affix_suppressor:['My hands won\'t stop!','The bullets keep coming out…'],affix_grenadier:['This thing explodes…','Please don\'t blow me up…'],
 move:['I\'m going, I\'m going…','Don\'t push me, I\'m moving…'],cover:['Let me hide…','Is it safe here?'],hold:['I\'m not moving…','I\'ll just stay here…'],reload:['Where are the bullets…','My hands shake, it won\'t go in!'],flank:['Go around? …Fine.','Why is it always me…'],
 hit:['Ah! I\'m hit!','It hurts…'],wounded:['Am I dying…','Somebody help me…'],critical:['I don\'t want to die…','They dragged me here…'],suppressed:['I can\'t look up!','Stop shooting!'],pinned:['I can\'t move…','Don\'t shoot, I give up…'],
 spotted:['S-someone\'s there!','He\'s there… oh god…'],lost:['He\'s gone… good…','Better if I don\'t see him…'],search:['Do we have to look…','Please don\'t let me find him…'],
 flee:['I quit!','Let me go!'],rally:['I\'m going! I\'m going!','Don\'t kill me, I\'m going back!'],
};
const ENFORCER={
 alarm:['Enemy here! Everyone in position!','Enemy spotted! Anyone who backs off gets shot!'],execute:['Desertion means death!','This is what deserters get. Watch closely!'],
 aim:['Aimed.','Don\'t move.'],attack:['Fall.','Fire.'],hold:['Hold.','Nobody falls back.'],cover:['Cover.','Stay low.'],move:['Follow.','Advance.'],reload:['Reloading.','Cover me, reloading.'],flank:['Flank.','Go around.'],
 hit:['A scratch.','…Keep firing.'],wounded:['Still standing.','Don\'t stop firing!'],critical:['Hold… the line…','Nobody… runs…'],suppressed:['You can\'t pin me.','Steady!'],pinned:['…Damn.','Don\'t stop, keep firing!'],
 spotted:['There.','Target confirmed.'],lost:['Lost it.','Target gone. Hold position.'],search:['Search.','Every tile. Search it.'],
};
const CIVILIAN={
 scream:['Guards! Guards! Intruders!','It\'s a numbered one… run!','Help! They\'ve broken in!'],
 flee:['Stay back! We\'re only researchers!','The war ended long ago, spare us!','I don\'t know where headquarters is, I don\'t know anything!','We\'re the only ones left here…','We only keep the facility running…','Please, don\'t hurt anyone!'],
 hit:['Ah! Don\'t shoot!','I surrender, I surrender!'],wounded:['Please… we\'re unarmed…','Stop, there are no soldiers here!'],critical:['I just… wanted to go home…','We were only waiting for orders…'],
 suppressed:['Stop, I\'m down!','Don\'t shoot, I\'m not moving!'],pinned:['I can\'t move… don\'t kill me!','Please, let me go…'],
};
const INFECTED={
 lurk:['…wait… wait…','…quiet…'],
 grenade:['…throw… throw it…','Blow… blow them apart…'],bombard:['…coordinates… coordinates…'],aim:['…see… I see…','Don\'t move… don\'t…'],attack:['Kill… kill…!','Fire… fire fire…!'],
 affix_fast:['Fast… so fast…'],affix_infrared:['…hot… so hot…'],affix_night_vision:['…dark… still see…'],affix_suppressor:['Shoot… keep shooting…!'],affix_grenadier:['…explosives… give…'],
 move:['…forward… forward…','Go… go…'],cover:['…hide… must hide…'],hold:['…stay… stay…'],reload:['…bullets… where…'],flank:['…around… go around…'],
 hit:['Aaah…!','Hurts… doesn\'t hurt…?'],wounded:['…inside… it moves…'],critical:['…let them… out…','Itches… it itches…'],suppressed:['…loud… so loud…'],pinned:['…can\'t… move…'],
 spotted:['…living… a living one…','There… there…'],lost:['…gone…'],search:['…smell… I smell it…'],
};
export const VOICES={human:HUMAN,machine:MACHINE,loyalist:LOYALIST,rebel:REBEL,civilian:CIVILIAN,infected:INFECTED,conscript:CONSCRIPT,enforcer:ENFORCER};
export {CREATURE};
