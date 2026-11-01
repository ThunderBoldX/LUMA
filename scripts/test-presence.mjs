import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {DiscordPresence,frame,activityFor,handleDesktop}=require('../src/discord-presence.cjs');
let now=1000000,socket,pipe;
class Socket extends EventEmitter{constructor(){super();this.frames=[];}write(buffer){assert.equal(buffer.readUInt32LE(4),buffer.length-8);this.frames.push({op:buffer.readUInt32LE(),data:JSON.parse(buffer.subarray(8).toString())});}destroy(){queueMicrotask(()=>this.emit('close'));}}
const presence=new DiscordPresence({clock:()=>now,autoStart:false,connect:options=>{pipe=options.path;socket=new Socket();queueMicrotask(()=>socket.emit('connect'));return socket;}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const req=(route,body,origin='http://127.0.0.1:4173')=>new Request('http://127.0.0.1:4173'+route,body===undefined?{}:{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
try{
 assert.equal((await handleDesktop(req('/api/presence'),presence)).status,200);
 assert.equal((await handleDesktop(req('/api/presence',{enabled:true,clientId:'fake'}),presence)).status,400);
 assert.equal((await handleDesktop(req('/api/presence',{enabled:true,clientId:'123456789012345678'},'https://untrusted.test'),presence)).status,403);
 presence.configure({enabled:true,clientId:'123456789012345678',assetKey:'luma'});await settle();assert.equal(pipe,'\\\\?\\pipe\\discord-ipc-0');assert.equal(socket.frames[0].op,0);assert.equal(socket.frames[0].data.client_id,'123456789012345678');
 presence.update({playing:true,station:'HardBase.FM',artist:'Artist',title:'Track'});
 const ready=frame(1,{cmd:'DISPATCH',evt:'READY'});socket.emit('data',ready.subarray(0,5));assert.equal(presence.ready,false);socket.emit('data',ready.subarray(5));assert.equal(presence.ready,true);
 let sent=socket.frames.at(-1);assert.equal(sent.data.cmd,'SET_ACTIVITY');assert.equal(sent.data.args.activity.type,2);assert.equal(sent.data.args.activity.details,'HardBase.FM');assert.equal(sent.data.args.activity.state,'Artist — Track');assert.equal(sent.data.args.activity.assets.large_image,'luma');
 socket.emit('data',frame(1,{cmd:'SET_ACTIVITY',nonce:sent.data.nonce,data:{}}));assert.equal(presence.status().published.details,'HardBase.FM');
 const count=socket.frames.length;presence.update({playing:true,station:'HardBase.FM',artist:'Other',title:'Track 2'});assert.equal(socket.frames.length,count);now+=8000;presence.tick();sent=socket.frames.at(-1);assert.equal(sent.data.args.activity.state,'Other — Track 2');socket.emit('data',frame(1,{cmd:'SET_ACTIVITY',nonce:sent.data.nonce}));
 socket.emit('data',frame(3,{heartbeat:1}));assert.equal(socket.frames.at(-1).op,4);
 now+=21000;presence.tick();sent=socket.frames.at(-1);assert.equal(sent.data.args.activity,null);assert.equal(presence.nowPlaying().playing,false);socket.emit('data',frame(1,{cmd:'SET_ACTIVITY',nonce:sent.data.nonce}));
 assert.equal((await handleDesktop(req('/api/presence/activity',{playing:true,station:'Trap',artist:'A',title:'B'}),presence)).status,200);const state=await(await handleDesktop(req('/api/now-playing'),presence)).json();assert.equal(state.station,'Trap');assert.equal(state.title,'B');
 const overlay=await(await handleDesktop(req('/overlay'),presence)).text();assert.match(overlay,/background:transparent/);assert.match(overlay,/LUMA/);assert.match(overlay,/textContent/);
 assert.equal(activityFor({playing:false},'luma'),null);assert.equal((await handleDesktop(req('/api/presence',{enabled:false,clientId:'123456789012345678',assetKey:'luma'}),presence)).status,200);assert.equal(presence.ready,false);
 presence.configure({enabled:true,clientId:'123456789012345678',assetKey:'luma'});await settle();now+=11000;presence.tick();assert.equal(presence.socket,null);assert.match(presence.status().message,/Application ID/);
 console.log('PASS: Discord IPC handshake, partial frames, listening activity, acknowledgement, update throttling, ping/pong, stale-session clearing, Origin checks, settings validation, and OBS state. Live Discord display requires a registered Application ID.');
}finally{presence.close();}
