from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
support=(ROOT/'test_support/sqlserver.py').read_text(encoding='utf8')
start=support.index('class Row');end=support.index('class Connection')
driver='''"""SQL Server connection for loopback development only.
Set CLOUDGATE_LOCAL_SQLSERVER to an ODBC connection string for a dedicated app
development database. Hosted workflows use native Database nodes.
"""
import datetime,decimal,os,pyodbc
Error=pyodbc.Error
IntegrityError=pyodbc.Error
'''+support[start:end]+'''class Connection:
    def __init__(self):
        connection=os.environ.get('CLOUDGATE_LOCAL_SQLSERVER')
        if not connection:raise RuntimeError('Set CLOUDGATE_LOCAL_SQLSERVER to the connection string for this app development database.')
        self.raw=pyodbc.connect(connection,autocommit=True)
        self.raw.execute('SET NOCOUNT ON;SET XACT_ABORT ON;')
    def execute(self,sql,parameters=()):
        try:return Result(self.raw.cursor().execute(sql,parameters))
        except Exception:self.rollback();raise
    def executescript(self,sql):return self.execute(sql)
    def rollback(self):self.raw.execute('IF @@TRANCOUNT>0 ROLLBACK;')
    def commit(self):self.raw.execute('IF @@TRANCOUNT>0 COMMIT;')
    def close(self):
        if self.raw:self.raw.close();self.raw=None
    def __enter__(self):return self
    def __exit__(self,*args):self.close()
def connect():return Connection()
'''
for app in ['booking','jobs','courses','events']:
 root=ROOT/app/'cloudgate';(root/'local_sql.py').write_text(driver,encoding='utf8')
 p=root/'local_server.py';s=p.read_text(encoding='utf8').replace('sqlite3','local_sql')
 if app=='booking':
  start=s.index('@contextmanager\ndef connect');end=s.index('\ndef snapshot',start)
  s=s[:start]+"def connect():return local_sql.connect()\n"+s[end:]
  s=s.replace("DB=None","DATA_DIR=ROOT.parent/'.local'").replace("Path(DB).parent/'media'","DATA_DIR/'media'")
  s=s.replace("p.add_argument('--db',default=str(ROOT.parent/'.local'/'booking.sqlite'))","p.add_argument('--data-dir',type=Path,default=DATA_DIR)").replace('DB=args.db','DATA_DIR=args.data_dir.resolve()')
  s=s.replace('Path(DB).parent.mkdir','DATA_DIR.mkdir').replace("c.executescript((ROOT/'seed.sql').read_text())","\n        if not c.execute('SELECT TOP 1 Id FROM services').fetchone():c.executescript((ROOT/'sample-data.sql').read_text(encoding='utf8'))")
  s=s.replace('CREATE TABLE IF NOT EXISTS test_provider(id TEXT PRIMARY KEY, reference TEXT, amount INTEGER, currency TEXT, status INTEGER)',"IF OBJECT_ID('test_provider','U') IS NULL CREATE TABLE test_provider(id nvarchar(128) PRIMARY KEY, reference nvarchar(254), amount bigint, currency nvarchar(8), status int)")
  # This SQL contains quoted identifiers and therefore needs a double-quoted Python literal.
  s=s.replace("c.execute('IF OBJECT_ID('test_provider','U')",'c.execute("IF OBJECT_ID(\'test_provider\',\'U\')').replace("status int)')",'status int)")')
 else:
  s=re.sub(r"DB=ROOT.parent/'\.local/[^']+'", "DATA_DIR=ROOT.parent/'.local'",s)
  start=s.index('def connect():');end=s.index('\ndef ',start+4);s=s[:start]+"def connect():return local_sql.connect()\n"+s[end:]
  s=s.replace("DB.parent/'media'","DATA_DIR/'media'").replace("parser.add_argument('--db',type=Path,default=DB)","parser.add_argument('--data-dir',type=Path,default=DATA_DIR)")
  s=s.replace('DB=args.db.resolve();DB.parent.mkdir','DATA_DIR=args.data_dir.resolve();DATA_DIR.mkdir').replace('SELECT 1 FROM entities LIMIT 1','SELECT TOP 1 Id FROM entities')
  if app=='jobs':
   s=s.replace("with connect() as c:c.executescript((ROOT/'schema.sql').read_text(encoding='utf8'));c.executescript(seed_sql(local=True))","with connect() as c:\n        c.executescript((ROOT/'schema.sql').read_text(encoding='utf8'))\n        if not c.execute('SELECT TOP 1 Id FROM entities').fetchone():c.executescript(seed_sql(local=True))")
 p.write_text(s,encoding='utf8')
p=ROOT/'booking/tests/test_media.py';s=p.read_text(encoding='utf8').replace('old_db = local_server.DB','old_dir = local_server.DATA_DIR\n            old_connect = local_server.connect\n            db=sqlserver.connect()\n            local_server.connect=lambda:sqlserver.connect(db.schema)').replace("local_server.DB = str(Path(directory) / 'test.db')","local_server.DATA_DIR = Path(directory)").replace('            with closing(sqlserver.connect(local_server.DB)) as db:\n                db.executescript', '            db.executescript').replace('local_server.DB = old_db','local_server.DATA_DIR = old_dir\n                local_server.connect = old_connect\n                db.close()');p.write_text(s,encoding='utf8')
