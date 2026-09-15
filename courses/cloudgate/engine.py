"""Academy domain shared by native Cloudgate workflows and the loopback simulator.
All writes use an optimistic global revision inside an atomic SQLite transaction.
"""
import copy,json,re,time,uuid,hashlib
from urllib.parse import urlsplit

def encoded(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def q(v):return "CAST(X'"+str(v).encode('utf8').hex()+"' AS TEXT)"
def require(v,message):
    if not v:raise ValueError(message)
def text(v,limit=500):
    s=str(v or '').strip();require(len(s)<=limit,'Text is too long.');return s
def integer(v,lo=0,hi=100000000):
    require(not isinstance(v,bool),'Enter a whole number.')
    try:n=int(v)
    except (ValueError,TypeError,OverflowError):raise ValueError('Enter a whole number.')
    require(str(n)==str(v) or n==v,'Enter a whole number.');require(lo<=n<=hi,'Number is outside its allowed range.');return n
def asset(v):
    s=text(v,2048);u=urlsplit(s);local=u.hostname in ('localhost','127.0.0.1','::1') or (u.hostname or '').endswith('.localhost')
    require(not re.search(r'[\s\\<>]',s) and (not s or (s.startswith('/') and not s.startswith('//')) or (u.hostname and not u.username and not u.password and (u.scheme=='https' or (u.scheme=='http' and local)))),'Use an HTTPS URL or a local asset path.');return s
def snapshot_sql():return "SELECT json_object('settings',json(COALESCE((SELECT json_group_array(json_object('key',key,'value',value)) FROM settings),'[]')),'entities',json(COALESCE((SELECT json_group_array(json(data)) FROM (SELECT data FROM entities ORDER BY Id LIMIT 20001)),'[]'))) AS snapshot;"

class Engine:
    def __init__(self,snapshot,identity=None,now=None,internal=False):
        self.rows=copy.deepcopy(snapshot.get('entities',[]));require(len(self.rows)<=20000,'Academy capacity reached. Export and archive history before continuing.')
        self.settings={r['key']:r['value'] for r in snapshot.get('settings',[])};self.user=identity or {};self.now=int(time.time()) if now is None else now;self.internal=internal;self.changed={};self.sql=[]
        self.uid=str(self.user.get('Id') or '') if self.user.get('IsActive') is True else '';self.role=str(self.user.get('Role','')).lower() if self.uid else ''
        if self.role not in ('admin','administrator','owner'):self.role='instructor' if self.uid and any(x.get('user_id')==self.uid and x.get('active') for x in self.all('instructor')) else 'learner' if self.uid else ''
    def all(self,kind):return [r for r in self.rows if r['kind']==kind]
    def get(self,ref,kind=None):
        r=next((x for x in self.rows if x['ref']==ref and (not kind or x['kind']==kind)),None);require(r,'Record not found.');return r
    def signed(self):require(self.uid,'Please sign in.')
    def isadmin(self):return self.role in ('admin','administrator','owner')
    def admin(self):require(self.isadmin(),'Administrator access required.')
    def teach(self,course):require(self.isadmin() or (self.role=='instructor' and self.uid in course.get('instructors',[])),'This course is not assigned to you.')
    def expected(self,r,d):require(d.get('version')==r['version'],'This record changed. Refresh before saving.')
    def save(self,kind,values,old=None,ref=None):
        r=dict(old or {},**values);r.update(kind=kind,ref=old['ref'] if old else ref or kind[:3].upper()+'-'+uuid.uuid4().hex[:16],version=(old or {}).get('version',0)+1,updated=self.now);r.setdefault('created',self.now);r.setdefault('owner','')
        if old:self.rows[self.rows.index(old)]=r
        else:self.rows.append(r)
        self.changed[r['ref']]=r;return r
    def audit(self,entity,action):self.save('audit',dict(entity=entity['ref'],action=action,actor=self.uid or 'worker'))
    def public_settings(self):return {k:v for k,v in self.settings.items() if not k.startswith(('_','smtp_'))}
    def mail(self,enrollment,subject,body,key):
        if enrollment.get('email') and not any(x.get('dedupe')==key for x in self.all('message')):self.save('message',dict(recipient=enrollment['email'],subject=subject,body=body,dedupe=key,status='queued',attempts=0,due=self.now))
    def enrollment(self,ref):
        e=self.get(ref,'enrollment');require(e['owner']==self.uid or self.isadmin(),'Record not found.');return e
    def release(self,e):return self.get(e['release'],'release')
    def available(self,e):require(e['status'] in ('active','completed'),'Enrolment is not active.')
    def complete(self,e):
        release=self.release(e);required=[l for l in release['lessons'] if l.get('required',True)]
        done={p['lesson'] for p in self.all('progress') if p['enrollment']==e['ref']};require(required and all(l['ref'] in done for l in required),'Complete all required lessons and assessments first.')
        if e['status']!='completed':e=self.save('enrollment',dict(status='completed',completed=self.now),e)
        cert=next((c for c in self.all('certificate') if c['enrollment']==e['ref']),None)
        if not cert:
            cert=self.save('certificate',dict(enrollment=e['ref'],owner=e['owner'],name=e['name'],title=release['title'],issuer=self.settings['name'],issued=self.now,status='valid',code=uuid.uuid4().hex))
            self.mail(e,'Your certificate is ready','Congratulations on completing '+release['title']+'. Open your learner portal to download your certificate.','certificate-'+cert['ref'])
        return cert
    def public_course(self,c):
        r=self.get(c['release'],'release');lessons=[{k:l[k] for k in ('ref','title','module','type','minutes','required','preview') if k in l} for l in r['lessons']]
        return dict(ref=c['ref'],title=r['title'],summary=r['summary'],description=r['description'],category=r['category'],level=r['level'],image_url=r['image_url'],price=r['price'],currency=r['currency'],instructor=r['instructor'],lessons=lessons,release=r['ref'])
    def dispatch(self,d):
        op=d.get('op','catalog');require(not op.startswith('_') or self.internal,'Internal operation denied.')
        if op=='catalog':return dict(settings=self.public_settings(),courses=[self.public_course(c) for c in self.all('course') if c['status']=='published' and c.get('release')])
        if op=='certificate-verify':
            c=next((x for x in self.all('certificate') if x['code']==d.get('code')),None);require(c,'Certificate not found.');return {k:c[k] for k in ('code','name','title','issuer','issued','status')}
        if op=='preview-lesson':
            c=self.get(d['course'],'course');require(c['status']=='published','Course unavailable.');l=next((x for x in self.get(c['release'],'release')['lessons'] if x['ref']==d['lesson']),None);require(l and l['preview'] and l['type']!='quiz','Preview unavailable.');return l
        if op in ('workspace','admin-data'):
            self.signed();records=[]
            for r in self.rows:
                if self.isadmin():
                    if r['kind']!='release':records.append(r)
                elif self.role=='instructor':
                    courses=[c['ref'] for c in self.all('course') if self.uid in c.get('instructors',[])]
                    if r['kind'] in ('course','lesson','session','discussion','attendance') and (r['ref'] in courses or r.get('course') in courses):records.append(r)
                    if r['kind']=='enrollment' and r['course'] in courses:records.append({k:v for k,v in r.items() if k not in ('email','payment_id','payment_url')})
                elif r.get('owner')==self.uid and r['kind'] in ('enrollment','progress','attempt','certificate','order','refund'):
                    records.append({k:v for k,v in r.items() if k not in ('provider','answers','payment_id')})
            return dict(records=records,settings=self.public_settings(),role=self.role,identity=dict(id=self.uid,name=self.user.get('Name',''),email=self.user.get('Email','')),services=[dict(c,name=c['title'],active=c['status']=='published') for c in self.all('course')] if self.isadmin() else [],staff=self.all('instructor') if self.isadmin() else [],mediaReferences=[dict(url=r.get('image_url',''),label=r['title']+' (published curriculum)') for r in self.all('release')] if self.isadmin() else [])
        if op=='course-save':
            self.admin();old=self.get(d['ref'],'course') if d.get('ref') else None
            if old:self.expected(old,d)
            title=text(d.get('title'),160);require(title,'Course title is required.');currency=text(d.get('currency','USD'),3).upper();require(re.fullmatch('[A-Z]{3}',currency),'Currency must be a three-letter code.')
            values=dict(title=title,summary=text(d.get('summary'),300),description=text(d.get('description'),12000),category=text(d.get('category'),80),level=text(d.get('level','Beginner'),30),image_url=asset(d.get('image_url')),price=integer(d.get('price',0)),currency=currency,instructor=text(d.get('instructor'),100),instructors=[str(x) for x in d.get('instructors',[])][:20])
            if not old:values['status']='draft'
            r=self.save('course',values,old);self.audit(r,'course-saved');return r
        if op=='lesson-save':
            c=self.get(d['course'],'course');self.teach(c);old=self.get(d['ref'],'lesson') if d.get('ref') else None
            if old:require(old['course']==c['ref'],'Course mismatch.');self.expected(old,d)
            title=text(d.get('title'),160);require(title,'Lesson title is required.');kind=d.get('type','article');require(kind in ('article','video','quiz'),'Choose article, video or quiz.')
            questions=d.get('questions',[]);require(isinstance(questions,list) and len(questions)<=30,'Up to 30 questions allowed.')
            if kind=='quiz':
                require(questions,'Add quiz questions.')
                for question in questions:
                    require(text(question.get('prompt'),1000),'Question is required.');choices=question.get('choices',[]);require(isinstance(choices,list) and 2<=len(choices)<=6 and all(text(x,500) for x in choices),'Add 2–6 answer choices.');integer(question.get('answer'),0,len(choices)-1)
            r=self.save('lesson',dict(course=c['ref'],title=title,module=text(d.get('module','Getting started'),100),position=integer(d.get('position',0),0,1000),type=kind,body=text(d.get('body'),50000),video_url=asset(d.get('video_url')),minutes=integer(d.get('minutes',5),1,1000),required=bool(d.get('required',True)),preview=bool(d.get('preview',False)),questions=questions if kind=='quiz' else [],pass_percent=integer(d.get('pass_percent',70),1,100),max_attempts=integer(d.get('max_attempts',3),1,20),drip_days=integer(d.get('drip_days',0),0,365),archived=bool(d.get('archived',False))),old);self.audit(r,'lesson-saved');return r
        if op=='course-publish':
            self.admin();c=self.get(d['ref'],'course');self.expected(c,d);lessons=sorted([l for l in self.all('lesson') if l['course']==c['ref'] and not l['archived']],key=lambda l:(l['position'],l['ref']));require(lessons and any(l['required'] for l in lessons),'Add at least one required lesson.')
            require(c['summary'] and c['description'] and c['instructor'],'Add summary, description and instructor before publishing.')
            for l in lessons:require(l['questions'] if l['type']=='quiz' else l['video_url'] if l['type']=='video' else l['body'],'Every lesson must have content.')
            release=self.save('release',dict(c,lessons=copy.deepcopy(lessons),course=c['ref']));r=self.save('course',dict(status='published',release=release['ref']),c);self.audit(r,'course-published');return r
        if op=='course-archive':
            self.admin();c=self.get(d['ref'],'course');self.expected(c,d);r=self.save('course',dict(status='archived'),c);self.audit(r,'course-archived');return r
        if op=='enroll':
            self.signed();c=self.get(d['course'],'course');require(c['status']=='published','Course is unavailable.');existing=next((e for e in self.all('enrollment') if e['owner']==self.uid and e['course']==c['ref']),None)
            if existing:return existing
            c=dict(c,**{k:self.get(c['release'],'release')[k] for k in ('price','currency')});email=text(self.user.get('Email'),256);require(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email),'Your account needs a valid email address.')
            e=self.save('enrollment',dict(course=c['ref'],release=c['release'],title=self.get(c['release'],'release')['title'],owner=self.uid,name=text(self.user.get('Name') or email,200),email=email,status='pending' if c['price'] else 'active',price=c['price'],currency=c['currency'],started=self.now))
            if c['price']:self.save('order',dict(enrollment=e['ref'],course=c['ref'],owner=self.uid,email=email,amount=c['price'],currency=c['currency'],status='due'))
            else:self.mail(e,'Welcome to '+e['title'],'Your course is ready in your learner portal.','enrolled-'+e['ref'])
            self.audit(e,'enrolled');return e
        if op=='learn':
            self.signed();e=self.enrollment(d['ref']);self.available(e);release=self.release(e);lessons=[]
            for lesson in release['lessons']:
                l=copy.deepcopy(lesson);locked=self.now<e['started']+l.get('drip_days',0)*86400;l['locked']=locked
                if locked:l.pop('body',None);l.pop('video_url',None);l['questions']=[]
                else:l['questions']=[{k:v for k,v in x.items() if k!='answer'} for x in l.get('questions',[])]
                lessons.append(l)
            return dict(enrollment=e,lessons=lessons,progress=[p for p in self.all('progress') if p['enrollment']==e['ref']],attempts=[{k:v for k,v in a.items() if k!='answers'} for a in self.all('attempt') if a['enrollment']==e['ref']],discussions=[r for r in self.all('discussion') if r['course']==e['course'] and not r.get('hidden')],sessions=[r for r in self.all('session') if r['course']==e['course'] and not r.get('cancelled')],certificate=next((r for r in self.all('certificate') if r['enrollment']==e['ref']),None))
        if op in ('lesson-complete','quiz-submit'):
            self.signed();e=self.enrollment(d['ref']);self.available(e);l=next((l for l in self.release(e)['lessons'] if l['ref']==d['lesson']),None);require(l,'Lesson not found.');require(self.now>=e['started']+l['drip_days']*86400,'This lesson is not available yet.')
            progress=next((p for p in self.all('progress') if p['enrollment']==e['ref'] and p['lesson']==l['ref']),None)
            if progress:return progress
            if op=='quiz-submit':
                require(l['type']=='quiz','This is not a quiz.');attempts=[a for a in self.all('attempt') if a['enrollment']==e['ref'] and a['lesson']==l['ref']];require(len(attempts)<l['max_attempts'],'Attempt limit reached. Contact your instructor.')
                answers=d.get('answers',[]);require(isinstance(answers,list) and len(answers)==len(l['questions']),'Answer every question.')
                for a,question in zip(answers,l['questions']):integer(a,0,len(question['choices'])-1)
                score=round(100*sum(a==question['answer'] for a,question in zip(answers,l['questions']))/len(answers));passed=score>=l['pass_percent'];a=self.save('attempt',dict(enrollment=e['ref'],lesson=l['ref'],owner=e['owner'],score=score,passed=passed))
                if not passed:return dict(a,remaining=l['max_attempts']-len(attempts)-1)
            else:require(l['type']!='quiz','Submit the assessment to complete this lesson.')
            p=self.save('progress',dict(enrollment=e['ref'],lesson=l['ref'],owner=e['owner'],completed=self.now));self.audit(p,'lesson-completed')
            done={x['lesson'] for x in self.all('progress') if x['enrollment']==e['ref']}
            if all(x['ref'] in done for x in self.release(e)['lessons'] if x['required']):self.complete(e)
            return p
        if op=='discussion-post':
            self.signed();e=self.enrollment(d['ref']);self.available(e);body=text(d.get('body'),3000);require(body,'Write a message.');r=self.save('discussion',dict(course=e['course'],owner=self.uid,name=e['name'],body=body,hidden=False));return r
        if op=='discussion-moderate':
            r=self.get(d['ref'],'discussion');self.teach(self.get(r['course'],'course'));self.expected(r,d);return self.save('discussion',dict(hidden=bool(d.get('hidden'))),r)
        if op=='instructor-save':
            self.admin();old=self.get(d['ref'],'instructor') if d.get('ref') else None
            if old:self.expected(old,d)
            uid=text(d.get('user_id'),100);require(uid and text(d.get('name'),100),'Name and Cloudgate user ID are required.');r=self.save('instructor',dict(name=text(d['name'],100),user_id=uid,bio=text(d.get('bio'),3000),image_url=asset(d.get('image_url')),active=bool(d.get('active',True))),old);self.audit(r,'instructor-saved');return r
        if op=='session-save':
            c=self.get(d['course'],'course');self.teach(c);old=self.get(d['ref'],'session') if d.get('ref') else None
            if old:require(old['course']==c['ref'],'Course mismatch.');self.expected(old,d)
            starts=integer(d['starts'],1,4102444800);ends=integer(d['ends'],starts+60,4102444800);title=text(d.get('title'),160);require(title,'Session title is required.')
            r=self.save('session',dict(course=c['ref'],title=title,starts=starts,ends=ends,url=asset(d.get('url')),location=text(d.get('location'),300),cancelled=bool(d.get('cancelled',False))),old);self.audit(r,'session-saved');return r
        if op=='attendance-save':
            session=self.get(d['session'],'session');self.teach(self.get(session['course'],'course'));e=self.get(d['enrollment'],'enrollment');require(e['course']==session['course'],'Learner is not enrolled in this course.');old=next((r for r in self.all('attendance') if r['session']==session['ref'] and r['enrollment']==e['ref']),None);return self.save('attendance',dict(session=session['ref'],course=e['course'],enrollment=e['ref'],owner=e['owner'],present=bool(d['present'])),old)
        if op=='enrollment-status':
            self.admin();e=self.get(d['ref'],'enrollment');self.expected(e,d);status=d['status'];require(status in ('suspended','active'),'Choose active or suspended.');require(e['status'] in ('active','completed','suspended'),'A paid enrolment must be verified before activation.');r=self.save('enrollment',dict(status=status),e)
            for cert in self.all('certificate'):
                if cert['enrollment']==e['ref']:self.save('certificate',dict(status='valid' if status=='active' else 'revoked'),cert)
            self.audit(r,'enrollment-'+status);return r
        if op=='settings':
            self.admin();allowed=set(self.public_settings());values=d.get('values',{})
            for k,v in values.items():
                if k not in allowed:continue
                v=text(v,12000)
                if k.endswith('_url'):v=asset(v)
                self.sql.append('INSERT INTO settings(key,value) VALUES('+q(k)+','+q(v)+') ON CONFLICT(key) DO UPDATE SET value=excluded.value;')
            self.audit(dict(ref='settings'),'settings-saved');return dict(ok=True)
        if op in ('checkout-prepare','payment-prepare','_checkout-save','_payment-apply','refund-prepare','_refund-claim','_refund-apply'):return self.payments(op,d)
        if op=='_mail-claim':
            token=uuid.uuid4().hex;items=[]
            for m in self.all('message'):
                if m['status'] in ('queued','sending') and m.get('due',0)<=self.now and m.get('lease_until',0)<=self.now and m['attempts']<5:
                    items.append(self.save('message',dict(status='sending',lease=token,lease_until=self.now+300,attempts=m['attempts']+1),m))
                    if len(items)==5:break
            return dict(token=token,messages=items)
        if op=='_mail-result':
            for result in d.get('results',[]):
                m=self.get(result['ref'],'message')
                if m.get('lease')!=d.get('token') or m['status']!='sending':continue
                self.save('message',dict(status='sent' if result['sent'] else 'failed' if m['attempts']>=5 else 'queued',lease_until=0,due=self.now+60*2**m['attempts'],last_error='' if result['sent'] else 'Email delivery failed.'),m)
            return dict(ok=True)
        raise ValueError('Unknown operation.')

    def payments(self,op,d):
        if op in ('checkout-prepare','payment-prepare','_checkout-save','_payment-apply'):
            o=self.get(d['ref'],'order');e=self.get(o['enrollment'],'enrollment')
            if not self.internal:self.signed();require(o['owner']==self.uid or self.isadmin(),'Record not found.')
            if op=='checkout-prepare':require(o['status']=='due' and e['status']=='pending','Payment is no longer due.');return dict(o,url=self.settings.get('website_url',''))
            if op=='payment-prepare':require(o.get('payment_id'),'Checkout not started.');return o
            if op=='_checkout-save':
                pid=text(d.get('payment_id'),100);url=asset(d.get('payment_url'));require(pid and url.startswith('https://'),'Wallet did not return a secure checkout.');require(not o.get('payment_id') or pid==o['payment_id'],'Checkout identity changed.');self.save('order',dict(payment_id=pid,payment_url=url),o);return dict(payment_url=url,ref=o['ref'])
            p=d.get('provider',{});require(str(p.get('Id'))==o.get('payment_id') and p.get('GrossAmount')==o['amount'] and str(p.get('Currency','')).upper()==o['currency'],'Wallet payment details do not match.')
            if o['status']=='paid':return dict(status='succeeded',ref=o['ref'])
            if p.get('Status')!=1:self.save('order',dict(last_checked=self.now),o);return dict(status='pending',ref=o['ref'])
            require(e['status']=='pending','Enrollment requires manual payment review.');self.save('order',dict(status='paid',paid=self.now),o);self.save('enrollment',dict(status='active',started=self.now),e);self.mail(e,'Welcome to '+e['title'],'Your payment is confirmed. Open your learner portal to start learning.','enrolled-'+e['ref']);self.audit(o,'payment-verified');return dict(status='succeeded',ref=o['ref'])
        if op=='refund-prepare':
            self.admin();o=self.get(d['ref'],'order');require(o['status']=='paid','Only verified payments can be refunded.');key=text(d.get('request_key'),96);require(len(key)>=16,'Refund key is required.');existing=next((r for r in self.all('refund') if r['request_key']==key),None)
            if existing:require(existing['order']==o['ref'],'Refund key mismatch.');return existing
            require(not any(r['order']==o['ref'] and r['status']!='failed' for r in self.all('refund')),'A refund already exists.');return dict(order=o['ref'],payment_id=o['payment_id'],enrollment=o['enrollment'],owner=o['owner'],amount=o['amount'],currency=o['currency'],request_key=key)
        if op=='_refund-claim':
            v=d['prepared'];r=next((r for r in self.all('refund') if r['request_key']==v['request_key']),None)
            if r:return r
            require(not any(r['order']==v['order'] and r['status']!='failed' for r in self.all('refund')),'A refund already exists.');return self.save('refund',dict(v,status='pending'))
        r=next((r for r in self.all('refund') if r['request_key']==d['request_key']),None);require(r,'Refund not found.');p=d['provider'];require(str(p.get('PaymentId'))==r['payment_id'] and p.get('Amount')==r['amount'] and str(p.get('Currency','')).upper()==r['currency'] and p.get('IdempotencyKey')=='courses-refund-'+r['request_key'],'Refund response does not match.');status=str(p.get('Status','')).lower();require(status in ('succeeded','pending','failed','submitting','reconciliation_required'),'Unknown refund state.')
        if r['status']=='succeeded':return r
        if status=='succeeded':
            require(p.get('RefundId'),'Refund ID missing.');e=self.get(r['enrollment'],'enrollment');self.save('enrollment',dict(status='refunded'),e)
            for cert in self.all('certificate'):
                if cert['enrollment']==e['ref']:self.save('certificate',dict(status='revoked'),cert)
            self.mail(e,'Refund confirmed','Your course payment has been refunded and access has ended.','refunded-'+r['ref'])
        result=self.save('refund',dict(status=status,provider_id=p.get('RefundId','')),r);self.audit(result,'refund-'+status);return result

def plan(snapshot,request,identity=None,now=None,internal=False):
    e=Engine(snapshot,identity,now,internal);result=e.dispatch(request);writes=list(e.sql)
    for r in e.changed.values():writes.append('INSERT INTO entities(kind,ref,owner,version,data) VALUES('+','.join([q(r['kind']),q(r['ref']),q(r['owner']),str(r['version']),q(encoded(r))])+') ON CONFLICT(ref) DO UPDATE SET owner=excluded.owner,version=excluded.version,data=excluded.data;')
    sql=''
    if writes:sql='BEGIN IMMEDIATE; INSERT INTO write_guard(expected) VALUES('+q(e.settings.get('_revision','0'))+');\n'+'\n'.join(writes)+"\nUPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='_revision'; DELETE FROM write_guard; COMMIT;\n"
    return sql+'SELECT '+q(encoded(result))+' AS result;',result
