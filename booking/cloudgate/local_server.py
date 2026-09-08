"""Loopback-only development runtime. Executes the same SQL planner as Cloudgate.
The test payment provider is intentionally separate, visibly labelled, and never moves money.
Production uses Cloudgate IdP + Wallet workflow actions, not this server.
"""
import argparse
import json
import os
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from engine import Engine, TABLES, plan, encoded
from local_media import upload as upload_media, listing as list_media, read_image

ROOT=Path(__file__).parent
LOCK=threading.RLock()
ADMIN={'Role':'Admin','Email':'preview-admin@localhost','IsActive':True}
DB=None
def connect():
    c=sqlite3.connect(DB,timeout=15);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c
def snapshot(c):return {t:[dict(r) for r in c.execute('SELECT * FROM '+t)] for t in TABLES}
def run(d,identity=None,internal=False):
    with LOCK,connect() as c:
        sql,result=plan(snapshot(c),d,identity,internal=internal)
        try:c.executescript(sql)
        except Exception:
            c.rollback();raise
        return result
def state():
    with connect() as c:return snapshot(c)
def get_booking(d,admin=False):return Engine(state(),ADMIN if admin else None).booking(d,admin)
def provider_row(pid):
    with connect() as c:
        r=c.execute('SELECT * FROM test_provider WHERE id=?',(pid,)).fetchone()
        if not r:raise ValueError('Test payment not found.')
        return dict(r)
def reconcile(b):
    p=provider_row(b['payment_id'])
    return run(dict(op='payment-apply',reference=b['reference'],provider={'Id':p['id'],'Status':p['status']},amount=p['amount'],currency=p['currency']),internal=True)

class Handler(BaseHTTPRequestHandler):
    def log_message(self,format,*args):pass
    def reply(self,status,data):
        payload=encoded(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    def do_GET(self):
        data=read_image(Path(DB).parent/'media',urlparse(self.path).path)
        if data is None:return self.reply(404,{'error':'Image not found.'})
        self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','public, max-age=31536000, immutable');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_POST(self):
        try:
            origin=self.headers.get('Origin','')
            if origin and urlparse(origin).hostname not in ('localhost','127.0.0.1'):return self.reply(403,{'error':'Local preview only.'})
            if self.headers.get('X-Studio-Preview')!='1':return self.reply(403,{'error':'Local preview header required.'})
            length=int(self.headers.get('Content-Length',0))
            route=urlparse(self.path).path
            if length<0 or length>(6*1024*1024 if route=='/api/branding-media' else 65536):return self.reply(413,{'error':'Request too large.'})
            d=json.loads(self.rfile.read(length) or '{}')
            admin=self.headers.get('X-Preview-Role')=='admin'
            if route=='/api/branding-media':
                if not admin:raise PermissionError('Admin access required.')
                with LOCK:
                    if d.get('op')=='upload':result=upload_media(Path(DB).parent/'media',d.get('content'),d.get('name'))
                    elif d.get('op')=='list':result=list_media(Path(DB).parent/'media',d.get('skip',0),d.get('take',36))
                    else:raise ValueError('Unknown media operation.')
            elif route=='/api/booking':
                if str(d.get('op','')).startswith(('payment-','refund-')) or d.get('op')=='maintenance':raise ValueError('Internal operation.')
                result=run(d,ADMIN if admin else None)
            elif route=='/api/checkout':
                b=get_booking(d)
                if b['status']!='held' or b['expires']<=time.time():raise ValueError('Your checkout hold expired. Please choose another time.')
                if b['payment_id']:result={'payment_url':b['payment_url']}
                else:
                    pid=secrets.token_hex(16)
                    with connect() as c:c.execute('INSERT INTO test_provider(id,reference,amount,currency,status) VALUES(?,?,?,?,0)',(pid,b['reference'],b['due'],b['currency']))
                    result=run(dict(op='payment-save',reference=b['reference'],payment_id=pid,payment_url='/test-checkout?id='+pid),internal=True)
            elif route=='/api/payment-status':
                b=get_booking(d)
                if b['payment_id']:reconcile(b)
                result=Engine(state()).detail(get_booking(d))
            elif route=='/api/test-payment':
                p=provider_row(d['id'])
                if d.get('outcome'):
                    if d['outcome'] not in ('succeed','fail'):raise ValueError('Invalid test outcome.')
                    with connect() as c:c.execute('UPDATE test_provider SET status=? WHERE id=? AND status=0',(1 if d['outcome']=='succeed' else 2,p['id']))
                    b=next(b for b in state()['bookings'] if b['reference']==p['reference']);reconcile(b)
                result=provider_row(d['id'])
            elif route=='/api/refund':
                if not admin:raise PermissionError('Admin access required.')
                b=get_booking(d,True)
                if d.get('op')=='refund-status':
                    r=next((r for r in state()['refund_requests'] if r['request_key']==d.get('request_key') and r['booking_ref']==b['reference']),None)
                    if not r:raise ValueError('Refund request not found.')
                    amount=r['amount']
                else:
                    amount=int(d['amount'])
                    run(dict(op='refund-claim',reference=b['reference'],amount=amount,request_key=d.get('request_key')),ADMIN,True)
                # Uses the actual Cloudgate response contract, including pending/terminal status.
                provider={'PaymentId':b['payment_id'],'RefundId':'test-'+d['request_key'],'Amount':amount,'Currency':b['currency'],'Status':'succeeded','IdempotencyKey':'booking-refund-'+d['request_key']}
                result=run(dict(op='refund-apply',reference=b['reference'],provider=provider,request_key=d['request_key']),internal=True)
            else:return self.reply(404,{'error':'Unknown action.'})
            self.reply(200,result)
        except PermissionError as exc:self.reply(403,{'error':str(exc)})
        except (ValueError,KeyError,TypeError,sqlite3.IntegrityError) as exc:self.reply(400,{'error':str(exc)})
        except Exception as exc:
            print(type(exc).__name__,str(exc),flush=True);self.reply(500,{'error':'Request failed. Please retry.'})

def worker():
    while True:
        time.sleep(30)
        try:
            for b in state()['bookings']:
                if b['status'] in ('held','expired') and b['payment_id']:reconcile(b)
            run({'op':'maintenance'},internal=True)
        except Exception as exc:print('Maintenance:',str(exc),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--db',default=str(ROOT.parent/'.local'/'booking.sqlite'));p.add_argument('--port',type=int,default=3003);args=p.parse_args();DB=args.db
    Path(DB).parent.mkdir(parents=True,exist_ok=True)
    with connect() as c:
        c.executescript((ROOT/'schema.sql').read_text());c.executescript((ROOT/'seed.sql').read_text())
        c.execute('CREATE TABLE IF NOT EXISTS test_provider(id TEXT PRIMARY KEY, reference TEXT, amount INTEGER, currency TEXT, status INTEGER)')
    threading.Thread(target=worker,daemon=True).start()
    print('Booking development API: http://127.0.0.1:'+str(args.port)+' (TEST PAYMENTS ONLY)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
