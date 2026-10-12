'use strict';
const express=require('express'),multer=require('multer'),path=require('node:path'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {analyze}=require('./analyzer'),{readProject}=require('./archive');
function createApp(dbPath=process.env.DB_PATH||path.join(__dirname,'../data/analysis.db')){
 if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS analyses(id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL, created_at TEXT NOT NULL, score INTEGER NOT NULL, report TEXT NOT NULL)');
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store'});next();});
 app.get('/api/health',(req,res)=>{db.prepare('SELECT 1').get();res.json({status:'ok'});});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024,files:1,fields:0}});
 app.post('/api/analyze',upload.single('file'),async(req,res,next)=>{try{
  if(!req.file||!req.file.originalname.toLowerCase().endsWith('.sb3'))return res.status(400).json({error:'请上传 .sb3 文件（最大 20 MB）'});
  const report=analyze(await readProject(req.file.buffer)),filename=path.basename(req.file.originalname).slice(0,200),created_at=new Date().toISOString();
  const r=db.prepare('INSERT INTO analyses(filename,created_at,score,report) VALUES(?,?,?,?)').run(filename,created_at,report.score,JSON.stringify(report));
  res.json({id:Number(r.lastInsertRowid),filename,created_at,...report});
 }catch(e){next(e);}});
 app.get('/api/history',(req,res)=>res.json(db.prepare('SELECT id,filename,created_at,score FROM analyses ORDER BY id DESC LIMIT 100').all()));
 app.get('/api/history/:id',(req,res)=>{const row=db.prepare('SELECT * FROM analyses WHERE id=?').get(req.params.id);if(!row)return res.status(404).json({error:'记录不存在'});res.json({id:row.id,filename:row.filename,created_at:row.created_at,...JSON.parse(row.report)});});
 app.delete('/api/history/:id',(req,res)=>{if(!db.prepare('DELETE FROM analyses WHERE id=?').run(req.params.id).changes)return res.status(404).json({error:'记录不存在'});res.json({deleted:true});});
 app.get('/api/example',(req,res)=>res.download(path.join(__dirname,'../examples/demo.sb3'),'demo.sb3'));
 app.use(express.static(path.join(__dirname,'../public')));
 app.use((err,req,res,next)=>{res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({error:err.code==='LIMIT_FILE_SIZE'?'文件超过 20 MB 限制':err.message||'请求失败'});});
 app.locals.db=db;return app;
}
if(require.main===module){const app=createApp();app.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Scratch 分析系统已启动，端口 '+(process.env.PORT||3000)));}
module.exports={createApp};
