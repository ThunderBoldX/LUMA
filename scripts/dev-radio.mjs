import './sync-stations.mjs';
import './build-artwork.mjs';
import http from 'node:http';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/server.js','utf8').replace('"__LUMA_HTML__"',()=>JSON.stringify(readFileSync('src/index.html','utf8'))).replace('"__LUMA_ARTWORK_PNG__"',()=>JSON.stringify(readFileSync('src/artwork.png').toString('base64')));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
http.createServer(async(req,res)=>{try{const url='http://127.0.0.1:4173'+req.url;const init={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method)){init.body=req;init.duplex='half';}const response=await worker.fetch(new Request(url,init),{});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));while(!res.destroyed){const {done,value}=await reader.read();if(done)break;if(!res.write(value))await new Promise(r=>res.once('drain',r));}}res.end();}catch(e){if(!res.headersSent)res.writeHead(500);res.end('Server error');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
