import ast,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for app in ['shop','pos']:
 p=ROOT/app/'cloudgate/test_refunds.py';s=p.read_text().replace('SQLite','SQL Server').replace('import sqlite3','import sqlserver').replace('sqlite3.','sqlserver.')
 start=s.index('    statement, result');end=s.index('\n\n\ndef connection',start);s=s[:start]+"    return [dict(row) for row in db.execute(sql).fetchall()]\n"+s[end:]
 start=s.index('    db = sqlserver.connect',s.index('def connection'));end=s.index('\n\n\nclass RefundTests',start)
 s=s[:start]+"    return sqlserver.connect(path)\n"+s[end:]
 s=s.replace("self.path = str(Path(self.temp.name) / 'refunds.sqlite')","self.path = None").replace('self.db = connection(self.path)','self.db = connection(self.path)\n        self.path = self.db.schema')
 # Explicit identity values are only used for deterministic test fixtures.
 s=re.sub(r'(INSERT INTO (\w+)\(Id,.*?;)',lambda m:'SET IDENTITY_INSERT '+m[2]+' ON; '+m[1]+' SET IDENTITY_INSERT '+m[2]+' OFF;',s)
 start=s.index('    def test_migration_repeat_keeps_history');end=s.index("    @unittest.skipUnless(APP == 'shop', 'Shop')",start)
 s=s[:start]+'''    def test_schema_reapply_keeps_history(self):
        self.apply(self.claim())
        self.db.executescript((ROOT.parent/'.template/schema.sql').read_text(encoding='utf8'))
        self.assertEqual(self.money(),500)
        self.assertEqual(self.claim()['Status'],'succeeded')

'''+s[end:]
 start=s.index('            module=types.ModuleType');end=s.index('            def substitute',start)
 s=s[:start]+"            import workflow\n"+s[end:]
 s=s.replace("result=scope['main']()","result=workflow.run(code,values)")
 start=s.index("            code=lib+'\\n'+script.replace");end=s.index('            self.assertEqual(self.money(),500)',start)
 s=s[:start]+'''            import workflow
            values={'LoadOrder':json.dumps([{'Id':9001,'PaymentRowId':9001,'ConnectPaymentId':71001,'Reference':'TEST-1','TotalCents':1000,'Currency':'ZAR'}]),'WalletGet':json.dumps({'Id':71001,'GrossAmount':1000,'Currency':'zar','Status':status})}
            execute(self.db,workflow.run(lib+'\\n'+script,values))
'''+s[end:]
 p.write_text(s,encoding='utf8')
 p=ROOT/app/'tests/workflow_fixture.py';s=p.read_text().replace('SQLite','SQL Server').replace('import sqlite3','import sqlserver\nimport workflow as python_workflow').replace('sqlite3.','sqlserver.')
 start=s.index("    statement, result");end=s.index('\n\n\ndef workflow',start);s=s[:start]+"    return [dict(row) for row in db.execute(sql).fetchall()]\n"+s[end:]
 s=s.replace("result = scope['run']()","result = python_workflow.run(source,values)").replace('sqlserver.connect(args.db, isolation_level=None)','sqlserver.connect()')
 p.write_text(s,encoding='utf8')
p=ROOT/'shop/cloudgate/test_catalog_local.py';s=p.read_text().replace('SQLite','SQL Server').replace('import sqlite3','import sqlserver\nimport workflow').replace('sqlite3.','sqlserver.')
start=s.index('    for k, v in keys.items():');end=s.index('\n\n\ndef db',start);s=s[:start]+"    return workflow.run(text,keys)\n"+s[end:];s=s.replace("sqlserver.connect(':memory:')","sqlserver.connect()");p.write_text(s,encoding='utf8')
p=ROOT/'pos/cloudgate/package_refunds.py';s=p.read_text();s=re.sub(r"routes = list\(routes or .*", "routes = list(routes or sorted(p.parent.name for p in (ROOT/'workflows').glob('*/workflow.json')))",s);p.write_text(s)
