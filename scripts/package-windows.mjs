import './sync-stations.mjs';
import './build-artwork.mjs';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('release','LUMA');mkdirSync(path.join(root,'runtime'),{recursive:true});
let source=readFileSync('src/server.js','utf8').replace('"__LUMA_HTML__"',()=>JSON.stringify(readFileSync('src/index.html','utf8'))).replace('export default {','const worker = {');
source=source.replace('"__LUMA_ARTWORK_PNG__"',()=>JSON.stringify(readFileSync('src/artwork.png').toString('base64')));
const wrapper=`const http=require('node:http');
const {spawn}=require('node:child_process');
const {DiscordPresence,handleDesktop}=require('./discord-presence.cjs');
const presence=new DiscordPresence({configPath:require('node:path').join(__dirname,'data','rich-presence.json')});
${source}
const server=http.createServer(async(req,res)=>{
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const init={method:req.method,headers:req.headers};
  if(!['GET','HEAD'].includes(req.method)){init.body=req;init.duplex='half';}
  const request=new Request(origin+req.url,init);
  const response=await handleDesktop(request,presence)||await worker.fetch(request,{});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body){const reader=response.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));
   while(!res.destroyed){const {done,value}=await reader.read();if(done)break;if(!res.write(value))await new Promise(resolve=>res.once('drain',resolve));}}
  res.end();
 }catch(e){if(!res.headersSent)res.writeHead(500);res.end('LUMA: server error');}
});
let port=4173;
server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<4180){port++;server.listen(port,'127.0.0.1');}else{console.error('LUMA could not start:',e.message);process.exit(1);}});
server.on('listening',()=>{const url='http://127.0.0.1:'+port;console.log('LUMA Radio: '+url);console.log('Keep this window open. Close it to stop LUMA.');if(!process.argv.includes('--no-open')){const child=spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}});
server.listen(port,'127.0.0.1');
process.on('SIGINT',()=>{presence.close();server.close();process.exit(0);});
process.on('exit',()=>presence.close());
`;
writeFileSync(path.join(root,'luma.cjs'),wrapper);
copyFileSync('src/discord-presence.cjs',path.join(root,'discord-presence.cjs'));
copyFileSync('src/artwork.png',path.join(root,'LUMA-Discord.png'));
// Використовуємо встановлений Node.js; виконуваний файл середовища не поширюється.
writeFileSync(path.join(root,'START-LUMA.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0LUMA.exe"\r\n');
writeFileSync(path.join(root,'ПОЧАТИ-ТУТ.txt'),'\ufeff'+readFileSync('WINDOWS-README.txt','utf8'));

console.log(root);
