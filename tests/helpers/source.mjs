// 3.206.3: src/game.js, src/renderer.js and src/controller.js are split by topic into src/<name>-*.js. A check that
// reads the source of one of them reads the whole family: the entry first, then its topic files in name order.
import {readFileSync,readdirSync} from 'node:fs';
const SRC=new URL('../../src/',import.meta.url);
export const familyFiles=name=>[`${name}.js`,...readdirSync(SRC).filter(f=>f.startsWith(`${name}-`)&&f.endsWith('.js')).sort()];
export const sourceFamily=name=>familyFiles(name).map(f=>readFileSync(new URL(f,SRC),'utf8').replace(/\r\n/g,'\n')).join('\n');
// One class member's text, from its first line to the closing brace at the member's indent.
export function memberText(source,signature){const i=source.indexOf(signature);if(i<0)return '';const end=source.indexOf('\n  }\n',i);return source.slice(i,end<0?undefined:end+4);}
