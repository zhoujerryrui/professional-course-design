const crypto=require('node:crypto');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function normalizeEmail(value){if(typeof value!=='string'||value.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw fail(400,'请输入有效邮箱');return value.trim().toLowerCase();}
async function sendMail({email,code,purpose}){
 if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM)throw fail(503,'邮件服务尚未配置，请联系管理员');
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:[email],subject:purpose==='register'?'Scratch 注册验证码':'Scratch 密码重置验证码',text:`您的${purpose==='register'?'注册':'密码重置'}验证码是：${code}。5 分钟内有效，请勿向他人提供。如非本人操作，请忽略。`})});if(!r.ok)throw Error('delivery rejected');}catch{throw fail(502,'邮件发送未成功，请稍后重试');}
}
function verification(db,options={}){
 const key=options.secret||process.env.EMAIL_CODE_SECRET;const mail=options.sendMail||sendMail;const now=options.now||Date.now;
 db.exec(`CREATE TABLE IF NOT EXISTS email_codes(email TEXT,purpose TEXT,digest TEXT,nonce TEXT,expires INTEGER,attempts INTEGER,status TEXT,PRIMARY KEY(email,purpose));CREATE TABLE IF NOT EXISTS email_sends(email TEXT,ip TEXT,at INTEGER);CREATE INDEX IF NOT EXISTS email_send_time ON email_sends(at);`);
 const digest=(email,purpose,nonce,code)=>crypto.createHmac('sha256',key).update(JSON.stringify([email,purpose,nonce,code])).digest('hex');
 function ready(){if(!key||key.length<32)throw fail(503,'邮箱验证服务尚未配置');}
 async function issue(raw,purpose,ip){ready();const email=normalizeEmail(raw);if(!['register','reset'].includes(purpose))throw fail(400,'验证码用途无效');const t=now();
 db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM email_sends WHERE at<?').run(t-86400000);const sends=db.prepare('SELECT * FROM email_sends').all();if(sends.some(s=>s.email===email&&s.at>t-60000)||sends.filter(s=>s.email===email&&s.at>t-3600000).length>=5||sends.filter(s=>s.ip===ip&&s.at>t-3600000).length>=20||sends.filter(s=>s.at>t-3600000).length>=200)throw fail(429,'发送过于频繁，请稍后重试');db.prepare('INSERT INTO email_sends VALUES(?,?,?)').run(email,ip,t);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const exists=!!db.prepare('SELECT id FROM users WHERE email=?').get(email);const applicable=purpose==='register'?!exists:exists;
 if(applicable){const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'),nonce=crypto.randomBytes(16).toString('hex');db.prepare("INSERT OR REPLACE INTO email_codes VALUES(?,?,?,?,?,0,'sending')").run(email,purpose,digest(email,purpose,nonce,code),nonce,t+300000);
 try{await mail({email,code,purpose});db.prepare("UPDATE email_codes SET status='ready' WHERE email=? AND purpose=? AND nonce=?").run(email,purpose,nonce);}catch(e){db.prepare('DELETE FROM email_codes WHERE email=? AND purpose=? AND nonce=?').run(email,purpose,nonce);throw e;}}
 return {message:'若邮箱符合条件，验证码将发送至该邮箱，请检查收件箱和垃圾邮件。',retryAfter:60};
 }
 // Verify and account mutation run synchronously in one SQLite transaction.
 function consume(email,purpose,code,action){ready();db.exec('BEGIN IMMEDIATE');let invalid=false;try{const row=db.prepare('SELECT * FROM email_codes WHERE email=? AND purpose=?').get(email,purpose);if(!row||row.status!=='ready'||row.expires<=now()||row.attempts>=5){invalid=true;}else{db.prepare('UPDATE email_codes SET attempts=attempts+1 WHERE email=? AND purpose=?').run(email,purpose);const actual=digest(email,purpose,row.nonce,typeof code==='string'?code:'');invalid=!crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(row.digest,'hex'));}
 if(invalid){db.exec('COMMIT');throw fail(400,'验证码错误、已过期或尝试次数已用完');}
 action();db.prepare('DELETE FROM email_codes WHERE email=? AND purpose=?').run(email,purpose);db.exec('COMMIT');
 }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}}
 return {issue,consume};
}
module.exports={verification,normalizeEmail};
