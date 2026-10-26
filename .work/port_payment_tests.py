import re
from pathlib import Path
p=Path('tests/test_payment_workflows.py');s=p.read_text(encoding='utf8').replace('using SQLite','using SQL Server').replace('import sqlite3','import sqlserver\nimport workflow').replace('sqlite3.','sqlserver.').replace("sqlserver.connect(':memory:', isolation_level=None)",'sqlserver.connect()')
start=s.index("        statement, result = '', []");end=s.index('\n    def run(',start);s=s[:start]+"        return json.dumps([dict(r) for r in self.db.execute(script).fetchall()])\n"+s[end:]
start=s.index('        context = types.SimpleNamespace');end=s.index('        def substitute',start);s=s[:start]+"        original={}\n"+s[end:]
start=s.index('                    # The modern bridge');end=s.index('                elif node.get',start);s=s[:start]+"                    result=workflow.run(script,values)\n"+s[end:]
s=s.replace("INSERT INTO settings(Key,Value) VALUES('store_url',?) ON CONFLICT(Key) DO UPDATE SET Value=excluded.Value","UPDATE settings SET [Value]=? WHERE [Key]='store_url'")
s=s.replace("SET value=? WHERE key=","SET [value]=? WHERE [key]=")
s=re.sub(r'(INSERT INTO (\w+)\(Id,.*?;)',lambda m:'SET IDENTITY_INSERT '+m[2]+' ON; '+m[1]+' SET IDENTITY_INSERT '+m[2]+' OFF;',s)
p.write_text(s,encoding='utf8')
