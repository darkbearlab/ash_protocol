import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8'};
http.createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/ash_protocol'){res.writeHead(302,{Location:'/ash_protocol/'});return res.end();}
    if(pathname.startsWith('/ash_protocol/'))pathname=pathname.slice('/ash_protocol'.length);
    const publicFile = pathname === '/' || ['/index.html','/material-review.html','/style.css','/expansion.css','/manifest.webmanifest','/sw.js'].includes(pathname) || /^\/(src\/[a-z0-9-]+\.js|assets\/(?:pixel\/(?:(?:terrain-v1|walls-v1|portraits)\/)?)?[a-z0-9-]+\.(svg|png|json))$/.test(pathname);
    if (!publicFile) { res.writeHead(404); return res.end('Not found'); }
    const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403); return res.end(); }
    const body=await readFile(file); res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(5173,'0.0.0.0',()=>console.log('ASH PROTOCOL ready at http://localhost:5173'));
