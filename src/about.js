import {t} from './i18n.js';
import {VERSION} from './version.js';

// The About page on the main menu (3.190.0, user request before the version freeze): the AI note in the user's own
// voice, then the copyright notice the release plan asked for (使用者願望清單 item 1: code and art keep their rights,
// no redistribution, third-party material named with its licence). The only third-party material shipped is the
// three Google Fonts; the audio is synthesized by the project's own generators (art/audio).
// The AI note is the user's own wording (2026-09-26); the English follows it.
export const ABOUT_AI=['about.ai.wish','about.ai.made','about.ai.hope'];
export const ABOUT_RIGHTS=['about.rights.owner','about.rights.use','about.rights.source','about.rights.privacy'];   // privacy: 3.197.0
export const ABOUT_CREDITS=['about.credits.fonts','about.credits.fiction'];
export const ITCH_URL='https://slothmagegames.itch.io/';   // the user's itch.io account, Sloth Mage Games

const paragraphs=(ids,cls='')=>ids.map(id=>`<p${cls?` class="${cls}"`:''}>${t(id)}</p>`).join('');

export function aboutMarkup(){
  return `<div class="about-page"><div class="eyebrow">ASH PROTOCOL / ABOUT · BUILD ${VERSION}</div><h2>${t('about.title')}</h2>
<section class="about-ai"><h3>${t('about.aiTitle')}</h3>${paragraphs(ABOUT_AI)}<p class="about-small">${t('about.ai.tools')}</p></section>
<section><h3>${t('about.rightsTitle')}</h3>${paragraphs(ABOUT_RIGHTS)}<p>${t('about.rights.home',{link:`<a href="${ITCH_URL}" target="_blank" rel="noopener">slothmagegames.itch.io</a>`})}</p></section>
<section><h3>${t('about.creditsTitle')}</h3>${paragraphs(ABOUT_CREDITS,'about-small')}</section>
<button class="modal-button secondary" data-modal="intro">${t('controller.backToTitle')}</button></div>`;
}
