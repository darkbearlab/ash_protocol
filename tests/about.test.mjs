import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {t} from '../src/i18n.js';
import {VERSION} from '../src/version.js';
import {aboutMarkup,ABOUT_AI,ABOUT_RIGHTS,ABOUT_CREDITS} from '../src/about.js';

// 3.190.0 (user request before the version freeze): ABOUT on the main menu holds the AI note and the copyright notice.
test('the About page carries the AI note, the rights, the font licence and a way back',()=>{
 const page=aboutMarkup();
 assert.ok(page.includes(`BUILD ${VERSION}`));
 for(const id of [...ABOUT_AI,'about.ai.tools',...ABOUT_RIGHTS,...ABOUT_CREDITS])assert.ok(page.includes(t(id)),id);
 assert.match(page,/SIL Open Font License 1\.1/);
 assert.match(page,/data-modal="intro"/);
 const controller=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.match(controller,/entry\('about','ABOUT',t\('controller\.title\.about'\)\)/,'the title menu lists it');
 assert.equal((controller.match(/case 'about':modal\(aboutMarkup\(\),true\);break;/g)||[]).length,2,'both action switches open it');
});
