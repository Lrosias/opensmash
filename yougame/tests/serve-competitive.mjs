// Authored competitive shell over an existing native build. No packaging or
// native rebuild is implied by this development server.
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const game=fileURLToPath(new URL('../',import.meta.url)),native=path.resolve(process.env.YOUGAME_NATIVE_DIST||path.join(game,'dist'));
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};
http.createServer(async(req,res)=>{try{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let root=p.startsWith('/engine/')?native:path.join(game,'src'),relative=p==='/'?'index.html':p.slice(1);
 if(p==='/engine/index.html'){root=path.join(game,'src');relative='engine.html';}
 if(p.startsWith('/tests/'))root=game;
 if(p.startsWith('/controllers/'))root=path.dirname(game);
 const f=path.resolve(root,relative);if(!f.startsWith(root+path.sep))throw new Error('Invalid path');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));
 }catch{res.writeHead(404);res.end('Missing');}
}).listen(Number(process.env.PORT||4184),'127.0.0.1',()=>console.log('Competitive shell server ready; native build: '+native));
