const {parentPort,workerData}=require('node:worker_threads');
const {readProject}=require('./archive');const {analyze}=require('./analyzer');
(async()=>{try{parentPort.postMessage({report:analyze(await readProject(Buffer.from(workerData)))});}catch(e){parentPort.postMessage({error:e.message});}})();
