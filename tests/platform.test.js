const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {createPlatform}=require('../src/platform');
test('teaching workflow, isolation, idempotency, retry and comparison',async()=>{
 const mailbox=new Map();const app=createPlatform(':memory:',{secret:'test-secret-at-least-32-characters-long',sendMail:async m=>mailbox.set(m.email,m.code)}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function request(p,{cookie,body,headers={},form}={}){const r=await fetch(base+'/api'+p,{method:body!==undefined||form?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:form|| (body!==undefined?JSON.stringify(body):undefined)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function account(email,role){assert.equal((await request('/auth/email-code',{body:{email,purpose:'register'}})).status,200);assert.equal((await request('/auth/register',{body:{email,name:email,role,password:'password123',code:mailbox.get(email)}})).status,201);return (await request('/auth/login',{body:{email,password:'password123'}})).cookie;}
 try{
 const teacher=await account('teacher@test.com','teacher'),student=await account('one@test.com','student'),other=await account('two@test.com','student'),outsider=await account('outsider@test.com','teacher');
 assert.equal((await request('/classes')).status,401);assert.equal((await request('/classes',{cookie:student,body:{name:'forbidden'}})).status,403);
 const cid=(await request('/classes',{cookie:teacher,body:{name:'课程一'}})).data.id;const code=(await request('/classes',{cookie:teacher})).data[0].code;
 for(const cookie of [student,other])assert.equal((await request('/classes/join',{cookie,body:{code}})).status,200);
 const aid=(await request(`/classes/${cid}/assignments`,{cookie:teacher,body:{title:'事件与循环',description:'提交一个作品'}})).data.id;
 assert.equal((await request(`/classes/${cid}/assignments`,{cookie:outsider})).status,404);
 async function upload(token,bytes=fs.readFileSync(path.join(__dirname,'../examples/demo.sb3'))){const f=new FormData();f.append('file',new Blob([bytes]),'demo.sb3');return request(`/assignments/${aid}/submissions`,{cookie:student,headers:{'Idempotency-Key':token},form:f});}
 const first=await upload('one');assert.equal(first.status,202);assert.equal((await upload('one')).data.id,first.data.id);
 async function wait(id){for(let i=0;i<100;i++){const d=await request('/submissions/'+id,{cookie:student});if(['succeeded','failed'].includes(d.data.status))return d.data;await new Promise(r=>setTimeout(r,50));}throw Error('analysis did not complete');}
 const r=await wait(first.data.id);assert.equal(r.status,'succeeded');assert.equal(r.report.score,11);
 assert.equal((await request('/submissions/'+r.id,{cookie:other})).status,404);
 assert.equal((await request(`/submissions/${r.id}/reviews`,{cookie:student,body:{status:'approved',comment:'bad'}})).status,403);
 assert.equal((await request(`/submissions/${r.id}/reviews`,{cookie:teacher,body:{status:'changes_requested',comment:'补充条件判断'}})).status,201);
 assert.equal((await request('/submissions/'+r.id,{cookie:student})).data.reviews.length,1);
 const second=await upload('two');await wait(second.data.id);const c=await request(`/compare?left=${r.id}&right=${second.data.id}`,{cookie:student});assert.equal(c.status,200);assert.equal(c.data.scoreDelta,0);
 assert.equal((await request(`/compare?left=${r.id}&right=${second.data.id}`,{cookie:other})).status,404);
 const bad=await upload('bad',Buffer.from('invalid'));assert.equal((await wait(bad.data.id)).status,'failed');assert.equal((await request(`/submissions/${bad.data.id}/retry`,{cookie:student,body:{}})).status,200);assert.equal((await wait(bad.data.id)).status,'failed');
 assert.equal((await request(`/submissions/${r.id}/retry`,{cookie:student,body:{}})).status,409);
 const changed={...r.report,ruleVersion:'other'};app.locals.db.prepare('UPDATE submissions SET report=? WHERE id=?').run(JSON.stringify(changed),second.data.id);assert.equal((await request(`/compare?left=${r.id}&right=${second.data.id}`,{cookie:student})).status,409);
 await request('/logout',{cookie:student,body:{}});assert.equal((await request('/me',{cookie:student})).status,401);
 }finally{await new Promise(r=>server.close(r));app.locals.close();}
});
