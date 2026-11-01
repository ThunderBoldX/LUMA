import {writeFileSync} from 'node:fs';
const size=64,pixels=Buffer.alloc(size*size*4),mask=Buffer.alloc(size*size/8);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const cornerX=Math.max(14-x,0,x-49),cornerY=Math.max(14-y,0,y-49);
 const inside=cornerX*cornerX+cornerY*cornerY<196;
 const t=(x+y)/126;let r=48-27*t,g=33-17*t,b=63-34*t,a=inside?255:0;
 for(const [cx,h]of[[14,12],[23,24],[32,36],[41,24],[50,12]]){const dx=x-cx,dy=Math.max(32-h/2-y,0,y-(32+h/2));if(dx*dx+dy*dy<6.25){r=198;g=164;b=250;}}
 const i=((size-1-y)*size+x)*4;pixels[i]=b;pixels[i+1]=g;pixels[i+2]=r;pixels[i+3]=a;
 if(!inside)mask[(size-1-y)*8+Math.floor(x/8)]|=128>>(x%8);
}
const dib=Buffer.alloc(40);dib.writeUInt32LE(40);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(pixels.length,20);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=size;header[7]=size;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(dib.length+pixels.length+mask.length,14);header.writeUInt32LE(22,18);
writeFileSync('release/LUMA/LUMA.ico',Buffer.concat([header,dib,pixels,mask]));
