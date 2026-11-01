import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
for(const file of ['README.md','README.en.md']){
 const text=fs.readFileSync(file,'utf8');
 for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1];if(/^(https?:|#)/.test(target))continue;
  assert(fs.existsSync(path.resolve(path.dirname(file),target.split('#')[0])),`${file}: missing ${target}`);
 }
 assert(text.includes('docs/images/banner.png'));
}
for(const image of ['banner.png','home.jpg','equalizer.jpg','catalog.jpg']){
 const bytes=fs.readFileSync(`docs/images/${image}`);assert(bytes.length>5000);
 assert(image.endsWith('.png')?bytes.readUInt32BE(0)===0x89504e47:bytes.readUInt16BE(0)===0xffd8);
}
assert(!fs.existsSync('.openai'));
assert(!fs.existsSync('data'));
console.log('Documentation links and required image assets verified.');
