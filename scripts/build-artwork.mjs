import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const size=512,raw=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const px=x/8,py=y/8,cx=Math.max(14-px,0,px-49),cy=Math.max(14-py,0,py-49),inside=cx*cx+cy*cy<196,t=(px+py)/126;
 let r=48-27*t,g=33-17*t,b=63-34*t,a=inside?255:0;
 for(const [center,height]of[[14,12],[23,24],[32,36],[41,24],[50,12]]){const dx=px-center,dy=Math.max(32-height/2-py,0,py-(32+height/2));if(dx*dx+dy*dy<6.25){r=198;g=164;b=250;}}
 const index=y*(size*4+1)+1+x*4;raw[index]=r;raw[index+1]=g;raw[index+2]=b;raw[index+3]=a;
}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
writeFileSync('src/artwork.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
