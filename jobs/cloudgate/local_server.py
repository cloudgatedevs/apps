"""Loopback preview. Identities and payment simulation are development-only."""
import argparse,base64,json,re,sqlite3,threading,uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from engine import Engine,plan,encoded,snapshot_sql
from seed import seed_sql
import local_media
ROOT=Path(__file__).parent;DB=ROOT.parent/'.local/jobs.sqlite';LOCK=threading.RLock()
IDENTITIES={'admin':dict(Id='1',Role='Admin',IsActive=True,Name='Alex Morgan',Email='alex@example.invalid'),'customer':dict(Id='2',Role='Customer',IsActive=True,Name='Jordan Williams',Email='jordan@example.invalid'),'technician':dict(Id='3',Role='Customer',IsActive=True,Name='Maya Daniels',Email='maya@example.invalid'),'other':dict(Id='6',Role='Customer',IsActive=True,Name='Other customer',Email='other@example.invalid')}
def connect():
    c=sqlite3.connect(DB,timeout=20);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c
def snapshot(c):return json.loads(c.execute(snapshot_sql()).fetchone()['snapshot'])
def run(d,identity=None,internal=False):
    with LOCK,connect() as c:
        sql,result=plan(snapshot(c),d,identity,internal=internal)
        try:c.executescript(sql)
        except Exception:c.rollback();raise
        return result
def state():
    with connect() as c:return snapshot(c)
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,status,value,ctype='application/json'):
        body=value if isinstance(value,bytes) else encoded(value).encode();self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_GET(self):
        data=local_media.read_image(DB.parent/'media',urlsplit(self.path).path)
        self.send(200,data,'image/png') if data else self.send(404,dict(error='Not found'))
    def do_POST(self):
        try:
            host=self.headers.get('Host','').split(':')[0];origin=urlsplit(self.headers.get('Origin',''))
            if host not in ('127.0.0.1','localhost') or (origin.hostname and origin.hostname not in ('127.0.0.1','localhost')) or self.headers.get('X-Jobs-Preview')!='1':return self.send(403,dict(error='Local preview only.'))
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<6000000:return self.send(413,dict(error='Request too large.'))
            d=json.loads(self.rfile.read(size));identity=IDENTITIES.get(self.headers.get('X-Preview-Role',''),{});e=Engine(state(),identity);route=urlsplit(self.path).path
            if route=='/api/branding-media':
                e.admin();op=d.get('op')
                if op=='upload':result=local_media.upload(DB.parent/'media',d['content'],d['name'],d.get('path','jobs/branding'))
                elif op=='list':result=local_media.listing(DB.parent/'media',d.get('skip',0),d.get('take',100),d.get('path','*'))
                elif op=='delete':result=local_media.delete(DB.parent/'media',d['id'],list(e.settings.values())+[r.get('image_url') for r in e.rows])
                else:raise ValueError('Unknown media operation.')
            elif route=='/api/checkout':
                o=e.dispatch(dict(d,op='checkout-prepare'));result=run(dict(op='_checkout-save',ref=o['ref'],payment_id='sim-'+o['ref'],payment_url='https://preview.invalid/'+o['ref']),internal=True);result.update(simulated=True,payment_url='/account?checkout='+o['ref'])
            elif route=='/api/payment-status':
                o=e.dispatch(dict(d,op='payment-prepare'));result=run(dict(op='_payment-apply',ref=o['ref'],provider=dict(Id=o['payment_id'],GrossAmount=o['amount'],Currency=o['currency'],Status=1 if d.get('simulate') else 0)),internal=True)
            elif route=='/api/refund':
                p=e.dispatch(dict(d,op='refund-prepare'));run(dict(op='_refund-claim',prepared=p),internal=True);result=run(dict(op='_refund-apply',request_key=p['request_key'],provider=dict(PaymentId=p['payment_id'],Amount=p['amount'],Currency=p['currency'],IdempotencyKey='jobs-refund-'+p['request_key'],RefundId='sim-refund-'+p['request_key'],Status='succeeded')),internal=True)
            elif route=='/api/maintenance':e.admin();result=run(dict(op='_maintenance'),internal=True)
            else:
                result=run(d,identity)
                if d.get('op')=='attachment-read':
                    with connect() as c:result['content']=c.execute('SELECT content FROM attachments WHERE ref=?',(result['ref'],)).fetchone()['content']
            self.send(200,result)
        except (ValueError,KeyError,sqlite3.Error) as ex:self.send(400,dict(error=str(ex)))
        except Exception as ex:self.send(500,dict(error='Preview error: '+str(ex)))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=3011);args=parser.parse_args();DB.parent.mkdir(parents=True,exist_ok=True)
    with connect() as c:c.executescript((ROOT/'schema.sql').read_text(encoding='utf8'));c.executescript(seed_sql(local=True))
    print('Jobs preview API http://127.0.0.1:'+str(args.port),flush=True);ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
