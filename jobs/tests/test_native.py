import json,sqlite3,sys,types,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'cloudgate'))
from seed import seed_sql
from test_domain import ADMIN,CUSTOMER
class NativeTests(unittest.TestCase):
 def setUp(self):
  self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.executescript((ROOT/'cloudgate/schema.sql').read_text());self.c.executescript(seed_sql(local=True));self.saved={k:sys.modules.get(k) for k in ['clr','Web.Core.Shared.Services.Endpoints.Engine']};sys.modules['clr']=types.SimpleNamespace(AddReference=lambda x:None)
 def tearDown(self):
  self.c.close()
  for k,v in self.saved.items():
   if v is None:sys.modules.pop(k,None)
   else:sys.modules[k]=v
 def run_graph(self,route,body=None,identity=ADMIN,url='http://localhost/sbx/jobs/test',wallet=None):
  graph=json.loads((ROOT/'cloudgate/workflows'/route/'graph.json').read_text(encoding='utf8'));nodes={n['Id']:n for n in graph['Nodes']};node=graph['Endpoint']['NodeId'];values={'body':json.dumps(body or {}),'route':url}
  ctx=types.SimpleNamespace(GetKeys=lambda sid:[types.SimpleNamespace(Key=k,Value=v) for k,v in values.items()]);sys.modules['Web.Core.Shared.Services.Endpoints.Engine']=types.SimpleNamespace(WorkflowSessionKeyExecutionContext=ctx)
  steps=0
  while node:
   steps+=1;self.assertLessEqual(steps,25);n=nodes[node];kind=n['NodeType']
   if kind==9:result=json.dumps(identity or {})
   elif kind==5:
    sql=n['MainScript']
    for k,v in values.items():sql=sql.replace('${'+k+'}',v)
    statement='';rows=[]
    try:
     for line in sql.splitlines(keepends=True):
      for ch in line:
       statement+=ch
       if ch==';' and sqlite3.complete_statement(statement):
        cur=self.c.execute(statement);rows=[dict(r) for r in cur.fetchall()] if cur.description else [];statement=''
     if statement.strip():
      cur=self.c.execute(statement);rows=[dict(r) for r in cur.fetchall()] if cur.description else []
    except Exception:self.c.rollback();raise
    result=json.dumps(rows)
   elif kind in (1,4):
    code=n['MainScript'].replace('${sessionid}','123');namespace={};exec('def invoke():\n'+''.join('    '+line+'\n' for line in code.splitlines()),namespace);result=namespace['invoke']()
   elif kind==11:result=json.dumps(wallet or {})
   else:raise AssertionError('Unknown kind')
   values[n['Name']]=str(result)
   node=(n['PositiveNodeId'] if result else n['NegativeNodeId']) if kind==4 else n['NodeId']
  try:return json.loads(result)
  except (TypeError,ValueError):return result
 def test_catalog_native(self):self.assertEqual(len(self.run_graph('catalog',{'op':'catalog'},{} )['services']),4)
 def test_workspace_native(self):self.assertEqual(self.run_graph('workspace',{'op':'workspace'},CUSTOMER)['role'],'customer')
 def test_request_native_text(self):
  result=self.run_graph('requests',dict(op='request-create',title="Pipe ${body} O'Brien",description='hello',address='Home',request_key='a'*20),CUSTOMER);self.assertEqual(result['title'],"Pipe ${body} O'Brien")
 def test_route_allowlist(self):self.assertRaises(ValueError,self.run_graph,'catalog',dict(op='settings',values={'name':'x'}),ADMIN)
 def test_scheduled_guard_rejects_browser(self):self.assertRaises(Exception,self.run_graph,'automation',{},ADMIN)
 def test_scheduled_worker_runs(self):self.assertTrue(self.run_graph('automation',url='Scheduled Job')['ok'])
 def test_unconfigured_notifications_no_send(self):self.assertEqual(self.run_graph('notifications',url='Scheduled Job')['processed'],0)
 def test_empty_recovery_branches(self):
  self.assertTrue(self.run_graph('reconcile',url='Scheduled Job')['ok']);self.assertTrue(self.run_graph('refund-reconcile',url='Scheduled Job')['ok'])
 def test_all_scripts_compile_and_wiring(self):
  for file in (ROOT/'cloudgate/workflows').glob('*/graph.json'):
   graph=json.loads(file.read_text(encoding='utf8'));ids={n['Id'] for n in graph['Nodes']};self.assertIn(graph['Endpoint']['NodeId'],ids)
   for n in graph['Nodes']:
    for k in ('NodeId','PositiveNodeId','NegativeNodeId'):
     if n[k]:self.assertIn(n[k],ids)
    if n['NodeType'] in (1,4):compile('def invoke():\n'+''.join('    '+line+'\n' for line in n['MainScript'].replace('${sessionid}','123').splitlines()),str(file),'exec')
if __name__=='__main__':unittest.main()
