const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const LIMIT=16384;
const text=(s,max=128)=>String(s||'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,max);
function frame(op,data){const body=Buffer.from(JSON.stringify(data),'utf8'),header=Buffer.alloc(8);header.writeUInt32LE(op);header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);}
function activityFor(state,assetKey){if(!state?.playing)return null;return{type:2,details:text(state.station||'Радіо'),state:state.title?text((state.artist?state.artist+' — ':'')+state.title):'Прямий ефір · LUMA',timestamps:{start:Math.floor(state.startedAt/1000)},assets:{large_image:assetKey||'luma',large_text:'LUMA'}};}
class DiscordPresence{
 constructor(options={}){
  this.clock=options.clock||Date.now;this.connect=options.connect||net.createConnection;this.configPath=options.configPath||null;this.config={enabled:false,clientId:'',assetKey:'luma'};this.socket=null;this.connecting=false;this.ready=false;this.buffer=Buffer.alloc(0);this.message='Не підключено';this.lastAttempt=0;this.lastSent=-Infinity;this.lastHash='';this.latest=null;this.receivedAt=0;this.pending=null;this.lastPublished=null;this.generation=0;this.timer=null;
  if(this.configPath)try{const saved=JSON.parse(fs.readFileSync(this.configPath,'utf8'));if(/^\d{17,22}$/.test(saved.clientId)&&/^[a-z0-9_-]{1,64}$/.test(saved.assetKey||'luma'))this.config={enabled:!!saved.enabled,clientId:saved.clientId,assetKey:saved.assetKey||'luma'};}catch{}
  if(options.autoStart!==false){this.timer=setInterval(()=>this.tick(),1000);this.timer.unref();}
 }
 status(){return{supported:true,enabled:this.config.enabled,clientId:this.config.clientId,assetKey:this.config.assetKey,connected:this.ready,message:this.message,published:this.lastPublished};}
 configure(input){const clientId=text(input.clientId,30),assetKey=text(input.assetKey||'luma',64);if(clientId&&!/^\d{17,22}$/.test(clientId))throw Error('Application ID має містити 17–22 цифри.');if(!/^[a-z0-9_-]{1,64}$/.test(assetKey))throw Error('Назва зображення: латинські малі літери, цифри, _ або -.');if(input.enabled&&!clientId)throw Error('Спочатку додай Application ID програми Discord.');
  this.disconnect();this.config={enabled:!!input.enabled,clientId,assetKey};this.message=this.config.enabled?'Шукаю відкритий Discord…':'Вимкнено';this.lastAttempt=-Infinity;
  if(this.configPath){fs.mkdirSync(path.dirname(this.configPath),{recursive:true});fs.writeFileSync(this.configPath,JSON.stringify(this.config,null,2));}this.tick();return this.status();
 }
 update(input){const now=this.clock(),playing=input.playing===true;const same=this.latest?.playing&&this.latest.station===text(input.station);this.latest={playing,station:text(input.station),artist:text(input.artist),title:text(input.title),startedAt:same?this.latest.startedAt:now};this.receivedAt=now;this.tick();}
 nowPlaying(){return this.latest&&this.clock()-this.receivedAt<20000?this.latest:{playing:false,station:this.latest?.station||'',title:'',artist:'',startedAt:0};}
 disconnect(){this.generation++;if(this.socket){try{if(this.ready)this.socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:null},nonce:crypto.randomUUID()}));}catch{}this.socket.destroy();}this.socket=null;this.ready=false;this.connecting=false;this.buffer=Buffer.alloc(0);this.pending=null;this.lastHash='';this.lastPublished=null;}
 async beginConnect(){if(this.connecting||this.ready||!this.config.enabled)return;this.lastAttempt=this.clock();this.connecting=true;const generation=this.generation;
  for(let i=0;i<10;i++){
   if(generation!==this.generation||!this.config.enabled)return;
   try{const socket=await new Promise((resolve,reject)=>{let socket;const timeout=setTimeout(()=>{socket?.destroy();reject(Error('timeout'));},500);try{socket=this.connect({path:'\\\\?\\pipe\\discord-ipc-'+i});}catch(error){clearTimeout(timeout);reject(error);return;}socket.once('connect',()=>{clearTimeout(timeout);socket.removeListener('error',fail);resolve(socket);});const fail=error=>{clearTimeout(timeout);socket.destroy();reject(error);};socket.once('error',fail);});
    if(generation!==this.generation){socket.destroy();return;}
    this.socket=socket;this.handshakeAt=this.clock();this.buffer=Buffer.alloc(0);this.message='Узгоджую підключення з Discord…';this.connecting=false;
    socket.on('data',bytes=>this.onData(bytes,socket));socket.on('error',()=>{if(socket===this.socket){this.message='Discord від’єднався. Спробую знову.';this.disconnect();}});socket.on('close',()=>{if(socket===this.socket){this.message='Очікую відкриття Discord';this.disconnect();}});
    socket.write(frame(0,{v:1,client_id:this.config.clientId}));return;
   }catch{}
  }
  if(generation===this.generation){this.connecting=false;this.message='Відкрий настільний Discord. Повторю підключення автоматично.';}
 }
 onData(bytes,socket){if(socket!==this.socket)return;this.buffer=Buffer.concat([this.buffer,bytes]);if(this.buffer.length>1048584){this.message='Некоректна відповідь Discord';this.disconnect();return;}
  while(this.buffer.length>=8){const op=this.buffer.readUInt32LE(),length=this.buffer.readUInt32LE(4);if(length>1048576){this.disconnect();return;}if(this.buffer.length<length+8)return;const body=this.buffer.subarray(8,length+8);this.buffer=this.buffer.subarray(length+8);let data;try{data=JSON.parse(body.toString('utf8'));}catch{this.disconnect();return;}
   if(op===3){socket.write(frame(4,data));continue;}if(op===2){this.message='Discord відхилив підключення. Перевір Application ID.';this.config.enabled=false;this.disconnect();return;}
   if(op!==1)continue;if(data.evt==='READY'){this.ready=true;this.message='Discord підключено';this.lastSent=-Infinity;this.lastHash='';this.tick();}
   else if(data.evt==='ERROR'){this.message=text(data.data?.message||'Discord відхилив оновлення. Перевір ID та назву зображення.',250);this.pending=null;}
   else if(data.cmd==='SET_ACTIVITY'&&this.pending?.nonce===data.nonce){this.lastPublished=this.pending.activity;this.pending=null;this.message=this.lastPublished?'Rich Presence активний':'Discord підключено · на паузі';}
  }
 }
 tick(){if(!this.config.enabled)return;if(this.socket&&!this.ready&&this.clock()-this.handshakeAt>10000){this.message='Discord не відповів. Перевір Application ID.';this.disconnect();this.lastAttempt=this.clock();return;}if(!this.socket&&!this.connecting&&this.clock()-this.lastAttempt>10000){this.beginConnect().catch(()=>{});return;}if(!this.ready||!this.socket)return;if(this.pending){if(this.clock()-this.pending.sentAt>15000){this.message='Discord не підтвердив оновлення';this.disconnect();}return;}
  const activity=activityFor(this.nowPlaying(),this.config.assetKey),hash=JSON.stringify(activity);if(hash===this.lastHash||this.clock()-this.lastSent<7500)return;const nonce=crypto.randomUUID();this.pending={nonce,activity,sentAt:this.clock()};this.lastHash=hash;this.lastSent=this.clock();try{this.socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity},nonce}));}catch{this.disconnect();}
 }
 close(){clearInterval(this.timer);this.disconnect();}
}
const overlayHTML=`<!doctype html><html lang="uk"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:transparent;color:#f6edff;font:14px -apple-system,Segoe UI,sans-serif}.card{width:430px;max-width:100%;display:flex;align-items:center;gap:14px;padding:17px;border:1px solid #c99df74d;border-radius:22px;background:linear-gradient(120deg,#30213ff2,#15101df5);box-shadow:0 8px 30px #0004}.art{width:62px;height:62px;flex-shrink:0;border-radius:16px}.text{min-width:0;flex:1}.brand{color:#c4a1ec;letter-spacing:2px;font-size:9px;margin-bottom:8px}.station{font-size:12px;color:#c1a8d5;margin-top:5px}.song{font-size:16px;font-weight:650;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.artist{font-size:12px;color:#a78eb9;margin-top:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.live{color:#b6e6c5;font-size:9px;letter-spacing:1px}.muted{color:#927c9f}</style><div class="card"><img class="art" src="/artwork.png" alt="LUMA"><div class="text"><div class="brand">LUMA</div><div class="song" id="song">Прямий ефір</div><div class="artist" id="artist"></div><div class="station" id="station"></div></div><div class="live" id="live">ПАУЗА</div></div><script>async function refresh(){try{const r=await fetch('/api/now-playing',{cache:'no-store'});if(!r.ok)return;const s=await r.json();document.getElementById('song').textContent=s.title||s.station||'LUMA';document.getElementById('artist').textContent=s.artist||'';document.getElementById('station').textContent=s.title?s.station:'';document.getElementById('live').textContent=s.playing?'● LIVE':'ПАУЗА';document.getElementById('live').classList.toggle('muted',!s.playing);}catch{document.getElementById('live').textContent='ОФЛАЙН';}}refresh();setInterval(refresh,2000);</script></html>`;
async function handleDesktop(request,presence){const url=new URL(request.url);if(url.pathname==='/overlay'&&request.method==='GET')return new Response(overlayHTML,{headers:{'Content-Type':'text/html; charset=utf-8'}});if(url.pathname==='/api/now-playing'&&request.method==='GET')return Response.json(presence.nowPlaying(),{headers:{'Cache-Control':'no-store'}});if(!['/api/presence','/api/presence/activity'].includes(url.pathname))return null;
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET'&&url.pathname==='/api/presence')return json(presence.status());
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Недозволений запит'},403);
 try{const body=await request.text();if(Buffer.byteLength(body)>LIMIT)return json({error:'Завеликий запит'},413);const data=JSON.parse(body);if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Невірні дані'},400);
  if(url.pathname==='/api/presence')return json(presence.configure(data));presence.update(data);return json({ok:true});
 }catch(error){return json({error:text(error.message,250)},400);}
}
module.exports={DiscordPresence,frame,activityFor,handleDesktop};
