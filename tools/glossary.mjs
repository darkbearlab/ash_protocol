// Refreshes docs/GLOSSARY.md from the language tables (3.177.10). The glossary keeps its own sections and ids; this
// rewrites each row's Chinese and English from src/text-zh-tw.js and src/text-en.js and the counts in the headings.
//   node tools/glossary.mjs           rewrite docs/GLOSSARY.md
//   node tools/glossary.mjs --check   exit 1 if it is out of date
// To list a new name, add a row with its id to the right section (any text in the name columns), then run this.
import {readFileSync,writeFileSync} from 'node:fs';
import zh from '../src/text-zh-tw.js';
import en from '../src/text-en.js';

const file=new URL('../docs/GLOSSARY.md',import.meta.url);
const cell=text=>String(text).replace(/\|/g,'\\|');
const before=readFileSync(file,'utf8');
const missing=[];
const lines=before.split('\n').map(line=>{
 const row=line.match(/^\| .* \| .* \| `([^`]+)` \|$/);
 if(!row)return line;
 const id=row[1];
 if(!(id in zh)||!(id in en)){missing.push(id);return line;}
 return `| ${cell(zh[id])} | ${cell(en[id])} | \`${id}\` |`;
});
// Recount each section from its rows.
for(let i=0;i<lines.length;i++){
 const heading=lines[i].match(/^## (.+?)（\d+）$/);if(!heading)continue;
 let n=0;for(let j=i+1;j<lines.length&&!lines[j].startsWith('## ');j++)if(/^\| .* \| `[^`]+` \|$/.test(lines[j]))n++;
 lines[i]=`## ${heading[1]}（${n}）`;
}
const after=lines.join('\n');
if(missing.length){console.error(`not in the language tables: ${missing.join(', ')}`);process.exit(1);}
if(process.argv.includes('--check')){if(after!==before){console.error('docs/GLOSSARY.md is out of date: run node tools/glossary.mjs');process.exit(1);}console.log('glossary up to date');}
else{writeFileSync(file,after);console.log(after===before?'glossary already up to date':'docs/GLOSSARY.md refreshed');}
