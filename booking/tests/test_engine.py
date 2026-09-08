import datetime as dt
import json
from pathlib import Path
import secrets
import sqlite3
import sys
import time
import unittest
sys.path.insert(0,str(Path(__file__).parents[1]/'cloudgate'))
from engine import Engine, TABLES, plan, snapshot_sql
ROOT=Path(__file__).parents[1]/'cloudgate'
ADMIN={'Role':'Admin','Email':'admin@example.com','IsActive':True}

class BookingTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
  self.db.executescript((ROOT/'schema.sql').read_text()+(ROOT/'seed.sql').read_text())
  self.now=int(time.time());self.token=secrets.token_hex(32)
 def tearDown(self):self.db.close()
 def snapshot(self):return {t:[dict(r) for r in self.db.execute('SELECT * FROM '+t)] for t in TABLES}
 def run_op(self,op,**kwargs):
  identity=kwargs.pop('_identity',None);internal=kwargs.pop('_internal',False);now=kwargs.pop('_now',self.now)
  sql,result=plan(self.snapshot(),dict(op=op,**kwargs),identity,now,internal)
  try:self.db.executescript(sql)
  except Exception:self.db.rollback();raise
  return result
 def slot(self,service_ids=None,staff_id=1,day=2):
  e=Engine(self.snapshot(),now=self.now)
  for n in range(day,day+7):
   date=(dt.datetime.fromtimestamp(self.now,e.tz)+dt.timedelta(days=n)).date().isoformat()
   slots=e.availability(dict(service_ids=service_ids or [1],date=date,staff_id=staff_id))['slots']
   if slots:return slots[0]
  self.fail('Expected available slot')
 def hold(self,slot=None,**extra):
  slot=slot or self.slot();d=dict(service_ids=[1],staff_id=slot['staff_id'],starts=slot['starts'],name='Test Customer',email='test@example.com',phone='+27 123',consent=True,token=self.token,request_key=secrets.token_hex(16));d.update(extra)
  return self.run_op('hold',**d)
 def pay(self,b,amount=None,now=None):
  self.run_op('payment-save',reference=b['reference'],payment_id='wallet-1',payment_url='https://wallet.example/checkout',_internal=True)
  return self.run_op('payment-apply',reference=b['reference'],provider={'Id':'wallet-1','Status':1},amount=amount or b['due'],currency='ZAR',_internal=True,_now=now or self.now)
 def test_snapshot_query_matches_python_snapshot(self):
  self.assertEqual(json.loads(self.db.execute(snapshot_sql()).fetchone()[0]),self.snapshot())
 def test_hold_does_not_confirm_without_payment(self):
  b=self.hold();self.assertEqual(b['status'],'held');self.assertEqual(self.snapshot()['payments'],[])
 def test_account_requires_active_server_identity(self):
  for identity in (None,{'Id':5},{'Id':5,'IsActive':False},{'Id':True,'IsActive':True}):
   with self.assertRaisesRegex(ValueError,'sign in'):self.run_op('account',_identity=identity,Id=5,IsActive=True)
 def test_account_does_not_claim_matching_email_or_admin_bookings(self):
  self.hold()
  for role in ('Customer','Admin'):
   account=self.run_op('account',_identity={'Id':5,'Email':'test@example.com','Role':role,'IsActive':True})
   self.assertEqual(account['bookings'],[])
 def test_signed_in_booking_is_owned_and_other_account_cannot_access(self):
  owner={'Id':5,'Email':'test@example.com','IsActive':True};other={**owner,'Id':6}
  b=self.hold(_identity=owner,notes='Private treatment note',intake={'1':'Private answer'})
  account=self.run_op('account',_identity=owner)
  self.assertEqual([x['reference'] for x in account['bookings']],[b['reference']])
  for key in ('token_hash','request_key','notes','intake','payment_id'):self.assertNotIn(key,account['bookings'][0])
  self.assertEqual(self.run_op('get',reference=b['reference'],_identity=owner)['reference'],b['reference'])
  for op in ('get','cancel','reschedule'):
   with self.assertRaisesRegex(ValueError,'not found or link expired'):self.run_op(op,reference=b['reference'],_identity=other)
  self.assertEqual(self.run_op('account',_identity=other)['bookings'],[])
  self.run_op('cancel',reference=b['reference'],_identity=owner)
  self.assertEqual(self.run_op('account',_identity=owner)['bookings'][0]['status'],'cancelled')
 def test_guest_claim_needs_key_and_cannot_transfer_between_accounts(self):
  owner={'Id':5,'Email':'owner@example.com','IsActive':True};b=self.hold()
  with self.assertRaisesRegex(ValueError,'not found or link expired'):self.run_op('account-link',reference=b['reference'],token='bad',_identity=owner)
  for _ in range(2):self.run_op('account-link',reference=b['reference'],token=self.token,_identity=owner)
  self.assertEqual(len(self.snapshot()['booking_accounts']),1)
  with self.assertRaisesRegex(ValueError,'another account'):self.run_op('account-link',reference=b['reference'],token=self.token,_identity={**owner,'Id':6})
  self.assertEqual(self.run_op('get',reference=b['reference'],token=self.token)['reference'],b['reference'])
 def test_account_profile_is_separate_from_guest_customer_records(self):
  identity={'Id':5,'Name':'First','Surname':'Last','Email':'test@example.com','PhoneNumber':'0123','IsActive':True}
  self.hold();before=self.snapshot()['customers']
  self.assertEqual(self.run_op('account',_identity=identity)['profile']['name'],'First Last')
  self.run_op('account-profile',_identity=identity,name='Updated Name',phone='0987',email='attacker@example.com',user_id='6')
  profile=self.run_op('account',_identity=identity)['profile']
  self.assertEqual(profile,dict(name='Updated Name',email='test@example.com',phone='0987'))
  self.assertEqual(before,self.snapshot()['customers'])
  self.assertEqual(self.snapshot()['customer_accounts'][0]['user_id'],'5')
 def test_frontdesk_hold_does_not_belong_to_staff_account(self):
  slot=self.slot();self.run_op('admin-hold',service_ids=[1],staff_id=slot['staff_id'],starts=slot['starts'],name='Client',email='client@example.com',consent=True,token=self.token,request_key=secrets.token_hex(16),_identity={**ADMIN,'Id':5})
  self.assertEqual(self.snapshot()['booking_accounts'],[])
 def test_retry_after_guest_login_links_once(self):
  key=secrets.token_hex(16);first=self.hold(request_key=key)
  for _ in range(2):self.hold(request_key=key,_identity={'Id':5,'IsActive':True})
  self.assertEqual(len(self.snapshot()['bookings']),1)
  self.assertEqual(self.snapshot()['booking_accounts'][0]['booking_ref'],first['reference'])
 def test_quote_is_read_only_and_matches_discounted_deposit(self):
  self.db.execute('UPDATE services SET deposit_percent=30 WHERE Id=1')
  self.db.execute("INSERT INTO promos(code,percent,ends,active) VALUES('RESET',15,'2099-12-31',1)")
  before=self.snapshot();quote=self.run_op('quote',service_ids=[1],promo=' reset ',total=1,due=1)
  self.assertEqual(self.snapshot(),before)
  self.assertEqual((quote['total'],quote['due'],quote['balance'],quote['discount']),(63750,19125,44625,11250))
  held=self.hold(promo='RESET',quote=quote)
  self.assertEqual((held['total'],held['due']),(quote['total'],quote['due']))
 def test_changed_quote_must_be_reviewed_before_hold(self):
  quote=self.run_op('quote',service_ids=[1]);self.db.execute('UPDATE services SET price=80000 WHERE Id=1')
  with self.assertRaisesRegex(ValueError,'price has changed'):self.hold(quote=quote)
  self.assertFalse(self.snapshot()['bookings'])
 def test_frontdesk_requires_admin_and_retries_without_double_booking(self):
  slot=self.slot();request=dict(service_ids=[1],staff_id=slot['staff_id'],starts=slot['starts'],name='Front Desk Client',email='frontdesk@example.com',consent=True,token=self.token,request_key=secrets.token_hex(16))
  with self.assertRaisesRegex(ValueError,'Admin access'):self.run_op('admin-hold',**request)
  first=self.run_op('admin-hold',**request,_identity=ADMIN)
  self.run_op('admin-hold',**request,_identity=ADMIN,_now=slot['starts']+60)
  self.assertEqual(len(self.snapshot()['bookings']),1)
  self.assertEqual(first['status'],'held');self.assertEqual(first['paid'],0)
  audit=[a for a in self.snapshot()['audit'] if a['action']=='front_desk_booking']
  self.assertEqual(len(audit),1);self.assertEqual(audit[0]['actor'],ADMIN['Email'])
 def test_released_frontdesk_request_cannot_arrive_late(self):
  key=secrets.token_hex(16)
  with self.assertRaisesRegex(ValueError,'Admin access'):self.run_op('admin-abandon-hold',request_key=key)
  self.run_op('admin-abandon-hold',request_key=key,_identity=ADMIN)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'released'):self.hold(request_key=key)
  self.assertEqual(self.snapshot()['bookings'],[]);self.assertEqual(self.snapshot()['customers'],[])
 def test_release_existing_frontdesk_hold_and_protect_paid_booking(self):
  key=secrets.token_hex(16);b=self.hold(request_key=key)
  self.run_op('admin-abandon-hold',request_key=key,_identity=ADMIN)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'cancelled')
  self.assertFalse(self.snapshot()['allocations'][0]['active'])
  next_key=secrets.token_hex(16);next_booking=self.hold(request_key=next_key);self.pay(next_booking)
  with self.assertRaisesRegex(ValueError,'payment or is confirmed'):self.run_op('admin-abandon-hold',request_key=next_key,_identity=ADMIN)
 def test_abandon_rejects_inflight_stale_hold_transaction(self):
  slot=self.slot();key=secrets.token_hex(16)
  d=dict(op='hold',service_ids=[1],staff_id=slot['staff_id'],starts=slot['starts'],name='Late Request',email='late-request@example.com',consent=True,token=self.token,request_key=key)
  sql,_=plan(self.snapshot(),d,now=self.now)
  self.run_op('admin-abandon-hold',request_key=key,_identity=ADMIN)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'calendar changed'):self.db.executescript(sql)
  self.db.rollback();self.assertFalse(self.snapshot()['bookings'])
 def test_same_staff_overlap_rejected(self):
  slot=self.slot();self.hold(slot)
  with self.assertRaisesRegex(ValueError,'no longer available'):self.hold(slot,email='other@example.com')
 def test_resource_collision_across_staff(self):
  self.db.execute('UPDATE resources SET active=0 WHERE Id=2');self.db.commit()
  slot=self.slot(staff_id=1);self.hold(slot)
  with self.assertRaisesRegex(ValueError,'no longer available'):self.hold(slot,staff_id=3)
 def test_stale_snapshot_is_rejected_atomically(self):
  before=self.snapshot();slot=self.slot();d=dict(op='hold',service_ids=[1],staff_id=1,starts=slot['starts'],name='Concurrent Customer',email='race@example.com',consent=True,token=self.token,request_key=secrets.token_hex(16))
  sql,_=plan(before,d,now=self.now);self.hold(slot)
  with self.assertRaisesRegex(sqlite3.IntegrityError,'calendar changed'):self.db.executescript(sql)
  self.db.rollback();self.assertEqual(len(self.snapshot()['bookings']),1)
 def test_sql_trigger_rejects_direct_overlap(self):
  b=self.hold();a=self.snapshot()['allocations'][0]
  with self.assertRaisesRegex(sqlite3.IntegrityError,'just booked'):
   self.db.execute('INSERT INTO allocations(booking_ref,service_id,staff_id,resource_id,starts,ends,service_name,price,duration) VALUES(?,?,?,?,?,?,?,?,?)',(b['reference'],1,1,1,a['starts'],a['ends'],'Collision',1,60))
 def test_payment_is_idempotent(self):
  b=self.hold();self.pay(b)
  for _ in range(2):self.run_op('payment-apply',reference=b['reference'],provider={'Id':'wallet-1','Status':1},amount=b['due'],currency='ZAR',_internal=True)
  fresh=self.run_op('get',reference=b['reference'],token=self.token)
  self.assertEqual(fresh['status'],'confirmed');self.assertEqual(fresh['paid'],75000);self.assertEqual(len(self.snapshot()['payments']),1);self.assertEqual(len(self.snapshot()['messages']),3)
 def test_payment_rejects_spoof_and_wrong_amount(self):
  b=self.hold()
  with self.assertRaisesRegex(ValueError,'provider'):self.run_op('payment-apply',reference=b['reference'])
  with self.assertRaisesRegex(ValueError,'amount or currency'):self.pay(b,amount=1)
 def test_late_payment_never_steals_slot(self):
  b=self.hold();self.pay(b,now=b['expires']+1)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'payment_review');self.assertEqual(self.snapshot()['allocations'][0]['active'],0)
 def test_cancel_frees_slot_and_preserves_history(self):
  slot=self.slot();b=self.hold(slot);self.pay(b);self.run_op('cancel',reference=b['reference'],token=self.token)
  cancelled=self.run_op('get',reference=b['reference'],token=self.token)
  self.assertEqual(cancelled['status'],'cancelled');self.assertEqual(len(cancelled['items']),1);self.hold(slot,email='new@example.com')
 def test_cancel_cutoff(self):
  b=self.hold();self.pay(b)
  with self.assertRaisesRegex(ValueError,'window has closed'):self.run_op('cancel',reference=b['reference'],token=self.token,_now=b['starts']-60)
 def test_reschedule_retains_payment(self):
  b=self.hold();self.pay(b);slot=self.slot(day=4)
  self.run_op('reschedule',reference=b['reference'],token=self.token,starts=slot['starts'],staff_id=slot['staff_id'])
  fresh=self.run_op('get',reference=b['reference'],token=self.token);self.assertEqual(fresh['starts'],slot['starts']);self.assertEqual(fresh['paid'],75000)
 def test_access_control(self):
  b=self.hold()
  with self.assertRaisesRegex(ValueError,'access'):self.run_op('admin-data')
  with self.assertRaisesRegex(ValueError,'not found'):self.run_op('get',reference=b['reference'],token='bad')
  data=self.run_op('admin-data',_identity=ADMIN);self.assertNotIn('smtp_password',data['settings']);self.assertNotIn('token_hash',data['bookings'][0])
 def test_multi_service_and_breaks(self):
  slot=self.slot([1,6]);b=self.hold(slot,service_ids=[1,6]);self.assertEqual(b['total'],117000);self.assertEqual(len(b['items']),2)
  self.assertEqual(b['ends']-b['starts'],115*60)
 def test_qualification(self):
  with self.assertRaisesRegex(ValueError,'no longer available'):self.hold(self.slot(),staff_id=2)
 def test_quote_is_server_priced(self):
  b=self.hold(price=1,total=1);self.assertEqual(b['total'],75000)
 def test_deposit_balance_and_completion(self):
  self.run_op('admin-save',entity='services',record={'Id':1,'deposit_percent':50},_identity=ADMIN)
  b=self.hold();self.assertEqual(b['due'],37500);self.pay(b)
  self.run_op('admin-status',reference=b['reference'],status='arrived',_identity=ADMIN)
  with self.assertRaisesRegex(ValueError,'outstanding'):self.run_op('admin-status',reference=b['reference'],status='completed',_identity=ADMIN)
  self.run_op('admin-cash',reference=b['reference'],amount=37500,request_key=secrets.token_hex(16),_identity=ADMIN)
  self.run_op('admin-status',reference=b['reference'],status='completed',_identity=ADMIN)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'completed')
 def test_refund_idempotency_and_bounds(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=key,_identity=ADMIN,_internal=True)
  provider=dict(PaymentId='payment1',RefundId='refund1',Amount=10000,Currency='ZAR',Status='succeeded',IdempotencyKey='booking-refund-'+key)
  provider['PaymentId']=self.snapshot()['bookings'][0]['payment_id']
  for _ in range(2):self.run_op('refund-apply',reference=b['reference'],provider=provider,request_key=key,_internal=True)
  self.assertEqual(self.snapshot()['bookings'][0]['refunded'],10000)
  with self.assertRaises(ValueError):self.run_op('refund-claim',reference=b['reference'],amount=100000,request_key=secrets.token_hex(16),_identity=ADMIN,_internal=True)
 def test_block_rejects_existing_booking(self):
  b=self.hold()
  with self.assertRaisesRegex(sqlite3.IntegrityError,'affected appointments'):self.run_op('admin-block',starts=b['starts'],ends=b['ends'],staff_id=1,reason='Leave',_identity=ADMIN)
 def test_promo_and_validation(self):
  self.run_op('admin-save',entity='promos',record=dict(code='CALM10',percent=10,ends='2099-12-31',active=1),_identity=ADMIN)
  b=self.hold(promo='calm10');self.assertEqual(b['total'],67500)
 def test_expiry_releases_hold(self):
  b=self.hold();self.run_op('maintenance',_internal=True,_now=b['expires']+1)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'expired');self.assertEqual(self.snapshot()['allocations'][0]['active'],0)
 def test_intake_and_apostrophes_roundtrip(self):
  b=self.hold(name="O'Brien",notes="It's a test. \"quotes\"",intake={'1':'Sensitive to perfume'});fresh=self.run_op('get',reference=b['reference'],token=self.token)
  self.assertEqual(fresh['customer']['name'],"O'Brien");self.assertEqual(json.loads(fresh['intake'])['1'],'Sensitive to perfume')
 def test_checkout_request_idempotency(self):
  slot=self.slot();key=secrets.token_hex(16);a=self.hold(slot,request_key=key);b=self.hold(slot,request_key=key);self.assertEqual(a['reference'],b['reference']);self.assertEqual(len(self.snapshot()['bookings']),1)
 def test_failed_payment_releases_hold(self):
  b=self.hold();self.run_op('payment-save',reference=b['reference'],payment_id='wallet-1',payment_url='https://wallet.example/checkout',_internal=True)
  self.run_op('payment-apply',reference=b['reference'],provider={'Id':'wallet-1','Status':2},_internal=True)
  self.assertEqual(self.snapshot()['bookings'][0]['status'],'expired');self.assertEqual(self.snapshot()['bookings'][0]['paid'],0);self.assertEqual(self.snapshot()['allocations'][0]['active'],0)
 def test_refund_claim_reuses_key_and_blocks_different_pending_request(self):
  b=self.hold();self.pay(b);key=secrets.token_hex(16)
  self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=key,_identity=ADMIN,_internal=True)
  self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=key,_identity=ADMIN,_internal=True)
  self.assertEqual(len(self.snapshot()['refund_requests']),1)
  with self.assertRaisesRegex(ValueError,'already pending'):self.run_op('refund-claim',reference=b['reference'],amount=10000,request_key=secrets.token_hex(16),_identity=ADMIN,_internal=True)
 def test_no_show_cancels_reminder(self):
  b=self.hold();self.pay(b);self.run_op('admin-status',reference=b['reference'],status='no_show',_identity=ADMIN)
  reminder=next(m for m in self.snapshot()['messages'] if ':reminder:' in m['dedupe']);self.assertEqual(reminder['status'],'cancelled')

if __name__=='__main__':unittest.main()
