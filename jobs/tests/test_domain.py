import copy,json,sqlite3,sys,unittest,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cloudgate'))
from engine import Engine,plan,snapshot_sql,pricing
from seed import seed_sql
ADMIN=dict(Id='1',Role='Admin',IsActive=True,Name='Admin')
CUSTOMER=dict(Id='2',Role='Customer',IsActive=True,Name='Jordan',Email='jordan@example.invalid')
TECH=dict(Id='3',Role='Customer',IsActive=True,Name='Maya')
OTHER=dict(Id='9',Role='Customer',IsActive=True)
NOW=1789034400
class DomainTests(unittest.TestCase):
 def setUp(self):
  self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.executescript((Path(__file__).resolve().parents[1]/'cloudgate/schema.sql').read_text());self.c.executescript(seed_sql(local=True))
 def tearDown(self):self.c.close()
 def snapshot(self):return json.loads(self.c.execute(snapshot_sql()).fetchone()['snapshot'])
 def runop(self,op,identity=ADMIN,internal=False,**d):
  sql,result=plan(self.snapshot(),dict(op=op,**d),identity,NOW,internal)
  try:self.c.executescript(sql)
  except Exception:self.c.rollback();raise
  return result
 def rows(self,kind):return [r for r in self.snapshot()['entities'] if r['kind']==kind]
 def record(self,ref):return next(r for r in self.snapshot()['entities'] if r['ref']==ref)
 def quote(self,deposit=30,**kw):
  return self.runop('quote-save',request='REQ-KITCHEN',lines=[dict(name='Labour',quantity='1.5',rate=10000),dict(name='Extra',quantity=1,rate=5000,optional=True)],deposit_percent=deposit,tax_bps=1500,expires=NOW+86400,**kw)
 def job(self,deposit=0):
  q=self.quote(deposit);q=self.runop('quote-send',ref=q['ref'],version=q['version']);return self.runop('quote-accept',CUSTOMER,ref=q['ref'],version=q['version'],selected=[])
 def paid(self,o):
  self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='wallet-'+o['ref'],payment_url='https://checkout.example.invalid/pay')
  return self.runop('_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='wallet-'+o['ref'],GrossAmount=o['amount'],Currency=o['currency'],Status=1))
 def test_complete_journey_and_deposit_applied_once(self):
  j=self.job(30);self.assertEqual(j['status'],'awaiting_deposit');o=self.rows('obligation')[0];self.paid(o);self.paid(o);j=self.record(j['ref']);self.assertEqual(j['status'],'ready');self.assertEqual(len(self.rows('payment')),1)
  v=self.runop('visit-save',job=j['ref'],starts=NOW+3600,ends=NOW+7200,staff=['TEAM-MAYA','TEAM-LEO']);v=self.runop('visit-status',TECH,ref=v['ref'],version=v['version'],status='in_progress');self.runop('visit-status',TECH,ref=v['ref'],version=v['version'],status='completed');j=self.record(j['ref']);self.runop('job-status',ref=j['ref'],version=j['version'],status='completed');i=self.runop('invoice-issue',job=j['ref']);self.assertEqual(i['balance'],j['total']-o['amount']);self.assertEqual(len(i['pricing']['lines']),1);balance=next(x for x in self.rows('obligation') if x['purpose']=='balance');self.paid(balance);self.assertEqual(self.runop('document',CUSTOMER,ref=i['ref'])['document']['balance'],0)
 def test_draft_quote_private(self):
  q=self.quote();self.assertNotIn(q['ref'],[r['ref'] for r in self.runop('workspace',CUSTOMER)['records']]);self.assertRaises(ValueError,self.runop,'document',CUSTOMER,ref=q['ref'])
 def test_quote_version_and_repeat_accept(self):
  q=self.quote();q=self.runop('quote-send',ref=q['ref'],version=q['version']);j=self.runop('quote-accept',CUSTOMER,ref=q['ref'],version=q['version']);again=self.runop('quote-accept',CUSTOMER,ref=q['ref'],version=q['version']);self.assertEqual(j['ref'],again['ref']);self.assertEqual(len(self.rows('job')),1)
 def test_quote_revision_invalidates_previous(self):
  q=self.quote();sent=self.runop('quote-send',ref=q['ref'],version=q['version']);new=self.runop('quote-save',ref=sent['ref'],version=sent['version'],request='REQ-KITCHEN',lines=[dict(name='Revision',quantity=1,rate=100)],expires=NOW+86400);self.assertNotEqual(q['ref'],new['ref']);self.assertRaises(ValueError,self.runop,'quote-accept',CUSTOMER,ref=q['ref'],version=sent['version'])
 def test_cross_customer_access(self):
  j=self.job();self.assertRaises(ValueError,self.runop,'attachment-add',OTHER,entity=j['ref'],content='');self.assertEqual(self.runop('workspace',OTHER)['records'],[])
 def test_staff_permissions_are_membership_based(self):
  self.assertRaises(ValueError,self.runop,'settings',TECH,values={'name':'Changed'});forged=dict(Id='9',IsActive=True,Role='manager');self.assertEqual(self.runop('workspace',forged)['role'],'customer');self.assertRaises(ValueError,self.runop,'quote-save',forged,request='REQ-KITCHEN',lines=[dict(name='x',rate=1)])
 def test_unassigned_technician_cannot_update(self):
  j=self.job();self.assertRaises(ValueError,self.runop,'note-add',TECH,job=j['ref'],body='Hidden')
 def test_overlap_rolls_back_all_workers(self):
  j=self.job();self.runop('visit-save',job=j['ref'],starts=NOW+3600,ends=NOW+7200,staff=['TEAM-MAYA']);self.assertRaises(sqlite3.IntegrityError,self.runop,'visit-save',job=j['ref'],starts=NOW+4000,ends=NOW+5000,staff=['TEAM-LEO','TEAM-MAYA']);self.assertEqual(self.c.execute('SELECT COUNT(*) FROM allocations').fetchone()[0],1)
 def test_block_prevents_visit(self):
  j=self.job();self.runop('block-save',staff='TEAM-MAYA',starts=NOW,ends=NOW+7200,title='Leave');self.assertRaises(sqlite3.IntegrityError,self.runop,'visit-save',job=j['ref'],starts=NOW+3600,ends=NOW+5000,staff=['TEAM-MAYA'])
 def test_stale_plan_rejected(self):
  s=self.snapshot();sql,_=plan(s,dict(op='customer-save',name='A',email='a@example.invalid'),ADMIN,NOW);self.runop('customer-save',name='B',email='b@example.invalid');self.assertRaises(sqlite3.IntegrityError,self.c.executescript,sql);self.c.rollback()
 def test_sql_text_roundtrip(self):
  body="O'Brien ${body} \" ; DROP TABLE entities; --";r=self.runop('request-create',CUSTOMER,title=body,address='Address',description=body,request_key=str(uuid.uuid4()));self.assertEqual(self.record(r['ref'])['description'],body)
 def test_no_internal_operations_via_customer(self):
  self.assertRaises(ValueError,self.runop,'_maintenance',CUSTOMER)
 def test_wallet_status_one_only(self):
  j=self.job(30);o=self.rows('obligation')[0];self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='x',payment_url='https://example.invalid');self.runop('_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='x',GrossAmount=o['amount'],Currency=o['currency'],Status=2));self.assertEqual(self.rows('payment'),[])
 def test_wallet_mismatch_rejected(self):
  j=self.job(30);o=self.rows('obligation')[0];self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='x',payment_url='https://example.invalid');self.assertRaises(ValueError,self.runop,'_payment-apply',internal=True,ref=o['ref'],provider=dict(Id='x',GrossAmount=1,Currency=o['currency'],Status=1))
 def test_late_cancelled_payment_review(self):
  j=self.job(30);o=self.rows('obligation')[0];self.runop('job-status',ref=j['ref'],version=j['version'],status='cancelled');p=self.paid(o);self.assertEqual(p['status'],'review');self.assertEqual(Engine(self.snapshot()).balance(j['ref']),0)
 def test_refund_reserves_and_verifies(self):
  j=self.job(30);p=self.paid(self.rows('obligation')[0]);key=str(uuid.uuid4());v=self.runop('refund-prepare',ref=p['ref'],request_key=key,amount=p['amount']);self.runop('_refund-claim',internal=True,prepared=v);self.assertRaises(ValueError,self.runop,'refund-prepare',ref=p['ref'],request_key=str(uuid.uuid4()),amount=1)
  provider=dict(PaymentId=v['payment_id'],Amount=v['amount'],Currency=v['currency'],IdempotencyKey='jobs-refund-'+key,RefundId='r-1',Status='succeeded');self.runop('_refund-apply',internal=True,request_key=key,provider=provider);self.runop('_refund-apply',internal=True,request_key=key,provider=provider);self.assertEqual(Engine(self.snapshot()).balance(j['ref']),0)
 def test_private_notes_not_in_portal(self):
  j=self.job();self.runop('note-add',job=j['ref'],body='Internal',visibility='internal');self.runop('note-add',job=j['ref'],body='Shared',visibility='customer');notes=[r for r in self.runop('workspace',CUSTOMER)['records'] if r['kind']=='note'];self.assertEqual([n['body'] for n in notes],['Shared'])
 def test_required_checklist_blocks_completion(self):
  j=self.job();v=self.runop('visit-save',job=j['ref'],starts=NOW,ends=NOW+3600,staff=['TEAM-MAYA']);v=self.runop('visit-status',TECH,ref=v['ref'],version=v['version'],status='in_progress');self.runop('checklist-add',job=j['ref'],title='Safety check',required=True);self.assertRaises(ValueError,self.runop,'visit-status',TECH,ref=v['ref'],version=v['version'],status='completed')
 def test_price_rounding_and_extras(self):
  p=pricing([dict(name='A',quantity='1.005',rate=100),dict(name='B',quantity='1',rate=500,optional=True)],0,1500,'exclusive',[]);self.assertEqual(p['subtotal'],101);self.assertEqual(p['total'],116)
 def test_schema_idempotent(self):
  self.c.executescript((Path(__file__).resolve().parents[1]/'cloudgate/schema.sql').read_text());self.assertEqual(len(self.rows('service')),4)
 def test_customer_approval_extras_exact_total(self):
  q=self.quote();q=self.runop('quote-send',ref=q['ref'],version=q['version']);p=self.runop('quote-preview',CUSTOMER,ref=q['ref'],version=q['version'],selected=[1]);j=self.runop('quote-accept',CUSTOMER,ref=q['ref'],version=q['version'],selected=[1]);self.assertEqual(p['total'],j['total']);self.assertEqual(p['deposit'],j['deposit'])
 def test_only_one_job_per_request(self):
  q=self.quote();q=self.runop('quote-send',ref=q['ref'],version=q['version']);q2=self.quote();q2=self.runop('quote-send',ref=q2['ref'],version=q2['version']);self.runop('quote-accept',CUSTOMER,ref=q['ref'],version=q['version']);self.assertRaises(ValueError,self.runop,'quote-accept',CUSTOMER,ref=q2['ref'],version=q2['version'])
 def test_monthly_anchor_and_recurrence_dedup(self):
  j=self.job();rule=self.runop('recurring-save',job=j['ref'],frequency='monthly',next_date='2026-01-31',active=True);self.runop('_maintenance',internal=True);self.assertEqual(self.record(rule['ref'])['next_date'],'2026-02-28');self.runop('_maintenance',internal=True);self.assertEqual(self.record(rule['ref'])['next_date'],'2026-03-31');occ=[r['occurrence'] for r in self.rows('job') if r.get('occurrence')];self.assertEqual(len(set(occ)),len(occ))
 def test_mail_claim_is_exclusive_and_result_token_bound(self):
  q=self.quote();self.runop('quote-send',ref=q['ref'],version=q['version']);self.runop('settings',values={'smtp_host':'smtp.example.invalid','smtp_from':'service@example.invalid'});a=self.runop('_mail-claim',internal=True);b=self.runop('_mail-claim',internal=True);self.assertEqual(len(a['messages']),1);self.assertEqual(b['messages'],[]);self.runop('_mail-result',internal=True,claim='wrong',results=[dict(ref=a['messages'][0]['ref'],sent=True)]);self.assertEqual(self.rows('message')[0]['status'],'sending')
 def test_sandbox_has_no_real_account_bindings(self):
  c=sqlite3.connect(':memory:');c.executescript((Path(__file__).resolve().parents[1]/'cloudgate/schema.sql').read_text());c.executescript(seed_sql());rows=[json.loads(r[0]) for r in c.execute('SELECT data FROM entities')];self.assertFalse(any(r.get('user_id') for r in rows));self.assertFalse(any(r['owner'].isdigit() for r in rows));c.close()
 def test_credit_preserves_invoice_and_is_idempotent(self):
  j=self.job();v=self.runop('visit-save',job=j['ref'],starts=NOW,ends=NOW+3600,staff=['TEAM-MAYA']);v=self.runop('visit-status',ref=v['ref'],version=v['version'],status='in_progress');self.runop('visit-status',ref=v['ref'],version=v['version'],status='completed');j=self.record(j['ref']);self.runop('job-status',ref=j['ref'],version=j['version'],status='completed');i=self.runop('invoice-issue',job=j['ref']);key=str(uuid.uuid4());credit=self.runop('invoice-credit',ref=i['ref'],amount=1000,reason='Adjustment',request_key=key);again=self.runop('invoice-credit',ref=i['ref'],amount=1000,reason='Adjustment',request_key=key);self.assertEqual(credit['ref'],again['ref']);current=self.runop('document',CUSTOMER,ref=i['ref'])['document'];self.assertEqual(current['total'],i['total']);self.assertEqual(current['balance'],i['total']-1000)
if __name__=='__main__':unittest.main()
