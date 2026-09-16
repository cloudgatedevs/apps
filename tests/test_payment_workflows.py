"""Execute packaged payment graphs using SQLite and the native Wallet DTO contract.

No HTTP calls, charges, refunds or emails leave this test. Run from the repo root:
python -B -m unittest discover -s tests -p test_payment_workflows.py -v
"""
import json
from pathlib import Path
import re
import sqlite3
import sys
import time
import types
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
ADMIN = dict(Id='1', Role='Admin', IsActive=True, Name='Admin', Email='admin@example.invalid')
CUSTOMER = dict(Id='2', Role='User', IsActive=True, Name='Guest', Email='guest@example.invalid')


class NativeGraph:
    def __init__(self, app):
        self.app = app
        self.db = sqlite3.connect(':memory:', isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript((ROOT/app/'.template/schema.sql').read_text(encoding='utf8'))
        self.db.executescript((ROOT/app/'.template/sample-data.sql').read_text(encoding='utf8'))
        self.bundle = json.loads((ROOT/app/'.template/workflow-template.json').read_text(encoding='utf8'))['Projects'][0]['Template']
        self.calls = []

    def rows(self, kind):
        return [json.loads(r[0]) for r in self.db.execute('SELECT data FROM entities WHERE kind=?', (kind,))]

    def sql(self, script):
        statement, result = '', []
        try:
            for c in script:
                statement += c
                if c == ';' and sqlite3.complete_statement(statement):
                    cursor = self.db.execute(statement)
                    if cursor.description: result = [dict(r) for r in cursor.fetchall()]
                    statement = ''
            if statement.strip():
                cursor = self.db.execute(statement)
                if cursor.description: result = [dict(r) for r in cursor.fetchall()]
            return json.dumps(result)
        except Exception:
            self.db.rollback()
            raise

    def run(self, route, body=None, identity=ADMIN, wallet=None, scheduled=False, origin='https://merchant.example'):
        endpoint = next(e for e in self.bundle['Endpoints'] if e['Route'] == route)
        nodes = {n['Id']:n for n in self.bundle['Nodes'] if n['EndpointId'] == endpoint['Id']}
        values = {'body':json.dumps(body or {}), 'sessionid':'123', 'newguid':str(uuid.uuid4()), 'route':'Scheduled Job' if scheduled else '/sbx/'+self.app+'/'+route}
        if origin and not scheduled: values['Header_Origin'] = origin
        context = types.SimpleNamespace(GetKeys=lambda sid:[types.SimpleNamespace(Key=k, Value=v) for k,v in values.items()])
        modules = {'clr':types.SimpleNamespace(AddReference=lambda name:None), 'Web.Core.Shared.Services.Endpoints.Engine':types.SimpleNamespace(WorkflowSessionKeyExecutionContext=context)}
        original = {k:sys.modules.get(k) for k in modules}
        sys.modules.update(modules)
        def substitute(s):
            return re.sub(r'\$\{([^}]+)\}', lambda m:str(values.get(m[1], m[0])), s or '')
        current = endpoint['NodeId']
        try:
            for _ in range(60):
                node = nodes[current]
                kind, script = node['NodeType'], node.get('MainScript') or ''
                if kind == 9:
                    result = json.dumps(identity if node.get('IdpOuputType') == 2 else identity['Id'])
                elif kind == 5: result = self.sql(substitute(script))
                elif kind == 11:
                    params = {f'Param{i}':substitute(node.get(f'Param{i}')) for i in range(1,11)}
                    self.calls.append(params)
                    if wallet is None: raise AssertionError('Unexpected Wallet call')
                    result = json.dumps(wallet(params))
                elif kind in (1,4):
                    # The modern bridge reads session keys. Older graphs substitute placeholders.
                    script = script.replace('${sessionid}','123') if 'WorkflowSessionKeyExecutionContext' in script else substitute(script)
                    # Match PythonProvider.PrepLambda for JSON interpolated into legacy scripts.
                    script = script.replace(chr(92)+chr(34), chr(92)*2+chr(34))
                    namespace = {}
                    exec('def invoke():\n'+''.join('    '+line+'\n' for line in script.splitlines()), namespace)
                    result = namespace['invoke']()
                elif node.get('WebSocketId'): result = '{}' # Notification transport stub; no messages sent.
                else: raise AssertionError('Unexpected node type '+str(kind))
                values[node['Name']] = str(result)
                current = (node.get('PositiveNodeId') if result else node.get('NegativeNodeId')) if kind == 4 else node.get('NodeId')
                if not current:
                    return json.loads(result) if isinstance(result,str) else result
            raise AssertionError('Workflow did not terminate')
        finally:
            for key, value in original.items():
                if value is None: sys.modules.pop(key,None)
                else: sys.modules[key]=value


class PaymentGraphTests(unittest.TestCase):
    def commerce(self, app, provider_patch=None, origin='https://merchant.example', configured='https://merchant.example'):
        g=NativeGraph(app)
        g.db.execute("INSERT INTO settings(Key,Value) VALUES('store_url',?) ON CONFLICT(Key) DO UPDATE SET Value=excluded.Value",(configured,))
        if app=='shop':
            g.db.executescript("""
                INSERT INTO products(Id,Name,Slug,TrackInventory,Status,PriceCents) VALUES(9001,'Test','payment-test',1,'active',500);
                INSERT INTO product_variants(Id,ProductId,StockQty,IsActive) VALUES(9001,9001,10,1);
                INSERT INTO carts(Id,Token,Status) VALUES(9001,'payment-test-cart','open');
                INSERT INTO cart_items(CartId,ProductId,VariantId,Qty,UnitPriceCents) VALUES(9001,9001,9001,2,500);
            """)
            request=dict(op='start',token='payment-test-cart',email=CUSTOMER['Email'],name='Guest',shippingAddress=dict(line1='Test',city='Test',postalCode='1000',country='ZA'))
            route='checkout'
        else:
            g.db.executescript("""
                INSERT INTO products(Id,Name,StockQty,TrackInventory) VALUES(9001,'Test',10,1);
                INSERT INTO shifts(Id,RegisterId,TellerUserId,Status) VALUES(9001,1,1,'open');
                INSERT INTO sales(Id,Reference,ShiftId,RegisterId,TellerUserId,TotalCents,Status) VALUES(9001,'PAYMENT-TEST',9001,1,1,1000,'open');
                INSERT INTO sale_items(Id,SaleId,ProductId,Name,Qty,LineTotalCents) VALUES(9001,9001,9001,'Test',2,1000);
            """)
            request=dict(op='start',saleId=9001)
            route='pos-payment'
        payment={}
        def create(p):
            self.assertEqual(p['Param1'],'create')
            self.assertTrue(p['Param7'].startswith((configured or origin)+'/'))
            self.assertTrue(p['Param8'].startswith((configured or origin)+'/'))
            self.assertTrue(p['Param9'])
            payment.update(Id=71001,GrossAmount=int(p['Param2']),Currency=p['Param3'],PaymentUrl='https://checkout.example/pay/71001',Status=0)
            payment.update(provider_patch or {})
            return payment
        try: checkout=g.run(route,request,ADMIN,create,origin=origin)
        except Exception:
            g.db.close()
            raise
        status_request=dict(reference=checkout['reference'],token=request['token']) if app=='shop' else dict(op='status',saleId=9001)
        return g, payment, status_request

    def test_shop_and_pos_derive_return_url_with_empty_settings(self):
        for app in ['shop','pos']:
            for origin in ['https://custom.example','http://localhost:3007','http://127.0.0.1:3007']:
                with self.subTest(app=app,origin=origin):
                    g,_,_=self.commerce(app,origin=origin,configured='')
                    g.db.close()

    def test_newer_apps_derive_local_return_url_and_honor_override(self):
        for app in ['events','courses','jobs']:
            for origin,configured in [('http://localhost:3007',''),('https://custom.example','https://override.example/base')]:
                with self.subTest(app=app,origin=origin,configured=configured):
                    g=NativeGraph(app)
                    try:
                        order=self.make_order(g)
                        g.db.execute("UPDATE settings SET value=? WHERE key='website_url'",(configured,))
                        def wallet(p):
                            path='/learn?payment=' if app=='courses' else '/account?payment='
                            self.assertEqual(p['Param7'],(configured or origin)+path+order['ref'])
                            self.assertEqual(p['Param8'],p['Param7'])
                            return dict(Id=71001,PaymentUrl='https://checkout.example/pay/71001',GrossAmount=order['amount'],Currency=order['currency'],Status=0)
                        g.run('checkout',dict(ref=order['ref']),CUSTOMER,wallet,origin=origin)
                    finally: g.db.close()

    def test_shop_and_pos_paid_pending_failed_and_idempotent_stock(self):
        for app in ['shop','pos']:
            for status in [1,2,3]:
                with self.subTest(app=app,status=status):
                    g,payment,request=self.commerce(app)
                    route='payment-status' if app=='shop' else 'pos-payment'
                    stock_table='product_variants' if app=='shop' else 'products'
                    def wallet(p):
                        self.assertEqual(p['Param1'],'get')
                        self.assertEqual(p['Param10'],'71001')
                        return payment
                    try:
                        g.run(route,request,ADMIN,wallet)
                        self.assertEqual(g.db.execute(f'SELECT StockQty FROM {stock_table} WHERE Id=9001').fetchone()[0],10)
                        payment['Status']=status
                        g.run(route,request,ADMIN,wallet)
                        if app=='shop' or status==1: g.run(route,request,ADMIN,wallet)
                        self.assertEqual(g.db.execute(f'SELECT StockQty FROM {stock_table} WHERE Id=9001').fetchone()[0],8 if status==1 else 10)
                        if app=='shop': self.assertEqual(g.db.execute('SELECT ReservedQty FROM product_variants WHERE Id=9001').fetchone()[0],0)
                        else: self.assertEqual(g.db.execute('SELECT PaidCents FROM sales WHERE Id=9001').fetchone()[0],1000 if status==1 else 0)
                    finally: g.db.close()

    def test_shop_and_pos_reject_mismatched_wallet_results(self):
        for app in ['shop','pos']:
            for field,bad_value in [('Id',9999),('GrossAmount',1),('Currency','XXX')]:
                with self.subTest(app=app,field=field):
                    g,payment,request=self.commerce(app)
                    try:
                        payment.update(Status=1)
                        payment[field]=bad_value
                        with self.assertRaisesRegex(Exception,'do not match'):
                            g.run('payment-status' if app=='shop' else 'pos-payment',request,ADMIN,lambda p:payment)
                    finally: g.db.close()

    def test_shop_and_pos_reject_bad_checkout_before_redirect(self):
        for app in ['shop','pos']:
            for patch in [{'GrossAmount':1},{'Currency':'XXX'},{'PaymentUrl':'javascript:alert(1)'}]:
                with self.subTest(app=app,patch=patch):
                    with self.assertRaisesRegex(Exception,'do not match|secure checkout'):
                        self.commerce(app,patch)

    def make_order(self, graph):
        if graph.app == 'events':
            now=int(time.time())
            event=graph.run('events',dict(op='event-save',title='Checkout test',summary='Test',description='Test',venue='Test',organiser='Test',starts=now+86400,ends=now+90000,capacity=3,currency='USD'))
            tier=graph.run('events',dict(op='tier-save',event=event['ref'],name='Test',price=3500,capacity=3))
            graph.run('events',dict(op='event-publish',ref=event['ref'],version=event['version']))
            return graph.run('orders',dict(op='reserve',tier=tier['ref'],quantity=1,attendees=['Guest'],request_key=str(uuid.uuid4())),CUSTOMER)
        if graph.app == 'courses':
            course=next(r for r in graph.rows('course') if r['price']>0)
            graph.run('enrollments',dict(op='enroll',course=course['ref']),CUSTOMER)
            return graph.rows('order')[0]
        customer=graph.run('jobs',dict(op='customer-save',name='Guest',email=CUSTOMER['Email'],user_id='2'))
        request=graph.run('requests',dict(op='request-create',title='Repair',description='Repair',address='Test',request_key=str(uuid.uuid4())),CUSTOMER)
        quote=graph.run('quotes',dict(op='quote-save',request=request['ref'],lines=[dict(name='Labour',quantity=1,rate=10000)],deposit_percent=30,expires=int(time.time())+86400))
        quote=graph.run('quotes',dict(op='quote-send',ref=quote['ref'],version=quote['version']))
        graph.run('quotes',dict(op='quote-accept',ref=quote['ref'],version=quote['version']),CUSTOMER)
        return graph.rows('obligation')[0]

    def test_checkout_status_retry_and_pending_refund_in_each_packaged_app(self):
        for app in ['events','courses','jobs']:
            with self.subTest(app=app):
                g=NativeGraph(app)
                try:
                    order=self.make_order(g)
                    request=dict(ref=order['ref'])
                    with self.assertRaisesRegex(ValueError,'Open checkout from the app website'):
                        g.run('checkout',request,CUSTOMER,origin='')
                    self.assertEqual(g.calls,[],'No origin or override must fail before creating a payment')
                    for invalid in ['null','javascript:alert(1)','http://external.example','https://good.example@evil.example','https://good.example/?next=bad']:
                        with self.assertRaises(ValueError):g.run('checkout',request,CUSTOMER,origin=invalid)
                    self.assertEqual(g.calls,[],'Invalid origins must fail before creating a payment')
                    status=[0]
                    def wallet(p):
                        operation=p['Param1']
                        if operation=='create':
                            self.assertEqual(int(p['Param2']),order['amount'])
                            self.assertEqual(p['Param3'],order['currency'])
                            self.assertEqual(p['Param5'],order['ref'])
                            self.assertEqual(p['Param9'],app+'-'+order['ref'])
                            self.assertTrue(p['Param7'].startswith('https://merchant.example/'))
                            self.assertEqual(p['Param7'],p['Param8'])
                            return dict(Id=71001,PaymentUrl='https://checkout.example/pay/71001',GrossAmount=order['amount'],Currency=order['currency'],Status=0)
                        self.assertEqual(int(p['Param10']),71001)
                        if operation=='get':
                            return dict(Id=71001,GrossAmount=order['amount'],Currency=order['currency'].lower(),Status=status[0])
                        self.assertIn(operation,['refund','refund-status'])
                        return dict(PaymentId=71001,Amount=order['amount'],Currency=order['currency'].lower(),IdempotencyKey=p['Param9'],RefundId='re_test_1',Status='pending' if operation=='refund' else 'succeeded')
                    checkout=g.run('checkout',request,CUSTOMER,wallet)
                    self.assertEqual(checkout['payment_url'],'https://checkout.example/pay/71001')
                    self.assertEqual(g.run('checkout',request,CUSTOMER,wallet),checkout)
                    self.assertEqual(g.run('payment-status',request,CUSTOMER,wallet)['status'],'pending')
                    status[0]=1
                    paid=g.run('payment-status',request,CUSTOMER,wallet)
                    self.assertEqual(paid['status'],'succeeded')
                    self.assertEqual(g.run('payment-status',request,CUSTOMER,wallet)['status'],'succeeded')
                    refund_ref=paid['ref'] if app=='jobs' else order['ref']
                    refund=g.run('refund',dict(ref=refund_ref,amount=order['amount'],request_key='payment-regression-refund-0001'),ADMIN,wallet)
                    self.assertEqual(refund['status'],'pending')
                    g.run('refund-reconcile',identity=ADMIN,wallet=wallet,scheduled=True)
                    self.assertEqual(g.rows('refund')[0]['status'],'succeeded')
                    self.assertEqual([p['Param1'] for p in g.calls].count('refund'),1)
                    if app=='events': self.assertEqual(g.rows('ticket')[0]['status'],'refunded')
                    if app=='courses': self.assertEqual(g.rows('enrollment')[0]['status'],'refunded')
                finally: g.db.close()

if __name__=='__main__': unittest.main()
