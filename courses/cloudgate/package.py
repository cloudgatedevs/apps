"""Generate installable native graphs from an MCP-read export and live node catalog.
No network, SQL execution or publishing. Apply only using reviewed MCP dry runs.
"""
import copy,json,uuid
from pathlib import Path
from engine import snapshot_sql
from seed import seed_sql
ROOT=Path(__file__).resolve().parent;APP=ROOT.parent
R=json.loads((ROOT/'resources.json').read_text());prototype=json.loads((ROOT/'live-node-prototype.json').read_text());ENGINE=(ROOT/'engine.py').read_text(encoding='utf8')
MARKETS={'function':(1,'c81329ef-5713-49ef-a634-80bf728472ad'),'condition':(4,'85782a05-66c7-40b9-b0db-854638827318'),'database':(5,'072f563b-7186-4b0b-a463-b905d944e957'),'idp':(9,'9cc226c5-c784-4138-950e-dd85bb4d97be'),'wallet':(11,'7a2c4f1e-9b3d-4c8a-9e21-5d6f0b8a3c11')}
BRIDGE='''import json
import clr
clr.AddReference('Web.Core.Shared')
from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
session_keys=list(WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}')))
def value(name):
    found=[str(k.Value) for k in session_keys if str(k.Key).lower()==name.lower()]
    return found[-1] if found else ''
def obj(name,default=None):
    raw=value(name)
    return json.loads(raw) if raw and raw!='No records found' else default
def snapshot(name='Snapshot'):
    rows=obj(name,[])
    if isinstance(rows,dict):rows=[rows]
    if not rows:raise Exception('Academy database could not be loaded.')
    raw=rows[0]['snapshot']
    return json.loads(raw) if isinstance(raw,str) else raw
def request():
    data=obj('body',{})
    if not isinstance(data,dict):raise Exception('Expected a JSON request.')
    return data
'''
def fn(code,engine=False):return BRIDGE+'\n'+(ENGINE+'\n' if engine else '')+code
graphs=[]
def graph(route,steps,anonymous=False,schedule=False):
    eid=str(uuid.uuid5(uuid.NAMESPACE_URL,'cloudgate-courses/v1/'+route));nodes=[];names={}
    for i,step in enumerate(steps):
        name,kind,code=step[:3];opts=step[3] if len(step)>3 else {}
        n=copy.deepcopy(prototype['Nodes'][0]);n.update(Id=str(uuid.uuid5(uuid.UUID(eid),name)),Name=name,MainScript=code,EndpointId=eid,NodeId=None,PositiveNodeId=None,NegativeNodeId=None,ThreadEntryNodeId=None,NodeType=MARKETS[kind][0],NodeMarketId=MARKETS[kind][1],X=80+i*340,Y=80,Width=280,Height=240)
        n.update(FileId=None,FileProdId=None)
        if kind=='database':n.update(FileId=R['fileId'],FileProdId=R['fileProdId'])
        if kind=='idp':n.update(IdpOuputType=2,IdpAuthorizeAllowAnonymous=anonymous)
        if kind=='wallet':n.update(**opts.get('params',{}))
        nodes.append(n);names[name]=n
    for i,(step,n) in enumerate(zip(steps,nodes)):
        opts=step[3] if len(step)>3 else {}
        if 'positive' in opts:n.update(PositiveNodeId=names[opts['positive']]['Id'],NegativeNodeId=names[opts['negative']]['Id'])
        elif opts.get('terminal'):pass
        else:n['NodeId']=names[opts['next']]['Id'] if opts.get('next') else nodes[i+1]['Id'] if i+1<len(nodes) else None
    ep=copy.deepcopy(prototype['Endpoint']);ep.update(Id=eid,Name='Academy · '+route.replace('-',' ').title(),Route=route,RequestType=2,ProjectId=R['projectId'],NodeId=nodes[0]['Id'],AllowAnonymous=anonymous,EnableLogging=True,MaskData=True,RunOnSchedule=schedule,ScheduleCron=0 if schedule else None,ScheduledSandbox=schedule,ScheduledProduction=schedule,IsActive=True)
    g=dict(projectId=R['projectId'],Endpoint=ep,Nodes=nodes);graphs.append(g);directory=ROOT/'workflows'/route;directory.mkdir(parents=True,exist_ok=True);(directory/'graph.json').write_text(json.dumps(g,indent=2),encoding='utf8')
    return g
snap=snapshot_sql();shape=fn("rows=obj('Run',[])\nif isinstance(rows,dict):rows=[rows]\nreturn rows[0]['result'] if rows else '{}'\n")
groups={'catalog':['catalog','preview-lesson','certificate-verify'],'workspace':['workspace','admin-data'],'courses':['course-save','course-publish','course-archive','lesson-save','instructor-save'],'enrollments':['enroll','enrollment-status'],'learning':['learn','lesson-complete','quiz-submit','discussion-post','discussion-moderate'],'sessions':['session-save','attendance-save'],'settings':['settings']}
for route,ops in groups.items():
    code="d=request()\nrequire(d.get('op') in "+repr(ops)+",'Operation not allowed.')\nsql,result=plan(snapshot(),d,obj('IdpAuth',{}))\nreturn sql"
    graph(route,[('IdpAuth','idp',None),('Snapshot','database',snap),('Plan','function',fn(code,True)),('Run','database','${Plan}'),('Shape','function',shape)],route=='catalog')
extract=lambda key:fn("return str(obj('Prepare')['"+key+"'])")
graph('checkout',[('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',fn("o=Engine(snapshot(),obj('IdpAuth',{})).dispatch(dict(request(),op='checkout-prepare'))\nrequire(o['url'].startswith('https://'),'Configure your live HTTPS website URL before accepting payments.')\nreturn encoded(o)",True)),('Amount','function',extract('amount')),('Currency','function',extract('currency')),('Reference','function',extract('ref')),('Email','function',extract('email')),('ReturnUrl','function',fn("return obj('Prepare')['url'].rstrip('/')+'/learn?payment='+obj('Prepare')['ref']")),('WalletCreate','wallet',None,{'params':dict(Param1='create',Param2='${Amount}',Param3='${Currency}',Param4='Academy ${Reference}',Param5='${Reference}',Param6='${Email}',Param7='${ReturnUrl}',Param8='${ReturnUrl}',Param9='courses-${Reference}')}),('AfterWallet','database',snap),('Plan','function',fn("p=obj('WalletCreate',{});o=obj('Prepare')\nsql,result=plan(snapshot('AfterWallet'),dict(op='_checkout-save',ref=o['ref'],payment_id=str(p.get('Id','')),payment_url=p.get('PaymentUrl','')),internal=True)\nreturn sql",True)),('Run','database','${Plan}'),('Shape','function',shape)])
apply=fn("o=obj('Prepare');p=obj('WalletGet',{})\nsql,result=plan(snapshot('AfterWallet'),dict(op='_payment-apply',ref=o['ref'],provider=p),internal=True)\nreturn sql",True)
graph('payment-status',[('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',fn("return encoded(Engine(snapshot(),obj('IdpAuth',{})).dispatch(dict(request(),op='payment-prepare')))",True)),('PaymentId','function',extract('payment_id')),('WalletGet','wallet',None,{'params':dict(Param1='get',Param10='${PaymentId}')}),('AfterWallet','database',snap),('Plan','function',apply),('Run','database','${Plan}'),('Shape','function',shape)])
refund_apply=fn("p=obj('WalletRefund',{});o=obj('Prepare')\nsql,result=plan(snapshot('AfterWallet'),dict(op='_refund-apply',request_key=o['request_key'],provider=p),internal=True)\nreturn sql",True)
graph('refund',[('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',fn("return encoded(Engine(snapshot(),obj('IdpAuth',{})).dispatch(dict(request(),op='refund-prepare')))",True)),('Claim','function',fn("sql,result=plan(snapshot(),dict(op='_refund-claim',prepared=obj('Prepare')),internal=True)\nreturn sql",True)),('ClaimRun','database','${Claim}'),('PaymentId','function',extract('payment_id')),('Amount','function',extract('amount')),('RefundKey','function',extract('request_key')),('WalletRefund','wallet',None,{'params':dict(Param1='refund',Param2='${Amount}',Param9='courses-refund-${RefundKey}',Param10='${PaymentId}')}),('AfterWallet','database',snap),('Plan','function',refund_apply),('Run','database','${Plan}'),('Shape','function',shape)])
guard=('ScheduledOnly','function',fn("if value('route')!='Scheduled Job':raise Exception('Scheduler-only action.')\nreturn 'ok'"))
graph('reconcile',[guard,('Snapshot','database',snap),('Prepare','function',fn("rows=[r for r in Engine(snapshot()).all('order') if r.get('payment_id') and r['status']=='due']\nrows.sort(key=lambda r:r.get('last_checked',0))\nreturn encoded(rows[0] if rows else {})",True)),('HasPayment','condition',fn("return bool(obj('Prepare'))"),{'positive':'PaymentId','negative':'Done'}),('PaymentId','function',extract('payment_id')),('WalletGet','wallet',None,{'params':dict(Param1='get',Param10='${PaymentId}')}),('AfterWallet','database',snap),('Plan','function',apply),('Run','database','${Plan}'),('Done','function',fn("return json.dumps({'ok':True})"))],schedule=True)
graph('refund-reconcile',[guard,('Snapshot','database',snap),('Prepare','function',fn("rows=[r for r in Engine(snapshot()).all('refund') if r['status'] not in ('succeeded','failed')]\nrows.sort(key=lambda r:r.get('updated',0))\nreturn encoded(rows[0] if rows else {})",True)),('HasRefund','condition',fn("return bool(obj('Prepare'))"),{'positive':'PaymentId','negative':'Done'}),('PaymentId','function',extract('payment_id')),('RefundKey','function',extract('request_key')),('WalletRefund','wallet',None,{'params':dict(Param1='refund-status',Param9='courses-refund-${RefundKey}',Param10='${PaymentId}')}),('AfterWallet','database',snap),('Plan','function',refund_apply),('Run','database','${Plan}'),('Done','function',fn("return json.dumps({'ok':True})"))],schedule=True)
mail=(ROOT/'notifications.py').read_text(encoding='utf8')
graph('notifications',[guard,('Snapshot','database',snap),('Claim','function',fn("sql,result=plan(snapshot(),dict(op='_mail-claim'),internal=True)\nreturn sql",True)),('ClaimRun','database','${Claim}'),('Send','function',fn(mail+"\nrows=obj('ClaimRun',[])\nif isinstance(rows,dict):rows=[rows]\nreturn encoded(send_claimed(json.loads(rows[0]['result'])))",True)),('AfterSend','database',snap),('Plan','function',fn("sql,result=plan(snapshot('AfterSend'),dict(obj('Send'),op='_mail-result'),internal=True)\nreturn sql",True)),('Run','database','${Plan}'),('Shape','function',shape)],schedule=True)
schema=(ROOT/'schema.sql').read_text();sample=seed_sql();out=APP/'.template';out.mkdir(exist_ok=True)
(out/'schema.sql').write_text(schema);(out/'sample-data.sql').write_text(sample,encoding='utf8')
databases=[dict(Id=R['databaseId'],Name='courses_sandbox',Type=0,FileId=R['fileId'],FileProdIdGuid=None,ProjectId=R['projectId'],SQLScript=schema,SQLScriptProd=schema),dict(Id=R['databaseProdId'],Name='courses_production',Type=0,FileId=R['fileProdId'],FileProdIdGuid=R['fileProdId'],ProjectId=R['projectId'],SQLScript=schema,SQLScriptProd=schema)]
bundle=dict(Projects=[dict(Name='Cloudgate Academy',Path='courses',IsPrivate=False,Template=dict(Endpoints=[g['Endpoint'] for g in graphs],Nodes=[n for g in graphs for n in g['Nodes']],Keys=[],Databases=databases,WebSockets=[],TestRequests=[],Snippets=[]))])
(out/'workflow-template.json').write_text(json.dumps(bundle,indent=2),encoding='utf8');print('Generated',len(graphs),'native workflows.')
