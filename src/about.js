import {t} from './i18n.js';
import {VERSION} from './version.js';

// The About page on the main menu (3.190.0, user request before the version freeze): the AI note in the user's own
// voice, then the copyright notice the release plan asked for (使用者願望清單 item 1: code and art keep their rights,
// no redistribution, third-party material named with its licence). The only third-party material shipped is the
// three Google Fonts; the audio is synthesized by the project's own generators (art/audio).
export const ABOUT_AI=['about.ai.wish','about.ai.made','about.ai.real','about.ai.hands','about.ai.hope'];
export const ABOUT_RIGHTS=['about.rights.owner','about.rights.use','about.rights.source'];
export const ABOUT_CREDITS=['about.credits.fonts','about.credits.fiction'];

const paragraphs=(ids,cls='')=>ids.map(id=>`<p${cls?` class="${cls}"`:''}>${t(id)}</p>`).join('');

export function aboutMarkup(){
  return `<div class="about-page"><div class="eyebrow">ASH PROTOCOL / ABOUT · BUILD ${VERSION}</div><h2>${t('about.title')}</h2>
<section class="about-ai"><h3>${t('about.aiTitle')}</h3>${paragraphs(ABOUT_AI)}<p class="about-small">${t('about.ai.tools')}</p></section>
<section><h3>${t('about.rightsTitle')}</h3>${paragraphs(ABOUT_RIGHTS)}</section>
<section><h3>${t('about.creditsTitle')}</h3>${paragraphs(ABOUT_CREDITS,'about-small')}</section>
<button class="modal-button secondary" data-modal="intro">${t('controller.backToTitle')}</button></div>`;
}
