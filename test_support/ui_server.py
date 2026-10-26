"""Own a disposable SQL Server schema while a browser test runs its local API."""
import argparse,json,runpy,sys
from pathlib import Path
import sqlserver

parser=argparse.ArgumentParser()
parser.add_argument('app',choices=['shop','pos','booking','jobs','courses','events'])
parser.add_argument('--record',type=Path,required=True)
parser.add_argument('--data-dir',type=Path)
parser.add_argument('--port')
parser.add_argument('--cleanup',action='store_true')
args=parser.parse_args()
if args.cleanup:
    if args.record.exists():
        schema=json.loads(args.record.read_text())['schema']
        connection=sqlserver.connect(schema)
        connection.owns_schema=True
        connection.close()
        args.record.unlink()
    raise SystemExit(0)

root=Path(__file__).resolve().parents[1]/args.app
owner=sqlserver.connect()
args.record.write_text(json.dumps({'schema':owner.schema}))
connect=sqlserver.connect
try:
    sys.path.insert(0,str(root/'cloudgate'))
    if args.app in ('shop','pos'):
        sqlserver.connect=lambda *a,**k:connect(owner.schema)
        target=root/'tests/workflow_fixture.py'
        sys.argv=[str(target),'--port',args.port]
    else:
        import local_sql
        local_sql.connect=lambda:connect(owner.schema)
        target=root/'cloudgate/local_server.py'
        sys.argv=[str(target),'--data-dir',str(args.data_dir),'--port',args.port]
    runpy.run_path(str(target),run_name='__main__')
finally:
    owner.close()
    args.record.unlink(missing_ok=True)
