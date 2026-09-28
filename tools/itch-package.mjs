// itch.io package (3.199.0, user: the first public build goes to itch.io): zips the built game in dist/ into
// release/ash-protocol-<version>-itch.zip for an itch.io HTML upload. `npm run itch` builds first. See docs/RELEASE.md.
// - index.html sits at the zip's root, as itch.io expects; every game path is relative, so the game runs from the
//   /html/<upload id>/ folder itch.io serves it from.
// - Deterministic: sorted entries and one fixed timestamp, so the same build always gives the same zip.
// - Node's zlib only (deflate and crc32); no archiver dependency.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,relative,resolve,dirname} from 'node:path';
import {deflateRawSync,crc32} from 'node:zlib';
import {VERSION} from '../src/version.js';

const root=process.cwd(),dist=resolve(root,'dist'),out=resolve(root,'release',`ash-protocol-${VERSION}-itch.zip`);
const SKIP=new Set(['.nojekyll']);   // GitHub Pages only
// itch.io's limits for an HTML upload.
const MAX_FILES=1000,MAX_BYTES=500*1024*1024;
const DOS_TIME=0,DOS_DATE=((2026-1980)<<9)|(1<<5)|1;   // 2026-01-01 00:00

async function walk(dir){
  const found=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())found.push(...await walk(path));else found.push(path);}
  return found;
}
const names=(await walk(dist)).map(path=>relative(dist,path).split('\\').join('/')).filter(name=>!SKIP.has(name)).sort();
if(!names.includes('index.html'))throw new Error('dist/index.html is missing: run npm run build first');
if(names.length>MAX_FILES)throw new Error(`${names.length} files; itch.io accepts at most ${MAX_FILES}`);

const parts=[],directory=[];let offset=0,unpacked=0;
for(const name of names){
  const data=await readFile(join(dist,name)),packed=deflateRawSync(data,{level:9}),stored=packed.length>=data.length;
  const body=stored?data:packed,method=stored?0:8,crc=crc32(data),path=Buffer.from(name,'utf8');
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(method,8);
  local.writeUInt16LE(DOS_TIME,10);local.writeUInt16LE(DOS_DATE,12);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(path.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);
  central.writeUInt16LE(method,10);central.writeUInt16LE(DOS_TIME,12);central.writeUInt16LE(DOS_DATE,14);central.writeUInt32LE(crc,16);
  central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(path.length,28);central.writeUInt32LE(offset,42);
  parts.push(local,path,body);directory.push(central,path);
  offset+=local.length+path.length+body.length;unpacked+=data.length;
}
if(unpacked>MAX_BYTES)throw new Error(`${unpacked} bytes unpacked; itch.io accepts at most ${MAX_BYTES}`);
const size=directory.reduce((sum,b)=>sum+b.length,0),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
await mkdir(dirname(out),{recursive:true});
await writeFile(out,Buffer.concat([...parts,...directory,end]));
console.log(`${relative(root,out)}: ${names.length} files, ${(unpacked/1048576).toFixed(1)} MB unpacked, ${((offset+size+22)/1048576).toFixed(1)} MB zipped`);
