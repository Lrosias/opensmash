import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'yougame/dist');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
  if(!file.startsWith(root+path.sep))throw new Error('Invalid path');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Serving ${root} on port ${process.env.PORT||4173}`));
