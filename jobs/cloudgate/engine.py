"""Jobs domain: validated identity + bounded snapshot -> atomic SQL plan.

Native workflows and the loopback simulator share these rules. Private attachment
bytes are loaded only by the authorised attachment-read workflow, never in a snapshot.
"""
import base64
import binascii
import struct
MAX_BYTES=1048576
import calendar
import copy
import datetime as dt
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import re
import time
import uuid
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

def validate_png(data):
    if len(data) > MAX_BYTES or not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Upload a PNG image under 4 MB.')
    offset, first, ended, pixels = 8, True, False, False
    while offset + 12 <= len(data):
        size = struct.unpack('>I', data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        end = offset + 12 + size
        if end > len(data): raise ValueError('Incomplete PNG image.')
        payload = data[offset+8:offset+8+size]
        crc = struct.unpack('>I', data[offset+8+size:end])[0]
        if binascii.crc32(kind+payload) & 0xffffffff != crc: raise ValueError('Invalid PNG image.')
        if first:
            if kind != b'IHDR' or size != 13: raise ValueError('Invalid PNG header.')
            width, height = struct.unpack('>II', payload[:8])
            if not 1 <= width <= 2048 or not 1 <= height <= 2048: raise ValueError('Images must be at most 2048 pixels per side.')
            first = False
        if kind == b'IDAT': pixels = True
        if kind == b'IEND':
            ended = size == 0 and end == len(data)
            break
        offset = end
    if not ended or not pixels: raise ValueError('Incomplete PNG image.')


def encoded(x): return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def q(x):
    if x is None:return 'NULL'
    return "CAST(X'"+str(x).encode('utf8').hex()+"' AS TEXT)"
def require(ok,msg):
    if not ok:raise ValueError(msg)
def text(x,n=2000):return str(x or '').strip()[:n]
def integer(x,lo=0,hi=100000000000,label='Value'):
    require(not isinstance(x,bool),label+' must be a whole number.')
    try:v=Decimal(str(x));i=int(v)
    except (ValueError,InvalidOperation,OverflowError):raise ValueError(label+' must be a whole number.')
    require(v==i and lo<=i<=hi,label+' is outside its allowed range.')
    return i
def asset(x):
    s=text(x,2049);u=urlsplit(s)
    require(len(s)<=2048 and not re.search(r'[\s\\<>]',s) and (not s or (s.startswith('/') and not s.startswith('//')) or (u.scheme=='https' and u.hostname and not u.username and not u.password)),'Use an HTTPS image URL or relative image path.')
    return s
def snapshot_sql():
    return "SELECT json_object('settings',json(COALESCE((SELECT json_group_array(json_object('key',key,'value',value)) FROM settings),'[]')),'entities',json(COALESCE((SELECT json_group_array(json(data)) FROM (SELECT data FROM entities ORDER BY Id LIMIT 10001)),'[]'))) AS snapshot;"
def pricing(lines,discount_bps=0,tax_bps=0,tax_mode='exclusive',selected=None):
    require(isinstance(lines,list) and 0<len(lines)<=100,'Add between one and 100 line items.')
    discount_bps=integer(discount_bps,0,10000,'Discount');tax_bps=integer(tax_bps,0,10000,'Tax')
    require(tax_mode in ('exclusive','inclusive','none'),'Choose a valid tax mode.')
    clean=[];subtotal=0
    for i,row in enumerate(lines):
        name=text(row.get('name'),160);require(name,'Each line needs a description.')
        try:qty=Decimal(str(row.get('quantity',1)))
        except InvalidOperation:raise ValueError('Enter a valid quantity.')
        require(qty.is_finite() and Decimal('0')<qty<=Decimal('100000') and qty==qty.quantize(Decimal('.001')),'Quantity must be positive with up to three decimal places.')
        rate=integer(row.get('rate',0),0,100000000,'Unit price');optional=bool(row.get('optional'))
        amount=int((qty*rate).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
        item=dict(name=name,quantity=str(qty),rate=rate,amount=amount,optional=optional,index=i,category=text(row.get('category','labour'),30))
        clean.append(item)
        if not optional or (selected is not None and i in selected):subtotal+=amount
    discount=int((Decimal(subtotal)*discount_bps/10000).quantize(Decimal('1'),rounding=ROUND_HALF_UP));net=subtotal-discount
    tax=int((Decimal(net)*tax_bps/(10000+tax_bps if tax_mode=='inclusive' else 10000)).quantize(Decimal('1'),rounding=ROUND_HALF_UP)) if tax_mode!='none' else 0
    return dict(lines=clean,subtotal=subtotal,discount=discount,tax=tax,total=net+(tax if tax_mode=='exclusive' else 0),discount_bps=discount_bps,tax_bps=tax_bps,tax_mode=tax_mode)

class Engine:
    def __init__(self,snapshot,identity=None,now=None,internal=False):
        self.s=copy.deepcopy(snapshot);self.user=identity or {};self.now=int(time.time()) if now is None else now;self.internal=internal
        self.settings={r['key']:r['value'] for r in self.s.get('settings',[])}
        self.rows=self.s.get('entities',[]);require(len(self.rows)<=10000,'Workspace capacity reached. Archive/export history before adding more records.')
        self.changed={};self.sql=[];self.uid=str(self.user.get('Id') or '') if self.user.get('IsActive') is True else ''
        self.role=str(self.user.get('Role','')).lower() if self.uid else ''
        self.member=next((r for r in self.rows if r['kind']=='team' and r.get('user_id')==self.uid and r.get('active') and self.uid),None)
        if self.member and self.role not in ('admin','administrator','owner'):self.role=self.member.get('role','technician')
        elif self.role not in ('admin','administrator','owner'):self.role='customer' if self.uid else ''
    def all(self,kind):return [r for r in self.rows if r['kind']==kind]
    def get(self,ref,kind=None):
        r=next((r for r in self.rows if r['ref']==str(ref) and (not kind or r['kind']==kind)),None);require(r is not None,'Record not found.');return r
    def admin(self):require(self.role in ('admin','administrator','owner'),'Owner access required.')
    def manager(self):require(self.role in ('admin','administrator','owner','manager','dispatcher'),'Office access required.')
    def signed(self):require(self.uid,'Please sign in.')
    def isoffice(self):return self.role in ('admin','administrator','owner','manager','dispatcher')
    def access(self,r,write=False):
        self.signed()
        if self.isoffice():return
        if self.role=='technician':
            require(r['kind'] in ('job','visit','note','checklist','time','attachment'),'Record not found.')
            job=r['ref'] if r['kind']=='job' else r.get('job','')
            require(job and any(self.member['ref'] in v.get('staff',[]) for v in self.all('visit') if v.get('job')==job),'This work is not assigned to you.')
        else:
            require(r.get('owner')==self.uid,'Record not found.')
            require(r['kind'] not in ('time','checklist','audit','team','service','message','recurring','refund'),'Record not found.')
            if r['kind']=='quote':require(r.get('status')!='draft','Record not found.')
    def save(self,kind,values,old=None,ref=None):
        r=dict(old or {},**values);r.update(kind=kind,ref=old['ref'] if old else (ref or kind[:3].upper()+'-'+uuid.uuid4().hex[:12].upper()),version=(old or {}).get('version',0)+1,updated=self.now)
        r.setdefault('created',self.now);r.setdefault('owner','');r.setdefault('job','')
        if old:self.rows[self.rows.index(old)]=r
        else:self.rows.append(r)
        self.changed[r['ref']]=r;return r
    def event(self,r,action):self.save('audit',dict(entity=r['ref'],job=r.get('job') or (r['ref'] if r['kind']=='job' else ''),action=action,actor=self.uid or 'worker',owner=r.get('owner','')))
    def expected(self,r,d):require(integer(d.get('version',0))==r['version'],'This record changed. Refresh before saving.')
    def queue(self,r,subject,body,key):
        if any(m.get('dedupe')==key for m in self.all('message')):return
        customer=self.get(r['customer'],'customer') if r.get('customer') else None
        if customer and customer.get('email'):self.save('message',dict(recipient=customer['email'],subject=subject,body=body,dedupe=key,status='queued',attempts=0,due=self.now))
    def public_settings(self):return {k:v for k,v in self.settings.items() if not k.startswith(('smtp_','_'))}
    def balance(self,job):
        paid=sum(p['amount'] for p in self.all('payment') if p['job']==job and p['status']=='succeeded')
        allocated={p['ref'] for p in self.all('payment') if p['job']==job and p['status']=='succeeded'}
        refunded=sum(p['amount'] for p in self.all('refund') if p['job']==job and p['status']=='succeeded' and p['payment'] in allocated)
        return paid-refunded
    def billed_total(self,job):
        j=self.get(job,'job');return max(0,j['total']-sum(c['amount'] for c in self.all('credit') if c['job']==job))
    def clean(self,r):
        value=copy.deepcopy(r)
        if not self.isoffice():
            for k in ('user_id','internal_notes','payment_id','payment_url','request_key','provider','token','cost'):value.pop(k,None)
            if r['kind']=='obligation':value['has_checkout']=bool(r.get('payment_id'))
        if r['kind']=='job':value['credited']=r['total']-self.billed_total(r['ref']);value['paid']=self.balance(r['ref']);value['balance']=max(0,self.billed_total(r['ref'])-value['paid'])
        if r['kind']=='invoice':
            value['credited']=sum(c['amount'] for c in self.all('credit') if c.get('invoice')==r['ref']);value['paid']=min(r['total']-value['credited'],max(0,self.balance(r['job'])));value['balance']=max(0,r['total']-value['credited']-self.balance(r['job']))
            if r['status']!='void':value['status']='paid' if not value['balance'] else ('partially_paid' if value['paid'] else 'issued')
        if self.role=='technician' and r['kind']=='job':
            for key in ('total','paid','balance','deposit','currency','lines','selected','pricing','business'):value.pop(key,None)
            customer=self.get(r['customer'],'customer');value['customer_contact']=dict(name=customer['name'],phone=customer.get('phone',''))
        return value
    def workspace(self):
        self.signed();visible=[]
        for r in self.rows:
            if r['kind'] in ('key','checkout','outbox_claim'):continue
            if self.isoffice():visible.append(self.clean(r));continue
            if r['kind'] in ('settings','message','audit','recurring','team','service','block','refund'):continue
            if r['kind'] in ('note','attachment') and self.role=='customer' and r.get('visibility')!='customer':continue
            try:self.access(r)
            except ValueError:continue
            visible.append(self.clean(r))
        return dict(settings=self.public_settings(),records=visible,services=[r for r in self.all('service') if r.get('active')],team=[self.clean(r) for r in self.all('team') if r.get('active')] if self.isoffice() else [],role=self.role,identity=dict(id=self.uid,name=self.user.get('Name',''),email=self.user.get('Email','')))
    def dispatch(self,d):
        op=d.get('op','catalog')
        require(not op.startswith('_') or self.internal,'Internal operation denied.')
        if op=='catalog':return dict(settings=self.public_settings(),services=[r for r in self.all('service') if r.get('active')])
        if op in ('workspace','admin-data'):
            result=self.workspace();result['staff']=result['team']
            if self.isoffice():result['services']=self.all('service')
            if self.role in ('admin','administrator','owner'):
                result['settings'].update({k:v for k,v in self.settings.items() if k.startswith('smtp_') and k!='smtp_password'})
                result['settings']['smtp_password']=''
            return result
        if op=='settings':
            self.admin();values=d.get('values',{});require(isinstance(values,dict),'Invalid settings.')
            for key,value in values.items():
                require(key in self.settings and not key.startswith('_'),'Unknown setting.')
                value=text(value,10000)
                if key=='smtp_password' and not value:continue
                if key.startswith('theme_'):require(bool(re.fullmatch('#[0-9a-fA-F]{6}',value)),'Choose a valid colour.')
                if key.endswith('_url') and key!='website_url':value=asset(value)
                if key=='website_url':require(not value or (urlsplit(value).scheme=='https' and urlsplit(value).hostname and not urlsplit(value).username),'Use an HTTPS website URL.')
                if key=='currency':require(bool(re.fullmatch('[A-Z]{3}',value)),'Use a three-letter currency code.')
                if key=='timezone':ZoneInfo(value)
                if key=='tax_bps':integer(value,0,10000)
                if key=='payment_terms':integer(value,0,365)
                self.sql.append('UPDATE settings SET value='+q(value)+' WHERE key='+q(key)+';')
                self.settings[key]=value
            return dict(settings=self.public_settings())
        if op in ('service-save','team-save','customer-save','address-save'):
            kind=op.split('-')[0];old=self.get(d['ref'],kind) if d.get('ref') else None
            if kind in ('service','team'):self.admin()
            elif self.isoffice():self.manager()
            else:
                self.signed()
                if old:self.access(old)
            if old:self.expected(old,d)
            fields={'service':('name','description','category','image_url','price','active'),'team':('name','title','user_id','role','image_url','active'),'customer':('name','email','phone','internal_notes'),'address':('customer','label','address','instructions')}[kind]
            v={k:d.get(k,(old or {}).get(k,'')) for k in fields}
            for k in ('name','description','category','title','user_id','email','phone','internal_notes','label','address','instructions'):
                if k in v:v[k]=text(v[k])
            require(v.get('name') or v.get('address'),'Name or address is required.')
            if 'image_url' in v:v['image_url']=asset(v['image_url'])
            if 'active' in v:v['active']=bool(v['active'])
            if kind=='service':v['price']=integer(v['price'])
            if kind=='team':
                require(v['role'] in ('technician','manager','dispatcher'),'Choose a staff role.')
                require(not v['user_id'] or not any(t.get('user_id')==v['user_id'] and t['ref']!=(old or {}).get('ref') for t in self.all('team')),'This account is already linked to a team member.')
            if kind=='customer':
                if not self.isoffice():v.pop('internal_notes',None);v['email']=self.user.get('Email','');v['owner']=self.uid
                else:v['owner']=(old or {}).get('owner','')
            if kind=='address':
                c=self.get(v['customer'],'customer');self.access(c);v['owner']=c['owner']
            r=self.save(kind,v,old);self.event(r,op);return self.clean(r)
        if op=='customer-link':
            self.admin();r=self.get(d['ref'],'customer');self.expected(r,d);uid=text(d.get('user_id'),50);require(uid.isdigit() and int(uid)>0,'Enter the verified customer IdP account ID.')
            require(not r['owner'] or r['owner']==uid,'This customer is already linked to another account.')
            require(not any(c['owner']==uid and c['ref']!=r['ref'] for c in self.all('customer')),'This account is already linked to a customer.')
            linked=self.save('customer',dict(owner=uid),r)
            for record in list(self.rows):
                if record.get('customer')==r['ref']:self.save(record['kind'],dict(owner=uid),record)
            self.event(linked,'customer-account-linked');return self.clean(linked)
        if op=='request-office':
            self.manager();c=self.get(d['customer'],'customer');require(text(d.get('title')) and text(d.get('address')),'Enter the work and service address.')
            r=self.save('request',dict(owner=c['owner'],customer=c['ref'],title=text(d['title'],160),address=text(d['address'],1000),description=text(d.get('description'),5000),status='new'));self.event(r,'office-request-created');return r
        if op=='request-create':
            self.signed();key=text(d.get('request_key'),96);require(len(key)>=16,'A request key is required.')
            existing=next((r for r in self.all('request') if r.get('request_key')==key and r['owner']==self.uid),None)
            if existing:return self.clean(existing)
            c=next((c for c in self.all('customer') if c['owner']==self.uid),None)
            if not c:c=self.save('customer',dict(name=text(d.get('name') or self.user.get('Name'),120),email=text(self.user.get('Email'),254),phone=text(d.get('phone'),40),owner=self.uid))
            title=text(d.get('title'),160);address=text(d.get('address'),1000);require(title and address,'Describe the work and enter a service address.')
            r=self.save('request',dict(owner=self.uid,customer=c['ref'],title=title,address=address,description=text(d.get('description'),5000),status='new',request_key=key));self.event(r,'request-created');return self.clean(r)
        if op=='request-status':
            self.manager();r=self.get(d['ref'],'request');self.expected(r,d);require(d['status'] in ('new','reviewing','closed'),'Invalid request status.');return self.save('request',dict(status=d['status']),r)
        if op=='quote-save':
            self.manager();old=self.get(d['ref'],'quote') if d.get('ref') else None
            if old:self.expected(old,d);require(old['status'] in ('draft','sent','declined','expired'),'Accepted quotes cannot be changed.')
            request=self.get(d['request'],'request');require(request['status'] not in ('converted','closed'),'This request already has a job or is closed. Create a new work request.');p=pricing(d.get('lines'),d.get('discount_bps',0),d.get('tax_bps',self.settings.get('tax_bps',0)),d.get('tax_mode','exclusive'))
            c=self.get(request['customer'],'customer')
            v=dict(p,owner=request['owner'],customer=request['customer'],customer_snapshot=dict(name=c['name'],email=c['email'],address=request['address']),request=request['ref'],title=text(d.get('title') or request['title'],160),address=request['address'],status='draft',deposit_percent=integer(d.get('deposit_percent',0),0,100),expires=integer(d.get('expires',self.now+30*86400),self.now+60),revision=(old or {}).get('revision',0)+1,notes=text(d.get('notes'),5000),currency=self.settings['currency'],business=self.public_settings())
            if old:self.save('quote',dict(status='superseded'),old)
            r=self.save('quote',v);self.event(r,'quote-created');return self.clean(r)
        if op=='quote-send':
            self.manager();r=self.get(d['ref'],'quote');self.expected(r,d);require(r['status']=='draft','Only draft quotes can be sent.');r=self.save('quote',dict(status='sent'),r)
            self.queue(r,'Your quote is ready',r['title']+'\nSign in to review your quote: '+self.settings.get('website_url','')+'/account','quote:'+r['ref']);self.event(r,'quote-sent');return self.clean(r)
        if op in ('quote-accept','quote-decline','quote-preview'):
            r=self.get(d['ref'],'quote');self.access(r);require(self.role=='customer','Quote decisions require the customer account.')
            if r['status']=='accepted' and op=='quote-accept':return self.clean(next(j for j in self.all('job') if j.get('quote')==r['ref']))
            self.expected(r,d);require(r['status']=='sent' and r['expires']>self.now,'This quote is no longer available for approval.')
            require(self.get(r['request'],'request')['status']!='converted','This request already has an approved job.')
            if op=='quote-decline':return self.save('quote',dict(status='declined'),r)
            selected=d.get('selected',[]);require(isinstance(selected,list) and all(isinstance(i,int) and any(l['index']==i and l['optional'] for l in r['lines']) for i in selected),'Invalid optional extras.')
            p=pricing(r['lines'],r['discount_bps'],r['tax_bps'],r['tax_mode'],selected)
            if op=='quote-preview':return dict(p,deposit=(p['total']*r['deposit_percent']+50)//100,version=r['version'])
            accepted=self.save('quote',dict(p,status='accepted',selected=selected,accepted_at=self.now,accepted_by=self.uid),r)
            p['lines']=[l for l in p['lines'] if not l['optional'] or l['index'] in selected]
            deposit=(p['total']*r['deposit_percent']+50)//100
            job=self.save('job',dict(owner=r['owner'],customer=r['customer'],quote=r['ref'],title=r['title'],address=r['address'],status='awaiting_deposit' if deposit else 'ready',total=p['total'],deposit=deposit,currency=r['currency'],lines=p['lines'],selected=selected,pricing=p,business=r['business']))
            self.save('request',dict(status='converted'),self.get(r['request'],'request'))
            for other in self.all('quote'):
                if other['ref']!=r['ref'] and other.get('request')==r['request'] and other['status'] in ('draft','sent'):self.save('quote',dict(status='superseded'),other)
            if deposit:self.save('obligation',dict(job=job['ref'],owner=job['owner'],customer=job['customer'],amount=deposit,currency=job['currency'],purpose='deposit',status='due'))
            self.event(accepted,'quote-accepted');return self.clean(job)
        if op=='visit-save':
            self.manager();j=self.get(d['job'],'job');require(j['status'] not in ('cancelled','completed','awaiting_deposit'),'This job is not ready for scheduling.')
            old=self.get(d['ref'],'visit') if d.get('ref') else None
            if old:self.expected(old,d);require(old['job']==j['ref'] and old['status']=='scheduled','Only scheduled visits can be moved.')
            starts=integer(d['starts'],0);ends=integer(d['ends'],starts+60,starts+7*86400);staff=d.get('staff',[])
            require(isinstance(staff,list) and 0<len(staff)<=20 and len(set(staff))==len(staff),'Assign at least one team member.')
            for ref in staff:require(self.get(ref,'team').get('active'),'A selected team member is inactive.')
            r=self.save('visit',dict(job=j['ref'],owner=j['owner'],title=text(d.get('title') or j['title'],160),starts=starts,ends=ends,staff=staff,status='scheduled'),old)
            self.sql.append('DELETE FROM allocations WHERE visit='+q(r['ref'])+';')
            for ref in staff:self.sql.append('INSERT INTO allocations(visit,staff,starts,ends) VALUES('+','.join([q(r['ref']),q(ref),str(starts),str(ends)])+');')
            if j['status']=='ready':self.save('job',dict(status='scheduled'),j)
            self.event(r,'visit-scheduled');return r
        if op=='block-save':
            self.manager();staff=self.get(d['staff'],'team');starts=integer(d['starts']);ends=integer(d['ends'],starts+60)
            r=self.save('block',dict(staff=staff['ref'],starts=starts,ends=ends,title=text(d.get('title') or 'Unavailable',160)))
            self.sql.append('INSERT INTO allocations(visit,staff,starts,ends) VALUES('+','.join([q(r['ref']),q(staff['ref']),str(starts),str(ends)])+');');return r
        if op=='block-delete':
            self.manager();r=self.get(d['ref'],'block');self.sql.append('DELETE FROM allocations WHERE visit='+q(r['ref'])+';');return self.save('block',dict(status='cancelled'),r)
        if op in ('visit-status','job-status'):
            kind=op.split('-')[0];r=self.get(d['ref'],kind);self.access(r,True);require(self.role!='customer','Staff access required.');self.expected(r,d)
            status=d.get('status');transitions={'ready':('cancelled',),'awaiting_deposit':('cancelled',),'scheduled':('in_progress','cancelled'),'in_progress':('completed','cancelled')}
            require(status in transitions.get(r['status'],()),'That status change is not allowed.')
            if status=='cancelled':self.manager()
            if kind=='job' and status=='completed':require(all(v['status'] in ('completed','cancelled') for v in self.all('visit') if v['job']==r['ref']),'Complete all visits first.')
            if status=='completed':
                require(all(t.get('done') for t in self.all('checklist') if t['job']==(r['ref'] if kind=='job' else r['job']) and t.get('required')),'Complete the required checklist items first.')
                require(not any(t for t in self.all('time') if t['job']==(r['ref'] if kind=='job' else r['job']) and not t.get('ends')),'Stop running timers before completing work.')
            r=self.save(kind,dict(status=status),r)
            if kind=='visit' and status=='in_progress':
                j=self.get(r['job'],'job')
                if j['status']=='scheduled':self.save('job',dict(status='in_progress'),j)
            if status=='cancelled':
                visits=[r] if kind=='visit' else [v for v in self.all('visit') if v['job']==r['ref'] and v['status']!='completed']
                for v in visits:
                    self.sql.append('DELETE FROM allocations WHERE visit='+q(v['ref'])+';')
                    if v['ref']!=r['ref']:self.save('visit',dict(status='cancelled'),v)
            self.event(r,op+':'+status);return self.clean(r)
        if op in ('note-add','checklist-add','checklist-toggle','time-start','time-stop','time-add'):
            j=self.get(d['job'],'job');self.access(j,True);require(self.role!='customer','Staff access required.')
            if op=='note-add':
                require(text(d.get('body')),'Write a note.');return self.save('note',dict(job=j['ref'],owner=j['owner'],body=text(d['body'],10000),visibility='customer' if d.get('visibility')=='customer' else 'internal',author=self.uid))
            if op=='checklist-add':return self.save('checklist',dict(job=j['ref'],owner=j['owner'],title=text(d.get('title'),300),required=bool(d.get('required')),done=False))
            if op=='checklist-toggle':
                r=self.get(d['ref'],'checklist');require(r['job']==j['ref'],'Checklist not found.');self.expected(r,d);return self.save('checklist',dict(done=bool(d['done'])),r)
            if op=='time-start':
                require(not any(t.get('user')==self.uid and not t.get('ends') for t in self.all('time')),'Stop your running timer first.');return self.save('time',dict(job=j['ref'],owner=j['owner'],user=self.uid,starts=self.now,ends=None,seconds=0))
            if op=='time-stop':
                r=self.get(d['ref'],'time');require(r['job']==j['ref'] and r['user']==self.uid and not r['ends'],'Timer not found.');return self.save('time',dict(ends=self.now,seconds=self.now-r['starts']),r)
            seconds=integer(d.get('minutes'),1,1440)*60;return self.save('time',dict(job=j['ref'],owner=j['owner'],user=self.uid,starts=self.now-seconds,ends=self.now,seconds=seconds))
        if op=='invoice-issue':
            self.manager();j=self.get(d['job'],'job');require(j['status']=='completed','Complete the job before issuing the final invoice.')
            existing=next((i for i in self.all('invoice') if i['job']==j['ref'] and i['status']!='void'),None)
            if existing:return self.clean(existing)
            c=self.get(j['customer'],'customer');r=self.save('invoice',dict(job=j['ref'],owner=j['owner'],customer=j['customer'],customer_snapshot=dict(name=c['name'],email=c['email'],address=j['address']),title=j['title'],status='issued',total=j['total'],currency=j['currency'],pricing=j['pricing'],business=self.public_settings(),due=self.now+integer(d.get('terms',self.settings['payment_terms']),0,365)*86400,number='INV-'+str(len(self.all('invoice'))+1).zfill(5)))
            due=max(0,j['total']-self.balance(j['ref']))
            for o in self.all('obligation'):
                if o['job']==j['ref'] and o['status']=='due':self.save('obligation',dict(status='superseded'),o)
            if due:self.save('obligation',dict(job=j['ref'],owner=j['owner'],customer=j['customer'],amount=due,currency=j['currency'],purpose='balance',status='due'))
            self.queue(r,'Your invoice is ready',r['number']+'\nSign in to view and pay: '+self.settings.get('website_url','')+'/account','invoice:'+r['ref']);self.event(r,'invoice-issued');return self.clean(r)
        if op=='invoice-void':
            self.admin();r=self.get(d['ref'],'invoice');self.expected(r,d);require(self.balance(r['job'])==0,'Resolve all payments before voiding this invoice.');require(text(d.get('reason')),'Enter a reason.')
            for o in self.all('obligation'):
                if o['job']==r['job'] and o['status']=='due':self.save('obligation',dict(status='superseded'),o)
            r=self.save('invoice',dict(status='void',reason=text(d['reason'])),r);self.event(r,'invoice-voided');return r
        if op=='invoice-credit':
            self.admin();i=self.get(d['ref'],'invoice');require(i['status']!='void','Cannot credit a void invoice.');key=text(d.get('request_key'),96);require(len(key)>=16,'Credit request key required.')
            old=next((c for c in self.all('credit') if c.get('request_key')==key),None)
            if old:require(old['invoice']==i['ref'] and old['amount']==d.get('amount'),'Credit request changed.');return old
            amount=integer(d.get('amount'),1,i['total']-sum(c['amount'] for c in self.all('credit') if c['invoice']==i['ref']));reason=text(d.get('reason'),1000);require(reason,'Enter a credit reason.')
            c=self.save('credit',dict(invoice=i['ref'],job=i['job'],owner=i['owner'],customer=i['customer'],customer_snapshot=i['customer_snapshot'],amount=amount,currency=i['currency'],title=reason,status='issued',number='CRN-'+str(len(self.all('credit'))+1).zfill(5),request_key=key,business=i['business']))
            for o in self.all('obligation'):
                if o['job']==i['job'] and o['status']=='due':self.save('obligation',dict(status='superseded'),o)
            due=max(0,self.billed_total(i['job'])-self.balance(i['job']))
            if due:self.save('obligation',dict(job=i['job'],owner=i['owner'],customer=i['customer'],amount=due,currency=i['currency'],purpose='balance',status='due'))
            self.event(c,'credit-issued');return c
        if op=='document':
            r=self.get(d['ref']);require(r['kind'] in ('quote','invoice','payment','credit'),'Document not found.');self.access(r)
            return dict(document=self.clean(r),customer=r.get('customer_snapshot') or (self.clean(self.get(r['customer'],'customer')) if r.get('customer') else {}),business=r.get('business',self.public_settings()))
        if op=='attachment-add':
            r=self.get(d['entity']);require(r['kind'] in ('request','job'),'Attach photos to a request or job.');self.access(r,True)
            content=d.get('content','');require(isinstance(content,str) and len(content)<=1400000,'Photo must be under 1 MB.')
            try:raw=base64.b64decode(content,validate=True)
            except Exception:raise ValueError('Invalid image encoding.')
            require(raw.startswith(b'\x89PNG\r\n\x1a\n') and len(raw)<=1048576,'Upload a PNG photo under 1 MB.')
            validate_png(raw)
            a=self.save('attachment',dict(entity=r['ref'],job=r['ref'] if r['kind']=='job' else '',owner=r['owner'],name=text(d.get('name'),120),visibility='customer' if self.role=='customer' or d.get('visibility')=='customer' else 'internal',size=len(raw)))
            self.sql.append('INSERT INTO attachments(ref,content) VALUES('+q(a['ref'])+','+q(content)+');');return a
        if op=='attachment-read':
            a=self.get(d['ref'],'attachment');self.access(self.get(a['entity']));require(self.role!='customer' or a['visibility']=='customer','Photo not found.');return dict(ref=a['ref'],name=a['name'])
        if op=='attachment-visibility':
            a=self.get(d['ref'],'attachment');self.access(self.get(a['entity']));require(self.role!='customer','Staff access required.');self.expected(a,d)
            require(d.get('visibility') in ('internal','customer'),'Choose a visibility.');return self.save('attachment',dict(visibility=d['visibility']),a)
        if op=='recurring-save':
            self.manager();old=self.get(d['ref'],'recurring') if d.get('ref') else None
            if old:self.expected(old,d)
            j=self.get(d['job'],'job');require(j.get('quote'),'Choose a quoted job as the template.');require(d['frequency'] in ('weekly','monthly'),'Choose weekly or monthly.')
            date=dt.date.fromisoformat(d['next_date']);return self.save('recurring',dict(job=j['ref'],title=j['title'],frequency=d['frequency'],next_date=date.isoformat(),anchor_day=(old or {}).get('anchor_day',date.day),active=bool(d.get('active',True))),old)
        if op=='_maintenance':
            count=0;tz=ZoneInfo(self.settings['timezone']);today=dt.datetime.fromtimestamp(self.now,tz).date()
            for rule in self.all('recurring'):
                if not rule['active']:continue
                date=dt.date.fromisoformat(rule['next_date'])
                if date>today:continue
                key='recurring:'+rule['ref']+':'+str(date)
                if not any(r.get('occurrence')==key for r in self.all('job')):
                    old=self.get(rule['job'],'job');v={k:old[k] for k in ('owner','customer','title','address','total','deposit','currency','lines','selected','pricing','business','quote')};v.update(status='ready',occurrence=key,deposit=0);self.save('job',v);count+=1
                if rule['frequency']=='weekly':date+=dt.timedelta(days=7)
                else:
                    month=date.month%12+1;year=date.year+(date.month==12);date=dt.date(year,month,min(rule.get('anchor_day',date.day),calendar.monthrange(year,month)[1]))
                self.save('recurring',dict(next_date=str(date)),rule)
                if count>=20:break
            for quote in self.all('quote'):
                if quote['status']=='sent' and quote['expires']<=self.now:self.save('quote',dict(status='expired'),quote)
            for visit in self.all('visit'):
                if visit['status']=='scheduled' and self.now<visit['starts']<=self.now+86400:
                    job=self.get(visit['job'],'job');self.queue(job,'Your service visit is tomorrow',job['title']+'\n'+str(dt.datetime.fromtimestamp(visit['starts'],tz)),'visit:'+visit['ref']+':'+str(visit['starts']))
            return dict(ok=True,generated=count)
        if op=='_mail-claim':
            if not self.settings.get('smtp_host') or not self.settings.get('smtp_from'):return dict(configured=False,messages=[])
            token=uuid.uuid4().hex;pending=[m for m in self.all('message') if m['status'] in ('queued','sending') and m['due']<=self.now and m['attempts']<5 and m.get('lease_until',0)<=self.now]
            claimed=[]
            for m in sorted(pending,key=lambda x:x['due'])[:3]:claimed.append(self.save('message',dict(status='sending',lease_until=self.now+300,claim=token,attempts=m['attempts']+1),m))
            return dict(configured=True,messages=claimed,claim=token)
        if op=='_mail-result':
            count=0
            for result in d.get('results',[]):
                m=self.get(result['ref'],'message')
                if m.get('claim')!=d.get('claim') or m['status']!='sending':continue
                status='sent' if result['sent'] else ('failed' if m['attempts']>=5 else 'queued')
                self.save('message',dict(status=status,lease_until=0,last_error=text(result.get('error'),100),due=self.now+min(3600,60*2**m['attempts'])),m);count+=1
            return dict(processed=count)
        if op.startswith('_payment') or op.startswith('_checkout') or op.startswith('_refund') or op in ('checkout-prepare','payment-prepare','refund-prepare'):
            return self.payments(op,d)
        raise ValueError('Unknown operation: '+str(op))

    def payments(self,op,d):
        if op in ('checkout-prepare','_checkout-save'):
            o=self.get(d['ref'],'obligation');j=self.get(o['job'],'job')
            if op=='checkout-prepare':
                self.access(o);require(o['status']=='due' and j['status']!='cancelled','This payment is no longer due.')
                require(o['amount']<=max(0,self.billed_total(j['ref'])-self.balance(j['ref'])),'The balance changed. Refresh the invoice.')
                c=self.get(o['customer'],'customer');return dict(o,email=c['email'],url=self.settings.get('website_url',''))
            pid=text(d.get('payment_id'),100);url=text(d.get('payment_url'),2048);require(pid and url.startswith('https://'),'Wallet did not return a secure checkout.')
            require(not o.get('payment_id') or o['payment_id']==pid,'Checkout identity changed.')
            r=self.save('obligation',dict(payment_id=pid,payment_url=url),o);return dict(payment_url=url,ref=r['ref'])
        if op=='payment-prepare':
            o=self.get(d['ref'],'obligation');self.access(o);require(o.get('payment_id'),'No checkout exists for this payment.');return o
        if op=='_payment-apply':
            o=self.get(d['ref'],'obligation');p=d.get('provider',{});pid=str(p.get('Id',''));amount=p.get('GrossAmount');currency=str(p.get('Currency','')).upper()
            require(pid==o.get('payment_id') and amount==o['amount'] and currency==o['currency'],'Wallet payment details do not match.')
            if p.get('Status')!=1:
                self.save('obligation',dict(last_checked=self.now),o);return dict(status='pending',ref=o['ref'])
            existing=next((r for r in self.all('payment') if r.get('payment_id')==pid),None)
            if existing:return self.clean(existing)
            j=self.get(o['job'],'job');review=o['status']!='due' or j['status']=='cancelled' or self.balance(j['ref'])+o['amount']>self.billed_total(j['ref'])
            r=self.save('payment',dict(job=j['ref'],owner=j['owner'],customer=j['customer'],amount=o['amount'],currency=o['currency'],payment_id=pid,obligation=o['ref'],status='review' if review else 'succeeded',purpose=o['purpose']))
            self.save('obligation',dict(status='review' if review else 'paid'),o)
            if not review and j['status']=='awaiting_deposit' and self.balance(j['ref'])>=j['deposit']:self.save('job',dict(status='ready'),j)
            self.event(r,'payment-'+r['status']);return self.clean(r)
        if op=='refund-prepare':
            self.admin();p=self.get(d['ref'],'payment');require(p['status'] in ('succeeded','review'),'Only verified payments can be refunded.');key=text(d.get('request_key'),96);require(len(key)>=16,'Refund request key required.')
            existing=next((r for r in self.all('refund') if r['request_key']==key),None)
            if existing:
                require(existing['payment']==p['ref'] and (d.get('amount') is None or d.get('amount')==existing['amount']),'Refund key belongs to a different payment or amount.');return dict(existing,payment_id=p['payment_id'])
            amount=integer(d.get('amount'),1,p['amount']);reserved=sum(r['amount'] for r in self.all('refund') if r['payment']==p['ref'] and r['status']!='failed')
            require(amount<=p['amount']-reserved,'Refund exceeds the remaining payment amount.')
            return dict(payment=p['ref'],job=p['job'],owner=p['owner'],amount=amount,currency=p['currency'],request_key=key,payment_id=p['payment_id'])
        if op=='_refund-claim':
            v=d['prepared'];existing=next((r for r in self.all('refund') if r['request_key']==v['request_key']),None)
            if existing:return existing
            p=self.get(v['payment'],'payment');reserved=sum(r['amount'] for r in self.all('refund') if r['payment']==p['ref'] and r['status']!='failed');require(v['amount']<=p['amount']-reserved,'Refund balance changed.')
            return self.save('refund',dict(v,status='pending'))
        if op=='_refund-apply':
            r=next((r for r in self.all('refund') if r['request_key']==d['request_key']),None);require(r,'Refund request not found.');p=d['provider']
            if r['status']=='succeeded':return r
            require(str(p.get('PaymentId',''))==r['payment_id'] and p.get('Amount')==r['amount'] and str(p.get('Currency','')).upper()==r['currency'] and p.get('IdempotencyKey')=='jobs-refund-'+r['request_key'],'Refund response does not match the request.')
            status=str(p.get('Status','')).lower();require(status in ('succeeded','pending','failed','submitting','reconciliation_required'),'Unknown refund state.')
            refund_id=str(p.get('RefundId') or '')
            if r.get('provider_id'):require(refund_id==r['provider_id'],'Refund identity changed.')
            if status=='succeeded':require(refund_id and not any(x.get('provider_id')==refund_id and x['ref']!=r['ref'] for x in self.all('refund')),'Refund reference is missing or already used.')
            r=self.save('refund',dict(status=status,provider_id=refund_id),r);self.event(r,'refund-'+status);return r
        raise ValueError('Unknown payment operation.')

def plan(snapshot,request,identity=None,now=None,internal=False):
    e=Engine(snapshot,identity,now,internal);result=e.dispatch(request);writes=list(e.sql)
    for r in e.changed.values():
        writes.append('INSERT INTO entities(kind,ref,owner,job,version,data) VALUES('+','.join([q(r['kind']),q(r['ref']),q(r['owner']),q(r['job']),str(r['version']),q(encoded(r))])+') ON CONFLICT(ref) DO UPDATE SET owner=excluded.owner,job=excluded.job,version=excluded.version,data=excluded.data;')
    if writes:
        sql='BEGIN IMMEDIATE; INSERT INTO write_guard(expected) VALUES('+q(e.settings.get('_revision','0'))+');\n'+'\n'.join(writes)+'\nUPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key=\'_revision\'; DELETE FROM write_guard; COMMIT;\n'
    else:sql=''
    return sql+'SELECT '+q(encoded(result))+' AS result;',result
