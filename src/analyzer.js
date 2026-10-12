'use strict';
const RULES = [
  ['abstraction', '抽象与问题分解', ['多个脚本', '定义自定义积木', '带参数的自定义积木']],
  ['parallelism', '并行性', ['同一事件启动两个脚本', '同一事件启动三个脚本', '多角色响应同一事件']],
  ['logic', '逻辑思维', ['使用条件判断', '使用 if-else 或逻辑运算', '条件嵌套或复合逻辑']],
  ['synchronization', '同步性', ['等待', '广播或接收广播', '广播并等待或条件等待']],
  ['flow', '流程控制', ['顺序执行', '重复或无限循环', '条件循环或循环嵌套']],
  ['interaction', '用户交互', ['绿旗启动', '键盘、点击、询问或鼠标输入', '视频或音量输入']],
  ['data', '数据表示', ['修改角色属性', '使用变量', '使用列表']]
];
function analyze(project) {
  if (!project || !Array.isArray(project.targets) || !project.targets.length || project.targets.length > 500) throw new Error('project.json 必须包含 1–500 个 targets');
  let prototypes=[], all=[], scripts=[], sprites=[], variables=0, lists=0, comments=0, unreachable=0;
  const warnings=[];
  for (const [ti,t] of project.targets.entries()) {
    if (!t || typeof t.name!=='string' || !t.blocks || typeof t.blocks!=='object' || Array.isArray(t.blocks)) throw new Error('角色数据或 blocks 格式不正确');
    const blocks=t.blocks, entries=Object.entries(blocks);
    if(entries.length>100000) throw new Error('单个角色积木过多');
    prototypes.push(...entries.map(([,b])=>b).filter(b=>b&&b.opcode==='procedures_prototype'));
    const active=entries.filter(([,b])=>b && typeof b==='object' && !Array.isArray(b) && typeof b.opcode==='string' && !b.shadow);
    const ids=new Set(active.map(([id])=>id));
    const roots=active.filter(([,b])=>b.topLevel && !b.parent);
    const reached=new Set();
    const walk=(id)=>{ const pending=[id]; while(pending.length){const cur=pending.pop(); if(reached.has(cur))continue; const b=blocks[cur]; if(!b || typeof b!=='object' || Array.isArray(b))continue; reached.add(cur); if(typeof b.next==='string')pending.push(b.next); for(const v of Object.values(b.inputs||{})){if(Array.isArray(v))for(const x of v.slice(1))if(typeof x==='string' && blocks[x])pending.push(x);} } };
    for(const [id,b] of roots){walk(id);scripts.push({target:ti,id,opcode:b.opcode,fields:b.fields||{},length:0});}
    unreachable+=active.filter(([id])=>!reached.has(id)).length;
    variables+=Object.keys(t.variables||{}).length; lists+=Object.keys(t.lists||{}).length; comments+=Object.keys(t.comments||{}).length;
    for(const [id,b] of active) {
      all.push({...b,id,target:ti,name:t.name});
      if(b.next && !blocks[b.next])warnings.push(`${t.name}: 积木 ${id} 的 next 引用不存在`);
      if(b.parent && !blocks[b.parent])warnings.push(`${t.name}: 积木 ${id} 的 parent 引用不存在`);
    }
    sprites.push({name:t.name,isStage:!!t.isStage,blocks:ids.size,scripts:roots.length,variables:Object.keys(t.variables||{}).length,lists:Object.keys(t.lists||{}).length,costumes:(t.costumes||[]).length,sounds:(t.sounds||[]).length});
  }
  if(all.length>200000)throw new Error('项目积木总数过多');
  const ops=new Set(all.map(b=>b.opcode)), has=(...o)=>o.some(x=>ops.has(x));
  const evidence=(o)=>all.filter(b=>o.includes(b.opcode)).slice(0,8).map(b=>({target:b.name,blockId:b.id,opcode:b.opcode}));
  const ancestors=(b,filter)=>{const seen=new Set([b.id]);let p=b.parent;while(typeof p==='string'&&!seen.has(p)){seen.add(p);const a=project.targets[b.target].blocks[p];if(!a||Array.isArray(a))break;if(filter(a.opcode))return true;p=a.parent;}return false;};
  const conditional=o=>['control_if','control_if_else'].includes(o), loop=o=>['control_repeat','control_forever','control_repeat_until','control_while'].includes(o);
  const eventGroups=new Map();
  for(const s of scripts){if(!/^(event_when|control_start_as_clone)/.test(s.opcode))continue;const key=s.opcode+':'+JSON.stringify(Object.entries(s.fields).sort());if(!eventGroups.has(key))eventGroups.set(key,[]);eventGroups.get(key).push(s);}
  const groups=[...eventGroups.values()];
  const param=prototypes.some(b=>{try{return JSON.parse(b.mutation?.argumentnames||'[]').length>0;}catch{return false;}});
  const conditions={
    abstraction:[scripts.length>=2,has('procedures_definition'),param],
    parallelism:[groups.some(g=>g.length>=2),groups.some(g=>g.length>=3),groups.some(g=>g.length>=3&&new Set(g.map(s=>s.target)).size>=2)],
    logic:[has('control_if','control_if_else'),has('control_if_else','operator_and','operator_or','operator_not'),all.some(b=>conditional(b.opcode)&&ancestors(b,conditional))||all.some(b=>['operator_and','operator_or','operator_not'].includes(b.opcode)&&ancestors(b,o=>['operator_and','operator_or','operator_not'].includes(o)))],
    synchronization:[has('control_wait'),has('event_broadcast','event_whenbroadcastreceived'),has('event_broadcastandwait','control_wait_until')],
    flow:[all.some(b=>typeof b.next==='string'&&project.targets[b.target].blocks[b.next]),has('control_repeat','control_forever'),has('control_repeat_until','control_while')||all.some(b=>loop(b.opcode)&&ancestors(b,loop))],
    interaction:[has('event_whenflagclicked'),has('event_whenkeypressed','event_whenthisspriteclicked','event_whenstageclicked','sensing_askandwait','sensing_keypressed','sensing_mousedown','sensing_mousex','sensing_mousey'),has('videoSensing_videoOn','videoSensing_whenMotionGreaterThan','sensing_loudness')],
    data:[all.some(b=>/^(motion_|looks_(set|change)|sound_(set|change))/.test(b.opcode)),has('data_setvariableto','data_changevariableby','data_variable'),all.some(b=>/^data_(addtolist|deleteoflist|deletealloflist|insertatlist|replaceitemoflist|itemoflist|itemnumoflist|lengthoflist|listcontainsitem|showlist|hidelist)$/.test(b.opcode))]
  };
  const related={abstraction:['procedures_definition','procedures_prototype'],parallelism:[...ops].filter(o=>o.startsWith('event_when')),logic:['control_if','control_if_else','operator_and','operator_or','operator_not'],synchronization:['control_wait','event_broadcast','event_whenbroadcastreceived','event_broadcastandwait','control_wait_until'],flow:['control_repeat','control_forever','control_repeat_until','control_while'],interaction:[...ops].filter(o=>/^(event_when|sensing_|videoSensing_)/.test(o)),data:[...ops].filter(o=>/^(data_|motion_|looks_(set|change)|sound_(set|change))/.test(o))};
  const dimensions=RULES.map(([key,name,levels])=>{const matched=conditions[key];const score=matched.lastIndexOf(true)+1;return {key,name,score,max:3,levels:levels.map((rule,i)=>({level:i+1,rule,matched:matched[i]})),evidence:evidence(related[key])};});
  const histogram={};for(const b of all){const c=b.opcode.split('_')[0];histogram[c]=(histogram[c]||0)+1;}
  const emptyScripts= scripts.filter(s=>{const b=project.targets[s.target].blocks[s.id];return /^event_when/.test(b.opcode)&&!b.next;}).length;
  const duplicateGroups=new Map();
  for(const s of scripts){const t=project.targets[s.target],seen=new Set(),seq=[];let id=s.id;while(id&&!seen.has(id)){seen.add(id);const b=t.blocks[id];if(!b||!b.opcode)break;seq.push({opcode:b.opcode,fields:b.fields,inputs:Object.fromEntries(Object.entries(b.inputs||{}).map(([k,v])=>[k,Array.isArray(v)?v.map(x=>typeof x==='string'&&t.blocks[x]?'[block]':x):v]))});id=b.next;}if(seq.length>=3){const k=JSON.stringify(seq);duplicateGroups.set(k,(duplicateGroups.get(k)||0)+1);}}
  const duplicateScripts=[...duplicateGroups.values()].reduce((n,v)=>n+Math.max(0,v-1),0);
  const suggestions=dimensions.filter(d=>d.score<3).map(d=>`${d.name}：可尝试${d.levels[d.score].rule}，并结合项目需求选择，避免仅为得分添加积木。`);
  if(emptyScripts)suggestions.push(`发现 ${emptyScripts} 个空事件脚本，可以删除或补充处理逻辑。`);
  if(duplicateScripts)suggestions.push(`发现 ${duplicateScripts} 个疑似重复的主链脚本，建议人工检查并提取自定义积木。`);
  if(unreachable)suggestions.push(`发现 ${unreachable} 个无法从顶层脚本访问的积木，建议检查连接关系。`);
  return {schemaVersion:1,ruleVersion:'course-1.0',score:dimensions.reduce((n,d)=>n+d.score,0),maxScore:21,dimensions,metrics:{sprites:sprites.filter(t=>!t.isStage).length,targets:sprites.length,blocks:all.length,scripts:scripts.length,variables,lists,comments,customBlocks:all.filter(b=>b.opcode==='procedures_definition').length,emptyScripts,duplicateScripts,unreachable,histogram},targets:sprites,suggestions,warnings:warnings.slice(0,100),note:'参考 Dr. Scratch 七维模型的静态分析；规则为本项目公开的课程实现，并非官方评分。分数不等同于学习者能力或程序运行正确性。'};
}
module.exports={analyze,RULES};
