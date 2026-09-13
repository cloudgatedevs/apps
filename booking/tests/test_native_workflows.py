"""Execute generated node scripts against SQLite with a stubbed Cloudgate session and Wallet.
This checks the packaged scripts and wiring, in addition to engine unit tests. It does not
replace a Cloudgate-hosted sandbox payment test after publication.
"""
import json
from pathlib import Path
import secrets
import sqlite3
import sys
import textwrap
import time
import types
import unittest
import test_engine as engine_tests
ADMIN=engine_tests.ADMIN
ROOT=Path(__file__).parents[1]/'cloudgate'

class NativeTests(unittest.TestCase):
 setUp=engine_tests.BookingTests.setUp
 tearDown=engine_tests.BookingTests.tearDown
 snapshot=engine_tests.BookingTests.snapshot
 run_op=engine_tests.BookingTests.run_op
 slot=engine_tests.BookingTests.slot
 hold=engine_tests.BookingTests.hold
 pay=engine_tests.BookingTests.pay
 def native(self,route,request,user=None,wallet=None):
  graph=json.loads((ROOT/'workflows'/route/'graph.json').read_text())
  nodes={n['Id']:n for n in graph['Nodes']};self.keys={'body':json.dumps(request)}
  scope=types.SimpleNamespace(GetKeys=lambda sid:[types.SimpleNamespace(Key=k,Value=v) for k,v in self.keys.items()])
  modules={'clr':types.SimpleNamespace(AddReference=lambda name:None),'Web.Core.Shared.Services.Endpoints.Engine':types.SimpleNamespace(WorkflowSessionKeyExecutionContext=scope)}
  old={key:sys.modules.get(key) for key in modules};sys.modules.update(modules)
  current=graph['Endpoint']['NodeId'];count=0;last=None
  try:
   while current:
    count+=1;self.assertLessEqual(count,25);n=nodes[current];script=n.get('MainScript') or ''
    if n['NodeType']==9:result=json.dumps(user or None)
    elif n['NodeType']==11:
     if not wallet:raise AssertionError('Unexpected Wallet call')
     params=dict(n)
     for field in [f'Param{i}' for i in range(1,11)]:
      if isinstance(params.get(field),str):
       for k,v in self.keys.items():params[field]=params[field].replace('${'+k+'}',str(v))
     result=json.dumps(wallet(params,self.keys))
    elif n['NodeType']==5:
     for k,v in self.keys.items():script=script.replace('${'+k+'}',str(v))
     if script.startswith('BEGIN'):
      try:
       tail=script.rsplit('COMMIT;',1)[1].strip();self.db.executescript(script);result=json.dumps([dict(r) for r in self.db.execute(tail)])
      except Exception:self.db.rollback();raise
     else:result=json.dumps([dict(r) for r in self.db.execute(script)])
    else:
     script=script.replace('${sessionid}','123');namespace={}
     exec('def main():\n'+textwrap.indent(script,'    '),namespace)
     result=namespace['main']()
    self.keys[n['Name']]=result;last=result
    current=n['PositiveNodeId'] if result is True else n['NegativeNodeId'] if n['NodeType']==4 else n['NodeId']
   return json.loads(last) if isinstance(last,str) else last
  finally:
   for key,value in old.items():
    if value is None:sys.modules.pop(key,None)
    else:sys.modules[key]=value
 def test_native_public_catalog(self):
  result=self.native('booking',{'op':'catalog'});self.assertEqual(len(result['services']),6)
 def test_native_service_photo_create_edit_and_delete(self):
  created=self.native('booking',dict(op='admin-save',entity='services',record=dict(name='Guitar lesson',category='Lessons',price=25000,active=1,staff_ids=[1],image_url='https://cdn.example/guitar.jpg')),ADMIN)
  ident=created['Id']
  service=next(s for s in self.native('booking',{'op':'catalog'})['services'] if s['Id']==ident)
  self.assertEqual(service['image_url'],'https://cdn.example/guitar.jpg')
  self.native('booking',dict(op='admin-save',entity='services',record=dict(Id=ident,name='Advanced guitar lesson',image_url='',price=35000)),ADMIN)
  self.assertEqual(next(s for s in self.native('booking',{'op':'catalog'})['services'] if s['Id']==ident)['price'],35000)
  with self.assertRaisesRegex(ValueError,'Admin access'):self.native('booking',dict(op='admin-delete-service',Id=ident))
  self.native('booking',dict(op='admin-delete-service',Id=ident),ADMIN)
  self.assertNotIn(ident,[s['Id'] for s in self.native('booking',{'op':'catalog'})['services']])
 def test_native_admin_rejected(self):
  with self.assertRaisesRegex(ValueError,'Admin access'):self.native('booking',{'op':'admin-data'})
 def test_native_admin_allowed(self):
  result=self.native('booking',{'op':'admin-data'},ADMIN);self.assertIn('customers',result)
 def test_native_account_identity_reaches_checkout_and_status(self):
  user={'Id':42,'Role':'Customer','Email':'account@example.com','IsActive':True}
  self.run_op('admin-settings',settings={'website_url':'https://studio.example'},_identity=ADMIN)
  slot=self.slot();b=self.native('booking',dict(op='hold',service_ids=[1],starts=slot['starts'],staff_id=slot['staff_id'],name='Account Test',email=user['Email'],consent=True,token=self.token,request_key=secrets.token_hex(16)),user)
  req={'reference':b['reference']};calls=[]
  def wallet(n,keys):
   calls.append(n['Param1'])
   return {'Id':456,'PaymentUrl':'https://wallet.example/pay/456','GrossAmount':75000,'Currency':'ZAR','Status':1}
  for route in ('checkout','payment-status'):
   with self.assertRaisesRegex(ValueError,'not found or link expired'):self.native(route,req,{**user,'Id':43},wallet)
  self.assertEqual(calls,[])
  self.native('checkout',req,user,wallet)
  self.assertEqual(self.native('payment-status',req,user,wallet)['status'],'confirmed')
  self.assertEqual(calls,['create','get'])
  self.assertEqual(self.native('booking',{'op':'account'},user)['bookings'][0]['reference'],b['reference'])
 def test_native_quote_and_frontdesk_reservation(self):
  quote=self.native('booking',{'op':'quote','service_ids':[1]})
  self.assertEqual(quote['due'],75000)
  slot=self.slot();key=secrets.token_hex(16)
  request=dict(op='admin-hold',quote=quote,service_ids=[1],starts=slot['starts'],staff_id=slot['staff_id'],name='Native Front Desk',email='native-frontdesk@example.com',consent=True,token=self.token,request_key=key)
  with self.assertRaisesRegex(ValueError,'Admin access'):self.native('booking',request)
  result=self.native('booking',request,ADMIN);self.assertEqual(result['status'],'held')
  self.native('booking',dict(op='admin-abandon-hold',request_key=key),ADMIN)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'cancelled')
 def test_native_request_text_cannot_become_python(self):
  slot=self.slot();value='"""; raise Exception("INJECTED") # ${IdpAuth}'
  request=dict(op='hold',service_ids=[1],starts=slot['starts'],staff_id=slot['staff_id'],name="O'Brien",email='safe@example.com',consent=True,notes=value,token=self.token,request_key=secrets.token_hex(16))
  result=self.native('booking',request);fresh=self.run_op('get',reference=result['reference'],token=self.token);self.assertEqual(fresh['notes'],value)
 def test_native_wallet_lifecycle_and_refund(self):
  self.run_op('admin-settings',settings={'website_url':'https://studio.example'},_identity=ADMIN)
  b=self.hold();req={'reference':b['reference'],'token':self.token}
  calls=[]
  def wallet(n,keys):
   calls.append(n['Param1'])
   if n['Param1']=='create':
    self.assertEqual(int(keys['Amount']),75000)
    return {'Id':123,'PaymentUrl':'https://wallet.example/pay/123','GrossAmount':75000,'Currency':'ZAR','Status':0}
   if n['Param1']=='get':return {'Id':123,'GrossAmount':75000,'Currency':'ZAR','Status':1}
   if n['Param1']=='refund':return {'RefundId':'re_456','PaymentId':123,'Amount':10000,'Currency':'ZAR','Status':'succeeded','IdempotencyKey':n['Param9']}
  self.assertIn('payment_url',self.native('checkout',req,wallet=wallet))
  fresh=self.native('payment-status',req,wallet=wallet);self.assertEqual(fresh['status'],'confirmed')
  key=secrets.token_hex(16);self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,wallet)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],10000)
  self.assertEqual(self.snapshot()['refund_requests'][0]['status'],'succeeded')
  self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,wallet)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],10000)
  self.assertEqual(calls.count('refund'),2) # The same key is replayed; the platform returns the existing refund.
 def test_native_status_without_payment(self):
  b=self.hold();result=self.native('payment-status',dict(reference=b['reference'],token=self.token));self.assertEqual(result['status'],'held')
 def test_native_pending_refund_is_reconciled_without_resubmitting(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16);calls=[]
  def wallet(n,keys):
   calls.append(n['Param1'])
   return dict(PaymentId=self.snapshot()['bookings'][0]['payment_id'],RefundId='re_pending',Amount=10000,Currency='ZAR',Status='pending' if n['Param1']=='refund' else 'succeeded',IdempotencyKey=n['Param9'])
  response=self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,wallet)
  self.assertEqual(response['status'],'pending');self.assertEqual(self.snapshot()['bookings'][0]['refunded'],0)
  self.native('reconcile',{},wallet=wallet)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],10000)
  self.assertEqual(calls,['refund','refund-status'])
 def test_native_failed_refund_does_not_change_booking_ledger(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  def wallet(n,keys):return dict(PaymentId=self.snapshot()['bookings'][0]['payment_id'],RefundId='re_failed',Amount=10000,Currency='ZAR',Status='failed',IdempotencyKey=n['Param9'])
  response=self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,wallet)
  self.assertEqual(response['status'],'failed');self.assertEqual(self.snapshot()['bookings'][0]['refunded'],0)
  self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=secrets.token_hex(16),_identity=ADMIN,_internal=True)
 def test_native_uncertain_refund_remains_reserved(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  def wallet(n,keys):return dict(PaymentId=self.snapshot()['bookings'][0]['payment_id'],RefundId=None,Amount=10000,Currency='ZAR',Status='reconciliation_required',IdempotencyKey=n['Param9'])
  self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,wallet)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],0)
  with self.assertRaisesRegex(ValueError,'already pending'):self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=secrets.token_hex(16),_identity=ADMIN,_internal=True)
 def test_native_rejects_wrong_refund_contract(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  with self.assertRaisesRegex(ValueError,'does not match'):self.native('refund',dict(reference=b['reference'],amount=10000,request_key=key),ADMIN,lambda n,k:dict(Id='wrong',Amount=10000))
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],0)
 def test_native_refund_status_is_read_only_at_provider(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=key,_identity=ADMIN,_internal=True)
  def wallet(n,keys):
   self.assertEqual(n['Param1'],'refund-status')
   return dict(PaymentId=self.snapshot()['bookings'][0]['payment_id'],RefundId='re_checked',Amount=10000,Currency='ZAR',Status='succeeded',IdempotencyKey=n['Param9'])
  self.native('refund',dict(op='refund-status',reference=b['reference'],request_key=key),ADMIN,wallet)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],10000)
 def test_native_reconcile_no_candidate(self):
  result=self.native('reconcile',{});self.assertTrue(result['ok'])
 def test_native_email_empty_queue_does_not_send(self):
  result=self.native('notifications',{});self.assertEqual(result['processed'],0)

if __name__=='__main__':unittest.main()
