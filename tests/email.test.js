const {test}=require('node:test'),assert=require('node:assert/strict');const {createPlatform}=require('../src/platform');
test('email registration/reset, limits, expiry, replay and session revocation',async()=>{
 let time=Date.now(),deliveryError=false;const sent=[];const app=createPlatform(':memory:',{secret:'testing-secret-32-characters-or-more',now:()=>time,sendMail:async m=>{if(deliveryError)throw Object.assign(Error('发送失败'),{status:502});sent.push(m);}});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(p,body,cookie){const r=await fetch(base+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const email='student@example.com',registration={email,name:'学生',role:'student',password:'oldpassword'};
 try{
 assert.equal((await call('/auth/register',registration)).status,400);
 const issue=await call('/auth/email-code',{email,purpose:'register'});assert.equal(issue.status,200);assert.ok(!JSON.stringify(issue.body).includes(sent.at(-1).code));const first=sent.at(-1).code;
 assert.equal((await call('/auth/email-code',{email,purpose:'register'})).status,429);
 const row=app.locals.db.prepare('SELECT * FROM email_codes').get();assert.notEqual(row.digest,first);
 assert.equal((await call('/auth/register',{...registration,code:'bad'})).status,400);
 assert.equal((await call('/auth/register',{...registration,code:first})).status,201);
 assert.equal((await call('/auth/register',{...registration,code:first})).status,400);
 const login=await call('/auth/login',{email,password:'oldpassword'});assert.equal(login.status,200);
 time+=61000;await call('/auth/email-code',{email,purpose:'reset'});const reset=sent.at(-1).code;
 assert.equal((await call('/auth/reset-password',{email,password:'newpassword',code:first})).status,400);
 assert.equal((await call('/auth/reset-password',{email,password:'newpassword',code:reset})).status,200);
 assert.equal((await call('/me',null,login.cookie)).status,401);
 assert.equal((await call('/auth/login',{email,password:'oldpassword'})).status,401);
 assert.equal((await call('/auth/login',{email,password:'newpassword'})).status,200);
 assert.equal((await call('/auth/reset-password',{email,password:'otherpassword',code:reset})).status,400);
 time+=61000;await call('/auth/email-code',{email,purpose:'reset'});const expired=sent.at(-1).code;time+=300001;
 assert.equal((await call('/auth/reset-password',{email,password:'anotherpassword',code:expired})).status,400);
 await call('/auth/email-code',{email,purpose:'reset'});const locked=sent.at(-1).code;
 for(let i=0;i<5;i++)assert.equal((await call('/auth/reset-password',{email,password:'anotherpassword',code:'invalid'})).status,400);
 assert.equal((await call('/auth/reset-password',{email,password:'anotherpassword',code:locked})).status,400);
 const n=sent.length;assert.equal((await call('/auth/email-code',{email:'missing@example.com',purpose:'reset'})).status,200);assert.equal(sent.length,n);
 deliveryError=true;assert.equal((await call('/auth/email-code',{email:'fail@example.com',purpose:'register'})).status,502);assert.equal(app.locals.db.prepare('SELECT * FROM email_codes WHERE email=?').get('fail@example.com'),undefined);
 }finally{await new Promise(r=>server.close(r));app.locals.close();}
});
