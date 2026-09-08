"""Build the native Cloudgate bundle from a live-exported node prototype.
No network calls and no publishing. Validate generated graphs using the live MCP before import.
Request and node data are read through Cloudgate's request-local session context, never pasted
into Python source. The only substituted Python literal is the platform-owned session id.
"""
import copy
import json
import sys
import uuid
from pathlib import Path
from engine import snapshot_sql
ROOT=Path(__file__).parent; APP=ROOT.parent
PROJECT='7bf672cf-2d01-474f-0df8-08df0d4ae348'
FILE='f9b82725-4dd7-4eff-bfca-692e25bad98d'
prototype=json.loads((ROOT/'live-node-prototype.json').read_text())
MARKETS={'function':(1,'c81329ef-5713-49ef-a634-80bf728472ad'),'condition':(4,'85782a05-66c7-40b9-b0db-854638827318'),'database':(5,'072f563b-7186-4b0b-a463-b905d944e957'),'idp':(9,'9cc226c5-c784-4138-950e-dd85bb4d97be'),'wallet':(11,'7a2c4f1e-9b3d-4c8a-9e21-5d6f0b8a3c11')}
BRIDGE='''import json
import clr
clr.AddReference('Web.Core.Shared')
from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
session_keys = list(WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}')))
def value(name):
    matches=[str(k.Value) for k in session_keys if str(k.Key).lower()==name.lower()]
    return matches[-1] if matches else ''
def obj(name, default=None):
    raw=value(name)
    return json.loads(raw) if raw and raw != 'No records found' else default
def snapshot(name='Snapshot'):
    rows=obj(name, [])
    if isinstance(rows,dict): rows=[rows]
    if not rows: raise Exception('The booking database could not be loaded.')
    raw=rows[0]['snapshot']
    return json.loads(raw) if isinstance(raw,str) else raw
def request():
    data=obj('body',{})
    if not isinstance(data,dict): raise Exception('Expected a JSON request.')
    return data
'''
ENGINE=(ROOT/'engine.py').read_text()
def function(code,engine=False): return BRIDGE+'\n'+(ENGINE+'\n' if engine else '')+code
graphs=[]
def graph(route,steps,anonymous=True,schedule=False):
    eid=str(uuid.uuid5(uuid.NAMESPACE_URL,'cloudgate-booking/'+route));nodes=[];names={}
    for i,step in enumerate(steps):
        name,kind,code=step[:3];options=step[3] if len(step)>3 else {}
        n=copy.deepcopy(prototype['Nodes'][0]);n.update(Id=str(uuid.uuid5(uuid.UUID(eid),name)),Name=name,EndpointId=eid,NodeId=None,PositiveNodeId=None,NegativeNodeId=None,ThreadEntryNodeId=None,NodeType=MARKETS[kind][0],NodeMarketId=MARKETS[kind][1],MainScript=code,X=200+i*320,Y=0,Width=260,Height=220)
        if kind=='database':n.update(FileId=FILE,FileProdId=PROD_FILE)
        if kind=='idp':n.update(MainScript=None,IdpOuputType=2,IdpAuthorizeAllowAnonymous=anonymous)
        if kind=='wallet':n.update(MainScript=None,**options.get('params',{}))
        nodes.append(n);names[name]=n
    for i,(step,node) in enumerate(zip(steps,nodes)):
        opts=step[3] if len(step)>3 else {}
        if 'positive' in opts:node.update(PositiveNodeId=names[opts['positive']]['Id'],NegativeNodeId=names[opts['negative']]['Id'])
        elif opts.get('terminal'):pass
        else:node['NodeId']=names[opts['next']]['Id'] if opts.get('next') else nodes[i+1]['Id'] if i+1<len(nodes) else None
    ep=copy.deepcopy(prototype['Endpoint']);ep.update(Id=eid,Name='Booking · '+route.replace('-',' ').title(),Route=route,RequestType=2,ProjectId=PROJECT,NodeId=nodes[0]['Id'],AllowAnonymous=anonymous,EnableLogging=False,MaskData=True,RunOnSchedule=schedule,ScheduleCron=0 if schedule else None,ScheduledSandbox=schedule,ScheduledProduction=schedule)
    out={'projectId':PROJECT,'Endpoint':ep,'Nodes':nodes};graphs.append(out)
    directory=ROOT/'workflows'/route;directory.mkdir(parents=True,exist_ok=True)
    (directory/'graph.json').write_text(json.dumps(out,indent=2))
    for n in nodes:
        if n['MainScript']:(directory/(n['Name']+('.sql' if n['NodeType']==5 else '.py'))).write_text(n['MainScript'])
    return out
PROD_FILE='f2d20cae-08b3-4a3a-ae93-da9f9d7d64c4'
config_path=ROOT/'deploy.config.json'
if config_path.exists():PROD_FILE=json.loads(config_path.read_text()).get('fileProdId',FILE)
snap=snapshot_sql()
shape=function("rows=obj('Run',[])\nif isinstance(rows,dict): rows=[rows]\nreturn rows[0]['payload'] if rows else '{}'\n")
graph('booking',[
 ('IdpAuth','idp',None),('Snapshot','database',snap),
 ('Plan','function',function("d=request()\nif d.get('op')=='maintenance' or str(d.get('op','')).startswith(('payment-','refund-')): raise Exception('Internal operation.')\nsql,result=plan(snapshot(),d,obj('IdpAuth',{}))\nreturn sql",True)),
 ('Run','database','${Plan}'),('Shape','function',shape)])

prepare=function("e=Engine(snapshot(),obj('IdpAuth',{}))\nb=e.booking(request())\nrequire(b['status']=='held' and b['expires']>e.now,'Your checkout hold expired. Please book again.')\nurl=e.settings.get('website_url','').rstrip('/')\nrequire(url.startswith('https://'),'The studio must configure its live HTTPS website URL before taking payments.')\nc=next(c for c in e.s['customers'] if c['Id']==b['customer_id'])\nreturn encoded(dict(b,email=c['email'],url=url))",True)
extract=lambda key: function("return str(obj('Prepare')['"+key+"'])")
save=function("p=obj('WalletCreate',{})\nrequire(p.get('Id') and str(p.get('PaymentUrl','')).startswith('https://'),'The wallet did not return a secure checkout session.')\nb=obj('Prepare')\nsql,result=plan(snapshot('AfterWallet'),dict(op='payment-save',reference=b['reference'],payment_id=str(p['Id']),payment_url=p['PaymentUrl']),internal=True)\nreturn sql",True)
graph('checkout',[
 ('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',prepare),
 ('Amount','function',extract('due')),('Currency','function',extract('currency')),('Reference','function',extract('reference')),('Email','function',extract('email')),
 ('ReturnUrl','function',function("b=obj('Prepare')\nreturn b['url']+'/checkout/return?ref='+b['reference']")),
 ('WalletCreate','wallet',None,{'params':dict(Param1='create',Param2='${Amount}',Param3='${Currency}',Param4='Studio appointment ${Reference}',Param5='${Reference}',Param6='${Email}',Param7='${ReturnUrl}',Param8='${ReturnUrl}',Param9='booking-${Reference}')}),
 ('AfterWallet','database',snap),('Plan','function',save),('Run','database','${Plan}'),('Shape','function',shape)])

apply=function("b=obj('Prepare')\np=obj('WalletGet',{})\nsql,result=plan(snapshot('AfterWallet'),dict(op='payment-apply',reference=b['reference'],provider=p,amount=p.get('GrossAmount'),currency=str(p.get('Currency','')).upper()),internal=True)\nreturn sql",True)
detail=function("e=Engine(snapshot('FinalSnapshot'),obj('IdpAuth',{}))\nb=e.booking(request())\nreturn encoded(e.detail(b))",True)
graph('payment-status',[
 ('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',function("e=Engine(snapshot(),obj('IdpAuth',{}))\nreturn encoded(e.booking(request()))",True)),
 ('HasPayment','condition',function("return bool(obj('Prepare').get('payment_id'))"),{'positive':'PaymentId','negative':'FinalSnapshot'}),
 ('PaymentId','function',extract('payment_id')),('WalletGet','wallet',None,{'params':dict(Param1='get',Param10='${PaymentId}')}),
 ('AfterWallet','database',snap),('Plan','function',apply),('Run','database','${Plan}'),('FinalSnapshot','database',snap),('Shape','function',detail)])

refund_prepare=function('''e=Engine(snapshot(),obj('IdpAuth',{}))
b=e.booking(request(),True);d=request()
require(b.get('payment_id'),'This booking has no Wallet payment. Refund cash separately.')
key=text(d.get('request_key'),96);require(len(key)>=16,'Refund request key required.')
existing=next((r for r in e.s['refund_requests'] if r['request_key']==key),None)
if existing:
    require(existing['booking_ref']==b['reference'],'Refund request belongs to another booking.')
    amount=existing['amount']
    if d.get('op')!='refund-status':require(d.get('amount')==amount,'Refund request amount changed.')
else:
    require(d.get('op')!='refund-status','Refund request not found.')
    amount=integer(d.get('amount'),1,b['paid']-b['refunded'],'Refund amount')
    require(amount<=b['due']-sum(p['amount'] for p in e.s['payments'] if p['booking_ref']==b['reference'] and p['kind']=='refund'),'Refund exceeds the Wallet payment balance.')
return encoded(dict(b,refund_amount=amount,refund_key=key))''',True)
def refund_plan(prepared='Prepare',after='AfterWallet'):
    return function("b=obj('"+prepared+"');p=obj('WalletRefund',{})\nsql,result=plan(snapshot('"+after+"'),dict(op='refund-apply',reference=b['reference'],provider=p,request_key=b['refund_key']),internal=True)\nreturn sql",True)
refund_apply=refund_plan()
graph('refund',[
 ('IdpAuth','idp',None),('Snapshot','database',snap),('Prepare','function',refund_prepare),
 ('Claim','function',function("d=request();b=obj('Prepare')\nsql,result=plan(snapshot(),dict(d,op='refund-claim',amount=b['refund_amount']),obj('IdpAuth',{}),internal=True)\nreturn sql",True)),('ClaimRun','database','${Claim}'),
 ('PaymentId','function',extract('payment_id')),('Amount','function',extract('refund_amount')),('RefundKey','function',extract('refund_key')),('Operation','function',function("return 'refund-status' if request().get('op')=='refund-status' else 'refund'")),
 ('WalletRefund','wallet',None,{'params':dict(Param1='${Operation}',Param2='${Amount}',Param9='booking-refund-${RefundKey}',Param10='${PaymentId}')}),
 ('AfterWallet','database',snap),('Plan','function',refund_apply),('Run','database','${Plan}'),('Shape','function',shape)],False)

candidate=function("e=Engine(snapshot())\npaid={p['external_id'] for p in e.s['payments']}\nbs=[b for b in e.s['bookings'] if b['status'] in ('held','expired','cancelled') and b.get('payment_id') and b['payment_id'] not in paid]\nbs.sort(key=lambda b:b['updated'])\nreturn encoded(bs[0] if bs else {})",True)
graph('reconcile',[
 ('Snapshot','database',snap),('Prepare','function',candidate),('HasPayment','condition',function("return bool(obj('Prepare').get('payment_id'))"),{'positive':'PaymentId','negative':'CleanupSnapshot'}),
 ('PaymentId','function',extract('payment_id')),('WalletGet','wallet',None,{'params':dict(Param1='get',Param10='${PaymentId}')}),('AfterWallet','database',snap),('Plan','function',apply),('Run','database','${Plan}'),
 ('CleanupSnapshot','database',snap),('Cleanup','function',function("sql,result=plan(snapshot('CleanupSnapshot'),{'op':'maintenance'},internal=True)\nreturn sql",True)),('CleanupRun','database','${Cleanup}'),
 ('RefundSnapshot','database',snap),('RefundPrepare','function',function("e=Engine(snapshot('RefundSnapshot'))\nrs=[r for r in e.s['refund_requests'] if r['status'] not in ('succeeded','failed')]\nif not rs:return encoded({})\nr=rs[(e.now//120)%len(rs)]\nb=next(b for b in e.s['bookings'] if b['reference']==r['booking_ref'])\nreturn encoded(dict(b,refund_key=r['request_key'],refund_amount=r['amount']))",True)),
 ('HasRefund','condition',function("return bool(obj('RefundPrepare'))"),{'positive':'RefundPaymentId','negative':'Done'}),
 ('RefundPaymentId','function',function("return str(obj('RefundPrepare')['payment_id'])")),('RefundKey','function',function("return obj('RefundPrepare')['refund_key']")),
 ('WalletRefund','wallet',None,{'params':dict(Param1='refund-status',Param9='booking-refund-${RefundKey}',Param10='${RefundPaymentId}')}),
 ('AfterRefund','database',snap),('RefundPlan','function',refund_plan('RefundPrepare','AfterRefund')),('RefundRun','database','${RefundPlan}'),
 ('Done','function',"return '{\"ok\":true}'")],False,True)

mail_script=(ROOT/'notifications.py').read_text()
graph('notifications',[
 ('Snapshot','database',snap),('Send','function',function(mail_script+"\ne=Engine(snapshot())\nreturn deliver(e.s,e.now)",True)),('Run','database','${Send}'),('Shape','function',shape)],False,True)

schema=(ROOT/'schema.sql').read_text();seed=(ROOT/'seed.sql').read_text();split=seed.index('INSERT OR IGNORE INTO services')
out=APP/'.template';out.mkdir(exist_ok=True)
(out/'schema.sql').write_text(schema+'\n'+seed[:split])
(out/'sample-data.sql').write_text(seed[split:])
databases=[]
for db_id,name,file_id,prod_id in [
    ('b6183ee9-2549-490f-8a7f-08df0d50fde0','booking_db',FILE,None),
    ('02de9e3b-ceb0-42fb-8a80-08df0d50fde0','booking_production_db',PROD_FILE,PROD_FILE),
]:
    databases.append({'Id':db_id,'Name':name,'Type':0,'FileId':file_id,'FileProdIdGuid':prod_id,'ProjectId':PROJECT,'SQLScript':schema+'\n'+seed[:split],'SQLScriptProd':schema+'\n'+seed[:split]})
bundle={'Projects':[{'Name':'Booking','Path':'booking','IsPrivate':False,'Template':{'Endpoints':[g['Endpoint'] for g in graphs],'Nodes':[n for g in graphs for n in g['Nodes']],'Keys':[],'Databases':databases,'WebSockets':[],'TestRequests':[],'Snippets':[]}}]}
(out/'workflow-template.json').write_text(json.dumps(bundle,indent=2))
print(f'Packaged {len(graphs)} native workflows, {sum(len(g["Nodes"]) for g in graphs)} nodes, schema and sandbox sample data.')
