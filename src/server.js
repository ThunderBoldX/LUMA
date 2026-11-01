const HTML="__LUMA_HTML__";
const ARTWORK="__LUMA_ARTWORK_PNG__";
const streams={"kiss":["https://online.kissfm.ua/KissFM_HD","https://online.kissfm.ua/KissFM"],"ukr":["https://online.kissfm.ua/KissFM_Ukr"],"deep":["https://online.kissfm.ua/KissFM_Deep"],"digital":["https://online.kissfm.ua/KissFM_Digital"],"hitfm":["https://online.hitfm.ua/HitFM_HD","https://online.hitfm.ua/HitFM"],"roks":["https://online.radioroks.ua/RadioROKS_HD","https://online.radioroks.ua/RadioROKS"],"luxfm":["https://icecast.luxnet.ua/lux_hd","https://icecast.luxnet.ua/lux"],"nrj":["https://cast.mediaonline.net.ua/nrj320","https://cast.mediaonline.net.ua/nrj"],"voice":["https://live-bauerdk.sharp-stream.com/thevoice_dk_mp3"],"nova":["https://live-bauerdk.sharp-stream.com/nova_dk_mp3"],"soft":["https://live-bauerdk.sharp-stream.com/radiosoft_dk_mp3"],"avtoradio":["https://cast.mediaonline.net.ua/avtoradio320","https://cast.mediaonline.net.ua/avtoradio"],"perec":["https://radio.perec.fm/radio-stilnoe"],"maximum":["https://icecast.luxnet.ua/maximum_hd","https://icecast.luxnet.ua/maximum"],"trap":["https://stream.laut.fm/trap"],"trancebase":["https://listen.trancebase.fm/tunein-mp3","https://listen.trancebase.fm/tunein-aac-hd"],"hardbase":["https://listen.hardbase.fm/tunein-mp3","https://listen.hardbase.fm/tunein-aac-hd"],"technobase":["https://listen.technobase.fm/tunein-mp3","https://listen.technobase.fm/tunein-aac-hd"],"dubstep":["https://ice5.somafm.com/dubstep-256-mp3","https://ice6.somafm.com/dubstep-256-mp3"]};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
async function openStream(id,options={}){
 let lastError;
 for(const address of streams[id]||[]){try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  let response;try{response=await fetch(address,{...options,signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal});}finally{clearTimeout(timer);}
  const type=response.headers.get('content-type')||'';
  if(response.ok&&response.body&&/^(audio\/|application\/octet-stream)/i.test(type))return response;
  await response.body?.cancel();lastError=new Error('Потік недоступний');
 }catch(error){lastError=error;if(options.signal?.aborted)throw error;}}
 throw lastError||new Error('Невідома станція');
}
export default {async fetch(request,env){const url=new URL(request.url);try{
 if(url.pathname==='/artwork.png')return new Response(Uint8Array.from(atob(ARTWORK),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'}});
 if(url.pathname==='/api/presence')return json({supported:false,enabled:false,message:'Rich Presence доступний у Windows-версії LUMA.'});
 if(url.pathname==='/api/stream'){
  const stream=streams[url.searchParams.get('station')];if(!stream)return json({error:'Невідома станція'},404);
  const response=await openStream(url.searchParams.get('station'),{signal:request.signal,headers:{'User-Agent':'LUMA-Radio/1.0'}});
  if(!response.ok||!response.body)return json({error:'Радіопотік тимчасово недоступний'},502);
  return new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type')||'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(url.pathname==='/api/now'){
  const id=url.searchParams.get('station')||'kiss';if(!streams[id])return json({track:null,reason:'custom'});
  const response=await openStream(id,{headers:{'Icy-MetaData':'1'},signal:AbortSignal.timeout(7000)});
  const interval=Number(response.headers.get('icy-metaint'));let raw='';
  if(interval>0&&interval<262144&&response.body){const reader=response.body.getReader();try{let data=new Uint8Array(0);while(data.length<interval+1+4080){const r=await reader.read();if(r.done)break;const next=new Uint8Array(data.length+r.value.length);next.set(data);next.set(r.value,data.length);data=next;if(data.length>interval){const len=data[interval]*16;if(data.length>=interval+1+len){raw=new TextDecoder().decode(data.slice(interval+1,interval+1+len));break;}}}}finally{await reader.cancel();}}
  else await response.body?.cancel();
  let name=raw.match(/StreamTitle='([^']*)'/)?.[1];
  const metadataSites={kiss:'https://www.kissfm.ua/',hitfm:'https://www.hitfm.ua/',roks:'https://www.radioroks.ua/'};
  if(!name&&metadataSites[id]){
   const page=await fetch(metadataSites[id],{signal:AbortSignal.timeout(7000),headers:{'Cache-Control':'no-cache'}});const html=await page.text();
   const anchor=html.match(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*(?:🔊|&#128266;)(?:(?!<\/a>)[\s\S])*<\/a>/u)?.[0];
   if(anchor)name=clean(anchor).replace(/^🔊\s*/u,'');
  }
  if(!name||/KISS\.CLUB\.MIX|The Best Dance Radio|Хіт FM\s*[—–-]\s*Тільки хіти|Radio ROKS\s*[—–-]\s*Рок/i.test(name))return json({track:null,checkedAt:Date.now()});
  const parts=clean(name).split(/\s+[—–-]\s+/);if(parts.length<2)return json({track:null,checkedAt:Date.now()});
  return json({track:{artist:parts.shift(),title:parts.join(' — '),source:'radio',station:id,observedAt:Date.now()},checkedAt:Date.now()});
 }
 if(url.pathname==='/api/recognize'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Недозволений запит'},403);
  if(Number(request.headers.get('content-length')||0)>3000000)return json({error:'Завеликий аудіофайл'},413);
  const data=await request.formData();const token=String(data.get('token')||env?.AUDD_API_TOKEN||'').trim();
  if(!token)return json({error:'Додай API-ключ AudD у налаштуваннях розпізнавання.',code:'KEY_REQUIRED'},428);
  const file=data.get('file');if(!file||typeof file==='string'||file.size>2500000||file.size<1000)return json({error:'Не вдалося отримати аудіофрагмент'},400);
  const form=new FormData();form.set('api_token',token);form.set('file',file,file.name||'radio.webm');form.set('return','apple_music,spotify');
  const response=await fetch('https://api.audd.io/',{method:'POST',body:form,signal:AbortSignal.timeout(25000)});const result=await response.json();
  if(result.status!=='success')return json({error:result.error?.error_message||'Сервіс розпізнавання недоступний'},502);
  const r=result.result;return json({track:r?{artist:r.artist,title:r.title,source:'recognition',observedAt:Date.now(),link:r.song_link}:null});
 }
 if(url.pathname==='/icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="48" fill="#171122"/><path d="M43 114V78m26 63V51m27 104V37m27 104V51m26 63V78" stroke="#b99aff" stroke-width="12" stroke-linecap="round"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});
 if(url.pathname==='/manifest.webmanifest')return json({name:'LUMA',short_name:'LUMA',lang:'uk',start_url:'/',display:'standalone',background_color:'#100e15',theme_color:'#100e15',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]});
 if(url.pathname!=='/')return new Response('Not found',{status:404});
 return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }catch(error){return json({error:'Не вдалося з’єднатися з джерелом. Спробуй ще раз.'},502);}}};
