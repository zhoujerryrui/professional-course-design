"""Generate a valid Scratch 3 archive using only Python's standard library."""
import json, zipfile, hashlib
from pathlib import Path
root = Path(__file__).resolve().parents[1]
svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#4c936b"/><circle cx="37" cy="42" r="5" fill="white"/><circle cx="63" cy="42" r="5" fill="white"/><path d="M35 62 Q50 75 65 62" fill="none" stroke="white" stroke-width="4"/></svg>'
asset = hashlib.md5(svg.encode()).hexdigest()
def block(opcode, parent=None, next=None, inputs=None, fields=None, top=False):
    b = dict(opcode=opcode, next=next, parent=parent, inputs=inputs or {}, fields=fields or {}, shadow=False, topLevel=top)
    if top: b.update(x=50, y=50)
    return b
stage = dict(isStage=True, name='Stage', variables={}, lists={}, broadcasts={'msg':'开始'}, blocks={}, comments={}, currentCostume=0, costumes=[dict(assetId=asset,name='背景',bitmapResolution=1,md5ext=asset+'.svg',dataFormat='svg',rotationCenterX=50,rotationCenterY=50)], sounds=[], volume=100, layerOrder=0, tempo=60, videoTransparency=50, videoState='on', textToSpeechLanguage=None)
sprite = dict(isStage=False, name='探索者', variables={'score':['得分',0]}, lists={'log':['记录',[]]}, broadcasts={}, comments={}, currentCostume=0, costumes=[dict(assetId=asset,name='笑脸',bitmapResolution=1,md5ext=asset+'.svg',dataFormat='svg',rotationCenterX=50,rotationCenterY=50)], sounds=[], volume=100, layerOrder=1, visible=True, x=0,y=0,size=100,direction=90,draggable=False,rotationStyle='all around')
sprite['blocks'] = {
 'flag': block('event_whenflagclicked',next='init',top=True),
 'init': block('data_setvariableto',parent='flag',next='repeat',inputs={'VALUE':[1,[4,'0']]},fields={'VARIABLE':['得分','score']}),
 'repeat': block('control_repeat',parent='init',next='say',inputs={'TIMES':[1,[6,'5']],'SUBSTACK':[2,'move']}),
 'move': block('motion_movesteps',parent='repeat',next='add',inputs={'STEPS':[1,[4,'10']]}),
 'add': block('data_changevariableby',parent='move',inputs={'VALUE':[1,[4,'1']]},fields={'VARIABLE':['得分','score']}),
 'say': block('looks_say',parent='repeat',inputs={'MESSAGE':[1,[10,'探索完成！按空格记录得分']]}),
 'key': block('event_whenkeypressed',next='list',fields={'KEY_OPTION':['space',None]},top=True),
 'list': block('data_addtolist',parent='key',next='broadcast',inputs={'ITEM':[3,'scoreReporter',[10,'']]},fields={'LIST':['记录','log']}),
 'scoreReporter': block('data_variable',parent='list',fields={'VARIABLE':['得分','score']}),
 'broadcast': block('event_broadcastandwait',parent='list',inputs={'BROADCAST_INPUT':[1,'menu']}),
 'menu': dict(opcode='event_broadcast_menu',next=None,parent='broadcast',inputs={},fields={'BROADCAST_OPTION':['开始','msg']},shadow=True,topLevel=False),
 'receive': block('event_whenbroadcastreceived',next='wait',fields={'BROADCAST_OPTION':['开始','msg']},top=True),
 'wait': block('control_wait',parent='receive',inputs={'DURATION':[1,[5,'0.2']]})
}
project=dict(targets=[stage,sprite],monitors=[],extensions=[],meta={'semver':'3.0.0','vm':'11.1.0','agent':'Scratch Lens demo'})
root.joinpath('examples').mkdir(exist_ok=True)
with zipfile.ZipFile(root/'examples/demo.sb3','w',zipfile.ZIP_DEFLATED) as archive:
 archive.writestr('project.json',json.dumps(project,ensure_ascii=False))
 archive.writestr(asset+'.svg',svg)
print('Generated examples/demo.sb3')
