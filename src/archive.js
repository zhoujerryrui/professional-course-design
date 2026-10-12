'use strict';
const yauzl=require('yauzl');
const MAX_JSON=8*1024*1024;
function readProject(buffer){return new Promise((resolve,reject)=>{
 yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(err,zip)=>{
  if(err)return reject(new Error('无法读取 sb3 ZIP 文件'));
  let count=0,found=false,project,done=false;
  const fail=e=>{if(done)return;done=true;zip.close();reject(new Error(e.message||String(e)));};
  zip.on('error',fail);
  zip.on('end',()=>{if(done)return;done=true;if(!found)reject(new Error('sb3 缺少根目录 project.json'));else resolve(project);});
  zip.on('entry',entry=>{
   if(++count>10000)return fail(new Error('压缩包文件数量超过限制'));
   if(entry.fileName!=='project.json')return zip.readEntry();
   if(found)return fail(new Error('重复的 project.json')); found=true;
   if(entry.uncompressedSize>MAX_JSON)return fail(new Error('project.json 解压大小超过 8 MB'));
   if(entry.generalPurposeBitFlag&1)return fail(new Error('不支持加密项目'));
   zip.openReadStream(entry,(e,stream)=>{if(e)return fail(e);const chunks=[];let size=0;
    stream.on('error',fail);stream.on('data',c=>{size+=c.length;if(size>MAX_JSON){stream.destroy();fail(new Error('project.json 过大'));}else chunks.push(c);});
    stream.on('end',()=>{if(done)return;try{project=JSON.parse(Buffer.concat(chunks).toString('utf8'));zip.readEntry();}catch{fail(new Error('project.json 不是有效的 JSON'));}});
   });
  });zip.readEntry();
 });
});}
module.exports={readProject};
