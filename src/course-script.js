// The training course (3.198.0; the user's script of 2026-09-27 from the script sheet, docs/KILLHOUSE.md section 14).
// The kill-house tutorial as six taught sections: the two controllers talk the player through them on the comms bar
// and full-screen cards page through the rules with pictures. It comes off as a unit: KILLHOUSE_OPTIONS.tutorialCourse
// false brings back the six-card tutorial (tutorialMap, TUTORIAL_PROMPTS), and only the course-*.js files read this.

// A beat is what one moment of the course sets off, played in order: a line on the comms bar, or a card, which opens
// once the line before it has closed. Every beat plays at most once a run (src/course.js decides when).
const say=(speaker,expression,line)=>Object.freeze({say:Object.freeze({speaker,expression,line})});
const card=id=>Object.freeze({card:id});
export const COURSE_BEATS=Object.freeze({
 // 1 movement and cover
 start:[say('egret','speaking','course.s1.hello'),say('wren','grin','course.s1.hello2'),say('egret','speaking','course.s1.enter'),card('move')],
 moved:[say('egret','speaking','course.s1.moved')],
 cover:[say('wren','speaking','course.s1.cover'),card('cover')],
 doorGo:[say('egret','gentle','course.s1.doorGo')],
 door:[say('egret','speaking','course.s1.door'),card('door')],
 box:[say('wren','speaking','course.s1.box'),card('box')],
 pickup:[say('egret','speaking','course.s1.pickup')],
 boxDone:[say('wren','speaking','course.s1.done')],
 // 2 attack
 s2Enter:[say('egret','speaking','course.s2.enter')],
 s2Lock:[say('wren','speaking','course.s2.stun'),say('egret','gentle','course.s2.card'),card('target')],
 s2Ready:[say('egret','speaking','course.s2.fire')],
 s2Windup:[say('wren','speaking','course.s2.windup'),card('windup')],
 s2Dodge:[say('egret','speaking','course.s2.dodge'),say('wren','grin','course.s2.empty')],
 s2Reload:[say('wren','speaking','course.s2.reload'),card('reload')],
 s2Down:[say('egret','speaking','course.s2.kill'),say('egret','speaking','course.s2.next')],
 // 3 throwables
 s3Before:[say('egret','speaking','course.s3.intro'),say('wren','laughing','course.s3.intro2'),say('wren','speaking','course.s3.intro3')],
 s3See:[say('egret','speaking','course.s3.see'),card('throw')],
 s3Aim:[say('egret','speaking','course.s3.aim')],
 s3Throw:[say('wren','laughing','course.s3.throw')],
 s3All:[say('egret','speaking','course.s3.all'),say('egret','speaking','course.s3.next')],
 s3Missed:[say('wren','sigh','course.s3.missed')],
 s3Down:[say('egret','speaking','course.s3.next')],
 // 4 the dark room
 s4Enter:[say('egret','serious','course.s4.enter'),card('light')],
 s4Dim:[say('egret','speaking','course.s4.dim')],
 s4Black:[say('wren','speaking','course.s4.black')],
 s4Spot:[say('egret','speaking','course.s4.spot')],
 s4Kill:[say('wren','speaking','course.s4.kill')],
 s4Noticed:[say('egret','speaking','course.s4.noticed'),card('flash'),say('wren','speaking','course.s4.flashlight'),card('flashlight')],
 s4Clear:[say('egret','gentle','course.s4.clear'),say('egret','speaking','course.s4.next')],
 // 5 noncombatants, then the fight on your own
 s5Enter:[say('egret','speaking','course.s5.enter')],
 s5Scream:[say('wren','speaking','course.s5.scream'),say('egret','speaking','course.s5.civilian'),card('civilian')],
 s5Down:[say('wren','speaking','course.s5.down')],
 s5Combat:[say('egret','speaking','course.s5.combat')],
 s5Hurt:[say('wren','serious','course.s5.hurt')],
 s5Clear:[say('egret','speaking','course.s5.clear')],
 // 6 extraction
 s6Clear:[say('egret','speaking','course.s6.clear')],
 s6Elevator:[say('wren','speaking','course.s6.elevator'),card('exit')]
});
// The line under the extraction beam, and the one on the training result.
export const COURSE_EXTRACT_LINE=Object.freeze({speaker:'wren',expression:'speaking',line:'course.s6.beam'});
export const COURSE_RESULT_LINE=Object.freeze({speaker:'egret',expression:'speaking',line:'course.s6.result'});
// A card that closes can set off the next beat.
export const COURSE_AFTER_CARD=Object.freeze({cover:'doorGo',door:'box',throw:'s3Aim'});

// Full-screen cards: pages of one picture (or the hit/damage chart) and one paragraph. `localized` pictures have words
// of the interface in them and come in one file per language (name.en.png beside name.png).
export const COURSE_CARDS=Object.freeze({
 move:{section:1,title:'course.card.moveTitle',pages:[{image:'move',localized:true,text:'course.card.move'}]},
 cover:{section:1,title:'course.card.coverTitle',pages:[{image:'cover-status',text:'course.card.coverStatus'},{image:'cover-line',text:'course.card.coverLine'}]},
 door:{section:1,title:'course.card.doorTitle',pages:[{image:'door',localized:true,text:'course.card.door'}]},
 box:{section:1,title:'course.card.boxTitle',pages:[{image:'box',localized:true,text:'course.card.box'}]},
 target:{section:2,title:'course.card.targetTitle',pages:[{image:'target-card',localized:true,text:'course.card.target'},{chart:'hitDamage',text:'course.card.hitDamage'}]},
 windup:{section:2,title:'course.card.windupTitle',pages:[{image:'windup',text:'course.card.windup'}]},
 reload:{section:2,title:'course.card.reloadTitle',pages:[{image:'reload',localized:true,text:'course.card.reload'}]},
 throw:{section:3,title:'course.card.throwTitle',pages:[{image:'blast',text:'course.card.blast'},{image:'throw-steps',localized:true,text:'course.card.throwSteps'}]},
 light:{section:4,title:'course.card.lightTitle',pages:[{image:'light',text:'course.card.light'}]},
 flash:{section:4,title:'course.card.flashTitle',pages:[{image:'flash',text:'course.card.flash'}]},
 flashlight:{section:4,title:'course.card.flashlightTitle',pages:[{image:'flashlight',text:'course.card.flashlight'}]},
 civilian:{section:5,title:'course.card.civilianTitle',pages:[{image:'civilian',text:'course.card.civilian'}]},
 exit:{section:6,title:'course.card.exitTitle',pages:[{image:'exit',localized:true,text:'course.card.exit'}]}
});
// The hit/damage chart is drawn from the table, so it reads in either language.
export const COURSE_CHART=Object.freeze({
 hitDamage:{columns:[
  {title:'course.chart.hit',rows:['course.chart.moving','course.chart.cover','course.chart.dark','course.chart.range']},
  {title:'course.chart.damage',rows:['course.chart.weapon','course.chart.armor','course.chart.coverDamage']}
 ]}
});
export const COURSE_SECTION_TITLES=Object.freeze(['course.section.1','course.section.2','course.section.3','course.section.4','course.section.5','course.section.6']);

// Death lines, by the section the unit fell in (src/course.js courseDeathSection decides which, including the player's
// own grenade). The controllers wonder what they did wrong, then call for the next one.
export const COURSE_DEATH=Object.freeze({
 1:[say('egret','concerned','course.death.silence'),say('wren','sad','course.death.silence'),say('egret','concerned','course.death.s1a'),say('wren','determined','course.death.s1b'),say('egret','serious','course.death.s1c')],
 2:[say('egret','worried','course.death.s2a'),say('wren','neutral','course.death.s2b'),say('egret','closed','course.death.s2c'),say('wren','sad','course.death.s2d')],
 3:[say('egret','concerned','course.death.silence'),say('wren','sad','course.death.silence'),say('egret','closed','course.death.s3a')],
 4:[say('egret','concerned','course.death.s4a'),say('egret','sad','course.death.s4b'),say('wren','neutral','course.death.s4c')],
 5:[say('wren','sad','course.death.s5a'),say('egret','concerned','course.death.s5b')],
 6:[say('egret','serious','course.death.s6a'),say('egret','concerned','course.death.s6b'),say('wren','neutral','course.death.s6c')]
});
