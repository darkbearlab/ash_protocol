import {cp,mkdir,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';

const root=process.cwd(),destination=resolve(root,'dist');
if(dirname(destination)!==root)throw new Error('Build destination must stay within workspace');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const file of ['index.html','style.css','expansion.css','manifest.webmanifest','sw.js','src','assets'])await cp(resolve(root,file),join(destination,file),{recursive:true});
await writeFile(join(destination,'.nojekyll'),'');
const html=await readFile(join(destination,'index.html'),'utf8');
if(/(?:src|href)=["']\/(?!\/)/.test(html))throw new Error('Root-absolute asset URL breaks GitHub project Pages');
const files=await readdir(destination);console.log(`Built ${files.length} public entries into dist/; compatible with /ash_protocol/`);
