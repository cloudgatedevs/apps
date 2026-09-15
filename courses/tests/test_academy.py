import unittest,sqlite3,json,sys,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cloudgate'))
from engine import Engine,plan,snapshot_sql,asset
from seed import seed_sql
ADMIN={'Id':'1','Role':'Admin','IsActive':True,'Name':'Admin','Email':'admin@example.test'}
LEARNER={'Id':'2','Role':'User','IsActive':True,'Name':'Learner','Email':'learner@example.test'}
OTHER=dict(LEARNER,Id='9')
class AcademyTests(unittest.TestCase):
 def test_local_media_urls_match_cloudgate_development(self):
  self.assertEqual('http://learner.localhost:44301/File/GetPublicFileById?id=1',asset('http://learner.localhost:44301/File/GetPublicFileById?id=1'))
  for url in ['http://external.example/image.png','https://user:pass@example.com/image.png','//example.com/image.png','javascript:alert(1)','https://example.com/with space']:
   with self.assertRaises(ValueError):asset(url)
 def test_published_media_references_are_retained(self):
  data=self.runop('workspace',who=ADMIN);self.assertEqual(3,len(data['mediaReferences']))
  self.assertTrue(all(r['url'] for r in data['mediaReferences']))
  self.assertEqual([],self.runop('workspace')['mediaReferences'])
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row;self.db.executescript((Path(__file__).resolve().parents[1]/'cloudgate/schema.sql').read_text());self.db.executescript(seed_sql());self.now=1800000000
 def tearDown(self):self.db.close()
 def snapshot(self):return json.loads(self.db.execute(snapshot_sql()).fetchone()['snapshot'])
 def runop(self,op,who=LEARNER,internal=False,**data):
  sql,result=plan(self.snapshot(),dict(op=op,**data),who,now=self.now,internal=internal)
  try:self.db.executescript(sql)
  except Exception:self.db.rollback();raise
  return result
 def course(self,paid=False):return next(c for c in self.runop('catalog')['courses'] if bool(c['price'])==paid)
 def enroll(self,paid=False):return self.runop('enroll',course=self.course(paid)['ref'])
 def pay(self,e):
  o=next(r for r in self.snapshot()['entities'] if r['kind']=='order' and r['enrollment']==e['ref']);self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='wallet-1',payment_url='https://checkout.example.test/pay');self.runop('_payment-apply',internal=True,ref=o['ref'],provider={'Id':'wallet-1','GrossAmount':o['amount'],'Currency':o['currency'],'Status':1});return o
 def test_catalog_has_no_quiz_answers_or_private_data(self):
  result=self.runop('catalog',who={});self.assertEqual(3,len(result['courses']));self.assertNotIn('\"questions\":',json.dumps(result));self.assertNotIn('email',json.dumps(result['courses']))
 def test_unsigned_enrollment_denied(self):
  with self.assertRaises(ValueError):self.runop('enroll',who={},course=self.course()['ref'])
 def test_free_enrollment_is_idempotent(self):
  a=self.enroll();b=self.enroll();self.assertEqual(a['ref'],b['ref']);self.assertEqual('active',a['status'])
 def test_paid_access_denied_until_verified(self):
  e=self.enroll(True)
  with self.assertRaises(ValueError):self.runop('learn',ref=e['ref'])
  self.pay(e);self.assertTrue(self.runop('learn',ref=e['ref'])['lessons'])
 def test_payment_amount_mismatch_denied(self):
  e=self.enroll(True);o=next(r for r in self.snapshot()['entities'] if r['kind']=='order');self.runop('_checkout-save',internal=True,ref=o['ref'],payment_id='1',payment_url='https://checkout.test/p')
  with self.assertRaises(ValueError):self.runop('_payment-apply',internal=True,ref=o['ref'],provider={'Id':'1','GrossAmount':1,'Currency':o['currency'],'Status':1})
 def test_cross_learner_access_denied(self):
  e=self.enroll()
  with self.assertRaises(ValueError):self.runop('learn',who=OTHER,ref=e['ref'])
 def test_internal_ops_denied(self):
  with self.assertRaises(ValueError):self.runop('_mail-claim')
 def test_quiz_cannot_be_marked_complete(self):
  e=self.enroll();quiz=next(l for l in self.runop('learn',ref=e['ref'])['lessons'] if l['type']=='quiz')
  self.assertNotIn('answer',quiz['questions'][0])
  with self.assertRaises(ValueError):self.runop('lesson-complete',ref=e['ref'],lesson=quiz['ref'])
 def test_attempt_limit_enforced(self):
  e=self.enroll();quiz=next(l for l in self.runop('learn',ref=e['ref'])['lessons'] if l['type']=='quiz')
  for _ in range(3):self.runop('quiz-submit',ref=e['ref'],lesson=quiz['ref'],answers=[1,0,0,1])
  with self.assertRaises(ValueError):self.runop('quiz-submit',ref=e['ref'],lesson=quiz['ref'],answers=[0,1,2,0])
 def test_completion_issues_one_certificate(self):
  e=self.enroll();lessons=self.runop('learn',ref=e['ref'])['lessons']
  for l in lessons:
   self.runop('quiz-submit' if l['type']=='quiz' else 'lesson-complete',ref=e['ref'],lesson=l['ref'],answers=[0,1,2,0])
  self.runop('lesson-complete',ref=e['ref'],lesson=lessons[0]['ref']);cert=self.runop('learn',ref=e['ref'])['certificate'];self.assertEqual('valid',self.runop('certificate-verify',who={},code=cert['code'])['status']);self.assertEqual(1,len([r for r in self.snapshot()['entities'] if r['kind']=='certificate']))
 def test_published_curriculum_immutable_for_existing_enrollment(self):
  e=self.enroll();c=next(r for r in self.snapshot()['entities'] if r['ref']==e['course']);l=next(r for r in self.snapshot()['entities'] if r['kind']=='lesson' and r['course']==c['ref']);self.runop('lesson-save',who=ADMIN,**dict(l,title='Changed lesson'));self.runop('course-publish',who=ADMIN,ref=c['ref'],version=c['version']);self.assertNotIn('Changed lesson',[l['title'] for l in self.runop('learn',ref=e['ref'])['lessons']])
 def test_stale_writes_rollback(self):
  snapshot=self.snapshot();c=next(r for r in snapshot['entities'] if r['kind']=='course');sql,_=plan(snapshot,dict(op='course-archive',ref=c['ref'],version=c['version']),ADMIN);self.runop('course-save',who=ADMIN,**dict(c,title='New title'))
  with self.assertRaises(sqlite3.IntegrityError):self.db.executescript(sql)
  self.db.rollback();self.assertEqual('New title',next(r for r in self.snapshot()['entities'] if r['ref']==c['ref'])['title'])
 def test_full_refund_revokes_access(self):
  e=self.enroll(True);o=self.pay(e);v=self.runop('refund-prepare',who=ADMIN,ref=o['ref'],request_key='abcdefghijklmnop');self.runop('_refund-claim',internal=True,prepared=v);self.runop('_refund-apply',internal=True,request_key=v['request_key'],provider={'PaymentId':v['payment_id'],'Amount':v['amount'],'Currency':v['currency'],'IdempotencyKey':'courses-refund-'+v['request_key'],'RefundId':'refund-1','Status':'succeeded'})
  with self.assertRaises(ValueError):self.runop('learn',ref=e['ref'])
 def test_instructor_scope(self):
  teacher={'Id':'33','Role':'User','IsActive':True};c=self.course()
  with self.assertRaises(ValueError):self.runop('lesson-save',who=teacher,course=c['ref'],title='Not allowed')
 def test_outbox_lease_and_result(self):
  self.enroll();a=self.runop('_mail-claim',internal=True);b=self.runop('_mail-claim',internal=True);self.assertTrue(a['messages']);self.assertFalse(b['messages']);self.runop('_mail-result',internal=True,token=a['token'],results=[{'ref':m['ref'],'sent':True} for m in a['messages']]);self.assertFalse(self.runop('_mail-claim',internal=True)['messages'])
 def test_sql_text_cannot_interpolate_keys(self):
  sql,_=plan(self.snapshot(),dict(op='settings',values={'description':"${body} '; DROP TABLE entities; --"}),ADMIN);self.assertNotIn('${body}',sql);self.db.executescript(sql);self.assertTrue(self.db.execute('SELECT COUNT(*) FROM entities').fetchone()[0])
if __name__=='__main__':unittest.main()
