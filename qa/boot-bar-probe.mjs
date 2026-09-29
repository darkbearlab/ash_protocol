// Watches the start-up bar (3.198.3) fill on throttled 4G with the cache off, and saves a mid-load screenshot.
//   node server.mjs   then   node qa/boot-bar-probe.mjs [url] [outDir]
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [url='http://localhost:5174/',out='.']=process.argv.slice(2);
const dir=await mkdtemp(join(tmpdir(),'ash-bar-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9338',`--user-data-dir=${dir}`,'--window-size=390,844','about:blank'],{stdio:'ignore'});
let target;for(let i=0;i<60&&!target;i++){await sleep(200);try{target=(await (await fetch('http://127.0.0.1:9338/json/list')).json()).find(t=>t.type==='page');}catch{}}
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(ok=>ws.onopen=ok);
let seq=0;const pending=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id);}};
const send=(method,params={})=>new Promise(ok=>{const id=++seq;pending.set(id,ok);ws.send(JSON.stringify({id,method,params}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.result?.value;
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Network.emulateNetworkConditions',{offline:false,latency:170,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8});
const t0=Date.now();await send('Page.navigate',{url});
const samples=[];let shot=false;
for(let i=0;i<200;i++){await sleep(250);
 const s=await ev(`(()=>{const b=document.querySelector('.boot-screen');if(!b)return null;return {booting:document.body?.classList.contains('booting'),width:b.querySelector('.boot-bar i')?.style.width,count:b.querySelector('.boot-count')?.textContent,plain:b.classList.contains('boot-plain')};})()`);
 if(s)samples.push([Date.now()-t0,s.booting,s.width,s.count,s.plain]);
 if(s&&!shot&&s.count&&Number(s.count.split(' ')[0])>60){shot=true;const data=(await send('Page.captureScreenshot',{format:'png'})).result.data;await writeFile(join(out,'boot-bar.png'),Buffer.from(data,'base64'));}
 if(s&&!s.booting)break;}
console.log(samples.filter((_,i)=>i%3===0||i===samples.length-1).map(s=>s.join(' ')).join('\n'));
ws.close();chrome.kill();
