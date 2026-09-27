import {t,language} from './i18n.js';
import {COURSE_CARDS,COURSE_CHART,COURSE_SECTION_TITLES} from './course-script.js';

// The training course's full-screen cards (3.198.0, src/course-script.js). One page shows one picture (or the hit/damage
// chart) and one paragraph; a card with more pages pages back and forth, and its last page continues the course.
export const COURSE_ART='./assets/course/';
export const courseImage=(page,lang=language())=>`${COURSE_ART}${page.image}${page.localized&&lang==='en'?'.en':''}.png`;
const chartMarkup=id=>`<div class="course-chart">${COURSE_CHART[id].columns.map(c=>`<section><h3>${t(c.title)}</h3><ul>${c.rows.map(r=>`<li>${t(r)}</li>`).join('')}</ul></section>`).join('')}</div>`;
export function courseCardMarkup(id,index=0){
 const card=COURSE_CARDS[id],total=card.pages.length,i=Math.max(0,Math.min(total-1,index)),page=card.pages[i],last=i===total-1;
 const art=page.chart?chartMarkup(page.chart):`<figure class="course-shot"><img src="${courseImage(page)}" alt=""></figure>`;
 const back=i>0?`<button class="modal-button secondary" data-course-page="${i-1}">${t('course.prev')}</button>`:'';
 const next=last?`<button class="modal-button" data-course-done>${t('course.done')}</button>`:`<button class="modal-button" data-course-page="${i+1}">${t('course.next')}</button>`;
 return `<div class="course-card" data-course-card="${id}" data-page="${i}"><div class="eyebrow">TRAINING ${String(card.section).padStart(2,'0')} / ${t(COURSE_SECTION_TITLES[card.section-1])}${total>1?` · ${i+1}/${total}`:''}</div><h2>${t(card.title)}</h2>${art}<p>${t(page.text)}</p><div class="modal-footer course-pager">${back}${next}</div></div>`;
}
