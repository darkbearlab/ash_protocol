// Static page text in the chosen language (3.167.0, docs/TEXT_INVENTORY.md). index.html keeps its Chinese as the
// fallback and marks each piece with the id it reads: data-i18n (text), data-i18n-aria (aria-label), data-i18n-title.
import {t,language} from './i18n.js';

export function localizeDocument(doc=document){
 doc.documentElement.lang=language()==='en'?'en':'zh-Hant';
 doc.title=t('index.title');
 const meta=doc.querySelector('meta[name="description"]');if(meta)meta.content=t('index.description');
 for(const el of doc.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 for(const el of doc.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',t(el.dataset.i18nAria));
 for(const el of doc.querySelectorAll('[data-i18n-title]'))el.title=t(el.dataset.i18nTitle);
}
