import {compileMaterials} from './materials.mjs';
await compileMaterials();
import {cp,mkdir,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';

const root=process.cwd(),destination=resolve(root,'dist');
if(dirname(destination)!==root)throw new Error('Build destination must stay within workspace');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const file of ['index.html','material-review.html','style.css','expansion.css','manifest.webmanifest','sw.js','src','assets'])await cp(resolve(root,file),join(destination,file),{recursive:true});
// Give every module/style dependency the same content-derived URL. A new release
// must not combine fresh HTML with JS from the browser's ten-minute HTTP cache.
const sourceFiles=['index.html','material-review.html','style.css','expansion.css','sw.js',...(await readdir(join(destination,'src'))).filter(n=>n.endsWith('.js')).sort().map(n=>`src/${n}`)];
const sources=await Promise.all(sourceFiles.map(async file=>[file,await readFile(join(destination,file),'utf8')]));
const revision=createHash('sha256').update(sources.map(([file,body])=>file+'\n'+body).join('\n')).digest('hex').slice(0,12);
for(const [file,body]of sources){let output=body.replace(/(['"])(\.{1,2}\/[^'"?]+\.(?:js|css))\1/g,(_,quote,url)=>`${quote}${url}?v=${revision}${quote}`);if(file==='sw.js')output=output.replace(/const CACHE='([^']+)'/,(_,cache)=>`const CACHE='${cache}-${revision}'`);await writeFile(join(destination,file),output);}
await writeFile(join(destination,'.nojekyll'),'');
const html=await readFile(join(destination,'index.html'),'utf8');
if(/(?:src|href)=["']\/(?!\/)/.test(html))throw new Error('Root-absolute asset URL breaks GitHub project Pages');
const files=await readdir(destination);console.log(`Built ${files.length} public entries into dist/; compatible with /ash_protocol/`);
