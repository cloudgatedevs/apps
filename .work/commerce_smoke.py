import ast,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'test_support'))
import sqlserver
failures=[]
read_ops={'list','get','stats','sales-by-day','top-products','recent-orders','stock','low-stock','movements','image-refs','levels','receipts','settings','categories','products','current','registers','summary','held','recent','orders','me','nav','search','by-day','by-product','by-category','by-teller','by-payment','top-tellers','sales-by-category','payment-methods','sales','products','categories','tellers','payments','tax','stock-value','summary','overview'}
for app in ['shop','pos']:
    spec=importlib.util.spec_from_file_location(app+'_fixture',ROOT/app/'tests/workflow_fixture.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
    with sqlserver.connect() as db:
        db.executescript((ROOT/app/'cloudgate/schema.sql').read_text(encoding='utf8'));db.executescript((ROOT/app/'cloudgate/sample-data.sql').read_text(encoding='utf8'))
        def call(route,body):return f.workflow(db,route,body,'Admin')
        for route in f.GRAPHS:
            if route in ['refunds','checkout','payment-status','payment-reconcile','pos-payment','pos-receipt','payments','cart','contact','newsletter']:continue
            source='\n'.join(p.read_text(encoding='utf8') for p in (ROOT/app/'cloudgate/workflows'/route).glob('*.py'))
            ops={n.value for n in ast.walk(ast.parse(source)) if isinstance(n,ast.Constant) and isinstance(n.value,str)} & read_ops
            for op in sorted(ops):
                try:call(route,dict(op=op,id=1,productId=1,shiftId=1,saleId=1,fromDate='2026-01-01',toDate='2026-12-31',slug='about'))
                except Exception as e:
                    if isinstance(e,sqlserver.Error) or isinstance(e,(KeyError,NameError,TypeError)):failures.append((app,route,op,str(e)))
        try:
            if app=='shop':
                cart=call('cart',dict(op='add',variantId=1,qty=2));print('shop cart',cart)
                token=cart.get('Token') or cart.get('token')
                cart=call('cart',dict(op='update',token=token,variantId=1,qty=1));print('shop update',cart.get('Token'))
                result=call('checkout',dict(op='start',token=token,email='test@example.test',name='Test',shippingAddress=dict(line1='1 Road',city='Town',postalCode='0001',country='ZA')));print('shop checkout',result)
            else:
                print('pos shift',call('pos-shift',dict(op='open',registerId=1,floatCents=1000)))
                result=call('pos-sale',dict(op='complete',lines=[dict(productId=1,qty=2)],payments=[dict(method='cash',tenderedCents=100000)]));print('pos cash',result)
        except Exception as e:
            import traceback
            traceback.print_exc();failures.append((app,'purchase','scenario',str(e)))
(ROOT/'.work/commerce-smoke-failures.json').write_text(json.dumps(failures,indent=2),encoding='utf8')
print('FAILURES',len(failures))
for failure in failures:print(failure)
