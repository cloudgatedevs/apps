from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'jobs/tests/test_native.py';s=p.read_text().replace('import json,sqlserver,sys,types,unittest','import json,sqlserver,sys,types,unittest,workflow')
s=s[:s.index(";self.saved=")]+s[s.index('\n def tearDown'):]
start=s.index('  for k,v in self.saved.items():');end=s.index(' def run_graph',start);s=s[:start]+s[end:]
start=s.index('  ctx=types.SimpleNamespace');end=s.index('  steps=0',start);s=s[:start]+s[end:]
start=s.index("    statement='';rows=[]");end=s.index('    result=json.dumps(rows)',start);s=s[:start]+"    rows=[dict(r) for r in self.c.execute(sql).fetchall()]\n"+s[end:]
s=s.replace("result=namespace['invoke']()","result=workflow.run(code,values)");p.write_text(s)
p=ROOT/'booking/tests/test_native_workflows.py';s=p.read_text().replace('against SQLite','against SQL Server').replace('import sqlserver','import sqlserver\nimport workflow')
start=s.index('  scope=types.SimpleNamespace');end=s.index('  current=graph',start);s=s[:start]+"  old={}\n"+s[end:]
start=s.index("     if script.startswith('BEGIN'):");end=s.index('\n    else:',start);s=s[:start]+"     result=json.dumps([dict(r) for r in self.db.execute(script)])"+s[end:]
s=s.replace("result=namespace['main']()","result=workflow.run(script,self.keys)");p.write_text(s)
