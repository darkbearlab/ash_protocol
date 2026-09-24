// Controller channel (3.168.0, user request; docs/STORY.md 6): the 管制員 speaks through one box wherever she appears —
// the mission briefing first, the main menu and other moments later. The left plate stands in for her portrait and
// reads SOUND ONLY until the art exists; like the floor stencils it stays English in every language.
import {t} from './i18n.js';

export function commsMarkup(line){
 return `<div class="comms" role="group" aria-label="${t('comms.aria')}"><div class="comms-face" aria-hidden="true"><span>SOUND</span><span>ONLY</span></div><div class="comms-body"><p class="comms-name">${t('comms.name')}</p><p class="comms-line">${line}</p></div></div>`;
}
