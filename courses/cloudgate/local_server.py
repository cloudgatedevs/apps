"""Loopback-only simulator. Payments and mail never leave this process."""
import argparse,json,sqlite3,threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from engine import Engine,plan,snapshot_sql,encoded
from seed import seed_sql
import local_media
ROOT=Path(__file__).parent;DB=ROOT.parent/'.local/academy.sqlite';LOCK=threading.RLock()
IDENTITIES={'admin':dict(Id='1',Role='Admin',IsActive=True,Name='Alex Morgan',Email='alex@example.invalid'),'learner':dict(Id='2',Role='User',IsActive=True,Name='Jordan Williams',Email='jordan@example.invalid'),'instructor':dict(Id='3',Role='User',IsActive=True,Name='Alex Morgan',Email='alex@example.invalid'),'other':dict(Id='4',Role='User',IsActive=True,Name='Other Learner',Email='other@example.invalid')}
def connect():
    c=sqlite3.connect(DB,timeout=20);c.row_factory=sqlite3.Row;return c
def state():
    with connect() as c:return json.loads(c.execute(snapshot_sql()).fetchone()['snapshot'])
def run(d,identity=None,internal=False):
    with LOCK,connect() as c:
        sql,result=plan(json.loads(c.execute(snapshot_sql()).fetchone()['snapshot']),d,identity,internal=internal)
        try:c.executescript(sql)
        except Exception:c.rollback();raise
        return result
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,status,value,ctype='application/json'):
        body=value if isinstance(value,bytes) else encoded(value).encode();self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        image=local_media.read_image(DB.parent/'media',urlsplit(self.path).path);self.send(200,image,'image/png') if image else self.send(404,dict(error='Not found'))
    def do_POST(self):
        try:
            origin=urlsplit(self.headers.get('Origin',''));host=self.headers.get('Host','').split(':')[0]
            if host not in ('localhost','127.0.0.1') or (origin.hostname and origin.hostname not in ('localhost','127.0.0.1')) or self.headers.get('X-Academy-Preview')!='1':return self.send(403,dict(error='Local preview only.'))
            size=int(self.headers.get('Content-Length','0'));require_size=0<size<6000000
            if not require_size:return self.send(413,dict(error='Request too large.'))
            d=json.loads(self.rfile.read(size));identity=IDENTITIES.get(self.headers.get('X-Preview-Role',''),{});op=d.get('op');route=urlsplit(self.path).path
            if route=='/api/checkout':
                o=Engine(state(),identity).dispatch(dict(d,op='checkout-prepare'));result=run(dict(op='_checkout-save',ref=o['ref'],payment_id='sim-'+o['ref'],payment_url='https://preview.invalid/'+o['ref']),internal=True);result['simulated']=True
            elif route=='/api/payment-status':
                o=Engine(state(),identity).dispatch(dict(d,op='payment-prepare'));result=run(dict(op='_payment-apply',ref=o['ref'],provider=dict(Id=o['payment_id'],GrossAmount=o['amount'],Currency=o['currency'],Status=1 if d.get('simulate') else 0)),internal=True)
            elif route=='/api/refund':
                v=Engine(state(),identity).dispatch(dict(d,op='refund-prepare'));run(dict(op='_refund-claim',prepared=v),internal=True);result=run(dict(op='_refund-apply',request_key=v['request_key'],provider=dict(PaymentId=v['payment_id'],Amount=v['amount'],Currency=v['currency'],IdempotencyKey='courses-refund-'+v['request_key'],RefundId='sim-'+v['request_key'],Status='succeeded')),internal=True)
            elif route=='/api/branding-media':
                Engine(state(),identity).admin()
                if op=='list':result=local_media.listing(DB.parent/'media',d.get('skip',0),d.get('take',36),d.get('path','*'))
                elif op=='upload':result=local_media.upload(DB.parent/'media',d['content'],d['name'],d.get('path','courses/branding'))
                elif op=='delete':result=local_media.delete(DB.parent/'media',d['id'])
                else:raise ValueError('Unknown media operation.')
            else:result=run(d,identity)
            self.send(200,result)
        except (ValueError,KeyError,sqlite3.Error) as e:self.send(400,dict(error=str(e)))
        except Exception:self.send(500,dict(error='Preview request failed.'))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=3014);args=parser.parse_args();DB.parent.mkdir(parents=True,exist_ok=True)
    with connect() as c:
        c.executescript((ROOT/'schema.sql').read_text())
        if not c.execute('SELECT 1 FROM entities LIMIT 1').fetchone():c.executescript(seed_sql())
    print('Academy preview API on port',args.port,flush=True);ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
