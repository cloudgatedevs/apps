import json,sqlite3,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cloudgate'))
from engine import Engine,plan,snapshot_sql
ADMIN=dict(Id='1',Role='Admin',IsActive=True,Name='Organiser',Email='admin@example.invalid')
USER=dict(Id='2',Role='User',IsActive=True,Name='Guest',Email='guest@example.invalid')
OTHER=dict(Id='4',Role='User',IsActive=True,Name='Other',Email='other@example.invalid')
NOW=1800000000
class EventsTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.executescript((Path(__file__).resolve().parents[1]/'cloudgate/schema.sql').read_text())
  self.event=self.runop('event-save',ADMIN,title='Test event',summary='Summary',description='Description',venue='Venue',organiser='Host',starts=NOW+3600,ends=NOW+10800,capacity=3,currency='USD')
  self.tier=self.runop('tier-save',ADMIN,event=self.event['ref'],name='Standard',price=1000,capacity=3)
  self.event=self.runop('event-publish',ADMIN,ref=self.event['ref'],version=self.event['version'])
 def tearDown(self):self.db.close()
 def snap(self):return json.loads(self.db.execute(snapshot_sql()).fetchone()[0])
 def runop(self,op,who=None,now=NOW,internal=False,**values):
  sql,result=plan(self.snap(),dict(op=op,**values),who,now,internal)
  try:self.db.executescript(sql)
  except Exception:self.db.rollback();raise
  return result
 def all(self,kind):return [r for r in self.snap()['entities'] if r['kind']==kind]
 def book(self,who=USER,quantity=1,key='reservation-key-0001',tier=None,now=NOW):return self.runop('reserve',who,now=now,tier=(tier or self.tier)['ref'],quantity=quantity,attendees=['Guest']*quantity,request_key=key)
 def pay(self,o):
  self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='pay-'+o['ref'],payment_url='https://checkout.example.invalid/pay')
  return self.runop('_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='pay-'+o['ref'],GrossAmount=o['amount'],Currency='USD',Status=1))
 def test_prices_server_owned(self):
  o=self.book(quantity=2);self.assertEqual(o['amount'],2000);self.assertEqual(self.all('ticket'),[])
 def test_no_oversell(self):
  self.book(quantity=2)
  with self.assertRaisesRegex(ValueError,'Not enough'):self.book(OTHER,2,'reservation-key-0002')
 def test_event_capacity_across_tiers(self):
  t=self.runop('tier-save',ADMIN,event=self.event['ref'],name='VIP',price=3000,capacity=3);self.book(quantity=3)
  with self.assertRaisesRegex(ValueError,'Not enough'):self.book(OTHER,1,'reservation-key-0002',t)
 def test_expired_hold_releases_capacity(self):
  self.book(quantity=3);self.book(OTHER,3,'reservation-key-0002',now=NOW+901)
 def test_open_checkout_holds_capacity(self):
  o=self.book(quantity=3);self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='p1',payment_url='https://example.invalid/pay')
  with self.assertRaisesRegex(ValueError,'Not enough'):self.book(OTHER,1,'reservation-key-0002',now=NOW+901)
 def test_reservation_idempotent(self):
  a=self.book();b=self.book();self.assertEqual(a['ref'],b['ref']);self.assertEqual(len(self.all('order')),1)
 def test_reuse_key_different_selection_rejected(self):
  self.book()
  with self.assertRaisesRegex(ValueError,'another selection'):self.book(quantity=2)
 def test_free_ticket_issued(self):
  t=self.runop('tier-save',ADMIN,event=self.event['ref'],name='Free',price=0,capacity=3);o=self.book(tier=t);self.assertEqual(o['status'],'confirmed');self.assertEqual(len(self.all('ticket')),1)
 def test_payment_exact_match(self):
  o=self.book();self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='p1',payment_url='https://example.invalid/pay')
  with self.assertRaisesRegex(ValueError,'do not match'):self.runop('_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='p1',GrossAmount=1,Currency='USD',Status=1))
  self.assertEqual(self.all('ticket'),[])
 def test_payment_idempotent_ticket_issuance(self):
  o=self.book(quantity=2);self.pay(o);self.pay(o);self.assertEqual(len(self.all('ticket')),2);self.assertEqual(len(self.all('message')),1)
 def test_customer_isolation(self):
  o=self.book();self.pay(o)
  with self.assertRaisesRegex(ValueError,'Record not found'):self.runop('payment-prepare',OTHER,ref=o['ref'])
  self.assertEqual(self.runop('workspace',OTHER)['records'],[])
 def test_anonymous_and_inactive_denied(self):
  for identity in [None,dict(USER,IsActive=False),dict(USER,IsActive='true')]:
   with self.assertRaises(ValueError):self.book(identity)
 def test_admin_guard(self):
  with self.assertRaisesRegex(ValueError,'Administrator'):self.runop('event-cancel',USER,ref=self.event['ref'],version=self.event['version'])
 def test_internal_guard(self):
  with self.assertRaisesRegex(ValueError,'Internal'):self.runop('_mail-claim',ADMIN)
 def test_duplicate_checkin(self):
  self.pay(self.book());t=self.all('ticket')[0];a=self.runop('check-in',ADMIN,event=self.event['ref'],code=t['code']);b=self.runop('check-in',ADMIN,event=self.event['ref'],code=t['code']);self.assertTrue(a['ok']);self.assertTrue(b['duplicate']);self.assertEqual(len([a for a in self.all('audit') if a['action']=='checked-in']),1)
 def test_staff_assignment_enforced(self):
  self.pay(self.book());t=self.all('ticket')[0]
  with self.assertRaisesRegex(ValueError,'not assigned'):self.runop('check-in',OTHER,event=self.event['ref'],code=t['code'])
  self.runop('staff-save',ADMIN,user_id='4',name='Door staff',events=[self.event['ref']]);self.assertTrue(self.runop('check-in',OTHER,event=self.event['ref'],code=t['code'])['ok'])
 def test_staff_no_ticket_codes_in_list(self):
  self.pay(self.book());self.runop('staff-save',ADMIN,user_id='4',name='Door staff',events=[self.event['ref']]);tickets=[r for r in self.runop('workspace',OTHER)['records'] if r['kind']=='ticket'];self.assertNotIn('code',tickets[0]);self.assertNotIn('email',tickets[0])
 def test_cancelled_event_voids_tickets(self):
  self.pay(self.book());self.runop('event-cancel',ADMIN,ref=self.event['ref'],version=self.event['version']);self.assertEqual(self.all('ticket')[0]['status'],'void');self.assertEqual(self.runop('catalog')['events'],[])
 def test_refund_blocks_and_revokes(self):
  o=self.book();self.pay(o);v=self.runop('refund-prepare',ADMIN,ref=o['ref'],request_key='refund-key-0000001');self.runop('_refund-claim',internal=True,prepared=v)
  with self.assertRaisesRegex(ValueError,'void or refunded'):self.runop('check-in',ADMIN,event=self.event['ref'],code=self.all('ticket')[0]['code'])
  self.runop('_refund-apply',internal=True,request_key=v['request_key'],provider=dict(PaymentId=v['payment_id'],Amount=v['amount'],Currency='USD',IdempotencyKey='events-refund-'+v['request_key'],RefundId='refund1',Status='succeeded'));self.assertEqual(self.all('ticket')[0]['status'],'refunded');self.assertEqual(self.all('order')[0]['status'],'refunded')
 def test_admitted_ticket_refund_rejected(self):
  o=self.book();self.pay(o);self.runop('check-in',ADMIN,event=self.event['ref'],code=self.all('ticket')[0]['code'])
  with self.assertRaisesRegex(ValueError,'Reverse check-in'):self.runop('refund-prepare',ADMIN,ref=o['ref'],request_key='refund-key-0000001')
 def test_revision_guard_prevents_concurrent_oversell(self):
  snapshot=self.snap();req=dict(op='reserve',tier=self.tier['ref'],quantity=3,attendees=['A','B','C'],request_key='reservation-key-0001');sql1,_=plan(snapshot,req,USER,NOW);sql2,_=plan(snapshot,dict(req,request_key='reservation-key-0002'),OTHER,NOW);self.db.executescript(sql1)
  with self.assertRaises(sqlite3.IntegrityError):self.db.executescript(sql2)
  self.db.rollback();self.assertEqual(len(self.all('order')),1)
 def test_sql_and_interpolation_literals(self):
  self.runop('settings',ADMIN,values={'name':"O'Reilly ${body} ; DROP TABLE entities;"});self.assertEqual(self.runop('catalog')['settings']['name'],"O'Reilly ${body} ; DROP TABLE entities;")
 def test_waitlist_dedup(self):
  a=self.runop('waitlist-join',USER,event=self.event['ref']);b=self.runop('waitlist-join',USER,event=self.event['ref']);self.assertEqual(a['ref'],b['ref'])
 def test_mail_claim_is_leased(self):
  self.pay(self.book());a=self.runop('_mail-claim',internal=True);b=self.runop('_mail-claim',internal=True);self.assertEqual(len(a['messages']),1);self.assertEqual(len(b['messages']),0)
 def test_late_paid_cancelled_event_requires_review(self):
  o=self.book();self.runop('event-cancel',ADMIN,ref=self.event['ref'],version=self.event['version']);r=self.pay(o);self.assertEqual(r['status'],'review');self.assertEqual(self.all('ticket'),[])
 def test_capacity_cannot_drop_below_bookings(self):
  self.book(quantity=3)
  with self.assertRaisesRegex(ValueError,'below current'):self.runop('event-save',ADMIN,**{k:v for k,v in dict(self.event,capacity=2).items() if k!='kind'})
 def test_expired_wallet_payment_releases_capacity(self):
  o=self.book(quantity=3);self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='p1',payment_url='https://example.invalid/pay');r=self.runop('_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='p1',GrossAmount=3000,Currency='USD',Status=3));self.assertEqual(r['status'],'expired');self.book(OTHER,3,'reservation-key-0002')
 def test_cancelled_event_cannot_be_unlisted_and_reopened(self):
  e=self.runop('event-cancel',ADMIN,ref=self.event['ref'],version=self.event['version'])
  with self.assertRaisesRegex(ValueError,'cannot be reopened'):self.runop('event-archive',ADMIN,ref=e['ref'],version=e['version'])
 def test_changed_event_updates_tickets(self):
  self.pay(self.book());values=dict(self.event,venue='New venue');values.pop('kind');self.runop('event-save',ADMIN,**values);self.assertEqual(self.all('ticket')[0]['venue'],'New venue');self.assertEqual(len(self.all('message')),2)
 def test_manual_reference_admission(self):
  self.pay(self.book());self.assertTrue(self.runop('check-in',ADMIN,event=self.event['ref'],code=self.all('ticket')[0]['ref'])['ok'])
if __name__=='__main__':unittest.main()
