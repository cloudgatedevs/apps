import json
import clr
clr.AddReference('Web.Core.Shared')
from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
session_keys = list(WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}')))
def value(name):
    matches=[str(k.Value) for k in session_keys if str(k.Key).lower()==name.lower()]
    return matches[-1] if matches else ''
def obj(name, default=None):
    raw=value(name)
    return json.loads(raw) if raw and raw != 'No records found' else default
def snapshot(name='Snapshot'):
    rows=obj(name, [])
    if isinstance(rows,dict): rows=[rows]
    if not rows: raise Exception('The booking database could not be loaded.')
    raw=rows[0]['snapshot']
    return json.loads(raw) if isinstance(raw,str) else raw
def request():
    data=obj('body',{})
    if not isinstance(data,dict): raise Exception('Expected a JSON request.')
    return data

"""Booking domain engine. Pure snapshot -> SQL plan; used by Cloudgate and local runner.

All changes execute in a transaction. SQLite triggers are the final arbiter of availability.
Money is integer minor units; instants are UTC epoch seconds, opening hours are business local.
"""
import datetime as dt
import hashlib
import json
import re
import secrets
import time
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit

TABLES = ('settings','services','staff','resources','blocks','customers','bookings','allocations','payments','refund_requests','waitlist','promos','messages','audit','customer_accounts','booking_accounts')
def q(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return str(int(value))
    if isinstance(value, (int,float)): return str(value)
    # Hex SQL literals keep request text out of both SQL quoting and Cloudgate's template expansion.
    return "CAST(X'"+str(value).encode('utf-8').hex()+"' AS TEXT)"
def encoded(value): return json.dumps(value, ensure_ascii=False, separators=(',',':'))
def insert(table, record): return 'INSERT INTO '+table+' ('+','.join(record)+') VALUES ('+','.join(q(v) for v in record.values())+');'
def update(table, record, where): return 'UPDATE '+table+' SET '+','.join(k+'='+q(v) for k,v in record.items())+' WHERE '+where+';'
def digest(token): return hashlib.sha256(str(token).encode()).hexdigest()
def require(ok, message):
    if not ok: raise ValueError(message)
def integer(value, lo, hi, label='Value'):
    require(not isinstance(value,bool),label+' must be a number.')
    try: n=int(value)
    except (ValueError,TypeError): raise ValueError(label+' must be a number.')
    require(lo<=n<=hi,label+' is outside the allowed range.')
    return n
def email(value):
    v=str(value or '').strip().lower()
    require(len(v)<=254 and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v),'Enter a valid email address.')
    return v
def text(value,limit=500): return str(value or '').strip()[:limit]
def brand_asset(value):
    value=str(value or '').strip()
    require(len(value)<=2048 and not re.search(r'[\s\\<>]',value),'Use a valid image URL, up to 2048 characters.')
    if not value:return value
    if value.startswith('/') and not value.startswith('//'):return value
    url=urlsplit(value)
    local=url.hostname in ('localhost','127.0.0.1','::1') or bool(url.hostname and url.hostname.endswith('.localhost'))
    require(bool(url.hostname) and not url.username and not url.password and (url.scheme=='https' or (url.scheme=='http' and local)),'Use an HTTPS image URL or a path starting with /.')
    return value
def snapshot_sql():
    pairs=[]
    # json_group_array of row JSON avoids depending on JSON aggregation column discovery at runtime.
    for table in TABLES:
        pairs.extend([q(table),"json(COALESCE((SELECT json_group_array(json(row)) FROM (SELECT json_object("+','.join(q(c)+','+c for c in COLUMNS[table])+") AS row FROM "+table+")), '[]'))"])
    return 'SELECT json_object('+','.join(pairs)+') AS snapshot;'

COLUMNS = {
 'customer_accounts':'Id user_id name phone created updated','booking_accounts':'Id booking_ref user_id created',
 'settings':'Id key value','services':'Id name category description duration buffer price deposit_percent resource_type active color intake',
 'staff':'Id name title bio color service_ids hours active','resources':'Id name type active','blocks':'Id staff_id resource_id starts ends reason',
 'customers':'Id email name phone notes marketing created','bookings':'Id reference token_hash request_key customer_id starts ends status expires total due paid refunded currency notes intake payment_id payment_url created updated version',
 'allocations':'Id booking_ref service_id staff_id resource_id starts ends service_name price duration active','payments':'Id booking_ref external_id kind amount status created',
 'refund_requests':'Id request_key booking_ref amount status provider_id created',
 'waitlist':'Id name email phone service_id staff_id preferred_date notes status created','promos':'Id code percent ends active',
 'messages':'Id booking_ref recipient subject body due status attempts last_error dedupe','audit':'Id booking_ref action actor detail created'}
COLUMNS={k:v.split() for k,v in COLUMNS.items()}

class Engine:
    def __init__(self, snapshot, identity=None, now=None, internal=False):
        self.s=snapshot; self.user=identity or {}; self.now=int(time.time()) if now is None else int(now); self.internal=internal
        self.settings={r['key']:r['value'] for r in self.s['settings']}; self.tz=ZoneInfo(self.settings.get('timezone','Africa/Johannesburg'))
        self.sql=[]
    def admin(self):
        require(self.user.get('IsActive',True) and str(self.user.get('Role','')).lower() in ('admin','administrator','owner'),'Admin access required.')
    def customer_id(self,required=False):
        # Identity comes only from Cloudgate's tenant-validated IdP node, never request JSON.
        uid=str(self.user.get('Id') or '')
        valid=self.user.get('IsActive') is True and uid.isdigit() and int(uid)>0
        if required:require(valid,'Please sign in to your customer account.')
        return uid if valid else None
    def owns(self,b):
        uid=self.customer_id()
        return bool(uid and any(r['booking_ref']==b['reference'] and r['user_id']==uid for r in self.s['booking_accounts']))
    def account(self):
        uid=self.customer_id(True)
        saved=next((r for r in self.s['customer_accounts'] if r['user_id']==uid),{})
        profile=dict(name=saved.get('name') or ' '.join(filter(None,[self.user.get('Name'),self.user.get('Surname')])),email=self.user.get('Email',''),phone=saved.get('phone',self.user.get('PhoneNumber') or ''))
        bookings=[self.detail(b) for b in self.s['bookings'] if self.owns(b)]
        # Treatment intake and internal booking notes belong in the studio workspace.
        for b in bookings:
            for key in ('notes','intake','customer_id','payment_id','payment_url'):b.pop(key,None)
        return dict(profile=profile,bookings=sorted(bookings,key=lambda b:b['starts'],reverse=True))
    def save_profile(self,d):
        uid=self.customer_id(True);name=text(d.get('name'),120);phone=text(d.get('phone'),40)
        require(len(name)>=2,'Enter your full name.')
        record=dict(user_id=uid,name=name,phone=phone,created=self.now,updated=self.now)
        self.sql.append(insert('customer_accounts',record).rstrip(';')+' ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,phone=excluded.phone,updated=excluded.updated;')
        return dict(profile=dict(name=name,phone=phone,email=self.user.get('Email','')))
    def link_account(self,b,token):
        uid=self.customer_id(True)
        require(secrets.compare_digest(b['token_hash'],digest(token)),'Appointment not found or link expired.')
        existing=next((r for r in self.s['booking_accounts'] if r['booking_ref']==b['reference']),None)
        require(not existing or existing['user_id']==uid,'This appointment is already linked to another account.')
        if not existing:
            self.sql.append(insert('booking_accounts',dict(booking_ref=b['reference'],user_id=uid,created=self.now)))
            self.event(b['reference'],'account_linked')
        return {'ok':True}
    def event(self,ref,action,detail=''):
        self.sql.append(insert('audit',dict(booking_ref=ref,action=action,actor=self.user.get('Email') or ('system' if self.internal else 'customer'),detail=text(detail,2000),created=self.now)))
    def queue(self,b,kind,due=None):
        customer=next(c for c in self.s['customers'] if c['Id']==b['customer_id'])
        when=dt.datetime.fromtimestamp(b['starts'],self.tz).strftime('%A %d %B %Y at %H:%M')
        subject={'confirmed':'Your appointment is confirmed','reminder':'A little reminder: your appointment','cancelled':'Your appointment has been cancelled','rescheduled':'Your appointment has moved'}.get(kind,'Appointment update')
        rec=dict(booking_ref=b['reference'],recipient=customer['email'],subject=subject,body=f"Hello {customer['name']},\n\n{subject}.\n{when} ({self.tz.key})\nReference: {b['reference']}\n{self.settings.get('address','')}\n\n{self.settings.get('name','Studio')}\n{self.settings.get('phone','')}",due=due or self.now,dedupe=f"{b['reference']}:{kind}:{b.get('version',1)}")
        self.sql.append(insert('messages',rec).replace('INSERT INTO','INSERT OR IGNORE INTO',1))
    def public_settings(self): return {k:v for k,v in self.settings.items() if not k.startswith(('smtp_','_'))}
    def catalog(self):
        return dict(settings=self.public_settings(),services=[r for r in self.s['services'] if r['active']],staff=[{**r,'service_ids':json.loads(r['service_ids']),'hours':json.loads(r['hours'])} for r in self.s['staff'] if r['active']])
    def selected(self,d):
        ids=d.get('service_ids') or [d.get('service_id')]
        require(isinstance(ids,list) and 1<=len(ids)<=4,'Choose between one and four services.')
        require(len(set(ids))==len(ids),'Choose each service once.')
        result=[next((r for r in self.s['services'] if r['Id']==int(i) and r['active']),None) for i in ids]
        require(all(result),'A selected service is no longer available.')
        return result
    def allocations(self,services,staff_id,start,exclude=None):
        staff=next((r for r in self.s['staff'] if r['Id']==staff_id and r['active']),None)
        if not staff or not all(s['Id'] in json.loads(staff['service_ids']) for s in services): return None
        hours=json.loads(staff['hours']); cursor=start; result=[]
        active_refs={b['reference'] for b in self.s['bookings'] if b['reference']!=exclude and b['status'] in ('held','confirmed','arrived') and (b['status']!='held' or b['expires']>self.now)}
        def conflict(a,b): return a<b[1] and b[0]<end
        for service in services:
            end=cursor+(service['duration']+service['buffer'])*60
            local=dt.datetime.fromtimestamp(cursor,self.tz)
            windows=hours.get(str(local.weekday()),[])
            fits=False
            for opening,closing in windows:
                lo=int(dt.datetime.combine(local.date(),dt.time.fromisoformat(opening),self.tz).timestamp())
                hi=int(dt.datetime.combine(local.date(),dt.time.fromisoformat(closing),self.tz).timestamp())
                if cursor>=lo and end<=hi: fits=True
            if not fits: return None
            occupied=[r for r in self.s['allocations'] if r['active'] and r['booking_ref'] in active_refs and cursor<r['ends'] and r['starts']<end]
            blocks=[r for r in self.s['blocks'] if cursor<r['ends'] and r['starts']<end]
            if any(r['staff_id']==staff_id for r in occupied) or any((r['staff_id'] is None and r['resource_id'] is None) or r['staff_id']==staff_id for r in blocks): return None
            resource=None
            if service['resource_type']:
                candidates=[r for r in self.s['resources'] if r['active'] and r['type']==service['resource_type'] and not any(a['resource_id']==r['Id'] for a in occupied+blocks)]
                if not candidates:return None
                resource=candidates[0]['Id']
            result.append(dict(service_id=service['Id'],staff_id=staff_id,resource_id=resource,starts=cursor,ends=end,service_name=service['name'],price=service['price'],duration=service['duration']))
            cursor=end
        return result
    def availability(self,d):
        services=self.selected(d); date=dt.date.fromisoformat(d['date']); today=dt.datetime.fromtimestamp(self.now,self.tz).date()
        require(today<=date<=today+dt.timedelta(days=int(self.settings['horizon_days'])),'Choose a date inside the booking window.')
        sid=int(d.get('staff_id') or 0); slots=[]
        for minute in range(0,1440,int(self.settings['slot_minutes'])):
            local=dt.datetime.combine(date,dt.time(minute//60,minute%60),self.tz); start=int(local.timestamp())
            # Reject local times that do not exist during a daylight-saving transition.
            if dt.datetime.fromtimestamp(start,self.tz).replace(tzinfo=None)!=local.replace(tzinfo=None):continue
            if start<self.now+int(self.settings['lead_minutes'])*60: continue
            for person in self.s['staff']:
                if sid and sid!=person['Id']:continue
                parts=self.allocations(services,person['Id'],start,d.get('exclude'))
                if parts: slots.append(dict(starts=start,ends=parts[-1]['ends'],label=local.strftime('%H:%M'),staff_id=person['Id'],staff_name=person['name']))
        return dict(slots=slots,timezone=self.tz.key)
    def booking(self,d,admin=False):
        b=next((r for r in self.s['bookings'] if r['reference']==d.get('reference')),None)
        require(b,'Appointment not found.')
        if admin:self.admin()
        else:require(self.owns(b) or secrets.compare_digest(b['token_hash'],digest(d.get('token',''))),'Appointment not found or link expired.')
        return b
    def detail(self,b):
        c=next(r for r in self.s['customers'] if r['Id']==b['customer_id'])
        items=[a for a in self.s['allocations'] if a['booking_ref']==b['reference'] and a['active']]
        if not items:
            latest={}
            for a in self.s['allocations']:
                if a['booking_ref']==b['reference']:latest[a['service_id']]=a
            items=sorted(latest.values(),key=lambda a:a['starts'])
        return {**{k:v for k,v in b.items() if k not in ('token_hash','request_key')},'customer':{k:c[k] for k in ('name','email','phone')},'items':[dict(a,staff_name=next(s['name'] for s in self.s['staff'] if s['Id']==a['staff_id'])) for a in items]}
    def quote(self,d):
        services=self.selected(d)
        subtotal=sum(s['price'] for s in services)
        total=subtotal; due=sum((s['price']*s['deposit_percent']+99)//100 for s in services)
        code=text(d.get('promo'),40).upper()
        if code:
            today=dt.datetime.fromtimestamp(self.now,self.tz).date().isoformat()
            promo=next((p for p in self.s['promos'] if p['active'] and p['code']==code and p['ends']>=today),None)
            require(promo,'That promotion is invalid or has expired.')
            total=total*(100-promo['percent'])//100; due=min(total,due*(100-promo['percent'])//100)
        require(due>0,'This booking requires a positive payment amount.')
        return dict(subtotal=subtotal,discount=subtotal-total,total=total,due=due,balance=total-due,currency=self.settings['currency'],promo=code)
    def hold(self,d):
        token=text(d.get('token'),128); key=text(d.get('request_key'),128)
        require(len(token)>=32 and len(key)>=16,'A secure checkout session is required.')
        existing=next((b for b in self.s['bookings'] if b['request_key']==key),None)
        if existing:
            require(existing['token_hash']==digest(token),'Checkout session mismatch.')
            if d.get('op')!='admin-hold' and self.customer_id():self.link_account(existing,token)
            return self.detail(existing)
        services=self.selected(d); start=integer(d.get('starts'),self.now,self.now+int(self.settings['horizon_days'])*86400,'Time')
        require(start>=self.now+int(self.settings['lead_minutes'])*60,'This slot is too soon to book.')
        require(d.get('consent') is True,'Please accept the booking and cancellation policy.')
        name=text(d.get('name'),120); mail=email(d.get('email')); require(len(name)>=2,'Enter your full name.')
        parts=self.allocations(services,int(d.get('staff_id') or 0),start)
        require(parts,'That time is no longer available. Please choose another slot.')
        quote=self.quote(d); total=quote['total']; due=quote['due']
        if d.get('quote') is not None:
            require(isinstance(d['quote'],dict) and all(d['quote'].get(k)==quote[k] for k in ('total','due','currency','promo')),'The price has changed. Refresh the quote and review it before paying.')
        ref='ST-'+secrets.token_hex(5).upper(); cid=next((c['Id'] for c in self.s['customers'] if c['email']==mail),None)
        self.sql.append("INSERT INTO customers(email,name,phone,marketing,created) VALUES ("+','.join(map(q,[mail,name,text(d.get('phone'),40),int(bool(d.get('marketing'))),self.now]))+") ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone;")
        customer_expr='(SELECT Id FROM customers WHERE email='+q(mail)+')'
        b=dict(reference=ref,token_hash=digest(token),request_key=key,customer_id=0,starts=start,ends=parts[-1]['ends'],status='held',expires=self.now+int(self.settings['hold_minutes'])*60,total=total,due=due,currency=self.settings['currency'],notes=text(d.get('notes'),2000),intake=encoded(d.get('intake') or {}),created=self.now,updated=self.now)
        stmt=insert('bookings',b); columns=list(b); vals=[customer_expr if k=='customer_id' else q(v) for k,v in b.items()]
        self.sql.append('INSERT INTO bookings ('+','.join(columns)+') VALUES ('+','.join(vals)+');')
        if d.get('op')!='admin-hold' and self.customer_id():
            self.sql.append(insert('booking_accounts',dict(booking_ref=ref,user_id=self.customer_id(),created=self.now)))
        for part in parts:self.sql.append(insert('allocations',dict(booking_ref=ref,**part)))
        base=self.settings.get('website_url','').rstrip('/')
        access=f"Hello {name},\n\nYour appointment reference is {ref}. Keep this private access link to manage your visit:\n{base}/appointments?ref={ref}#token={token}\n\n{self.settings.get('name','Studio')}"
        self.sql.append(insert('messages',dict(booking_ref=ref,recipient=mail,subject='Your private appointment access link',body=access,due=self.now,status='awaiting_payment',dedupe=ref+':access')))
        self.event(ref,'held','Policy accepted; quote '+str(total)+' '+b['currency'])
        return dict(reference=ref,status='held',starts=start,ends=b['ends'],expires=b['expires'],total=total,due=due,paid=0,currency=b['currency'],customer=dict(name=name,email=mail),items=parts)
    def expire(self):
        self.sql += ["UPDATE allocations SET active=0 WHERE booking_ref IN (SELECT reference FROM bookings WHERE status='held' AND expires<="+str(self.now)+");", "UPDATE bookings SET status='expired',updated="+str(self.now)+" WHERE status='held' AND expires<="+str(self.now)+";"]
    def payment(self,d):
        require(self.internal,'Payment results must be verified by the payment provider.')
        b=next((r for r in self.s['bookings'] if r['reference']==d.get('reference')),None); require(b,'Appointment not found.')
        provider=d.get('provider') or {}; ext=str(provider.get('Id') or provider.get('id') or '')
        require(ext and str(b.get('payment_id'))==ext,'Payment does not match this appointment.')
        status_code=int(provider.get('Status',-1))
        if status_code!=1:
            if status_code in (2,3) and b['status']=='held':
                self.sql.append(update('bookings',dict(status='expired',updated=self.now),'reference='+q(b['reference'])))
                self.sql.append(update('allocations',dict(active=0),'booking_ref='+q(b['reference'])))
                self.sql.append(insert('payments',dict(booking_ref=b['reference'],external_id=ext,kind='payment',amount=b['due'],status='failed',created=self.now)).replace('INSERT INTO','INSERT OR IGNORE INTO',1))
                return {'status':'expired','reference':b['reference']}
            self.sql.append(update('bookings',dict(updated=self.now),'reference='+q(b['reference'])))
            return {'status':b['status'],'reference':b['reference']}
        # Cloudgate Wallet GrossAmount and Amount are integer minor units.
        amount=integer(d.get('amount'),1,1000000000,'Payment amount')
        require(amount==b['due'] and d.get('currency')==b['currency'],'Payment amount or currency does not match.')
        if any(p['external_id']==ext and p['status']=='succeeded' for p in self.s['payments']):return self.detail(b)
        self.sql.append(insert('payments',dict(booking_ref=b['reference'],external_id=ext,kind='payment',amount=amount,status='succeeded',created=self.now)).replace('INSERT INTO','INSERT OR IGNORE INTO',1))
        valid=b['status']=='held' and b['expires']>self.now
        status='confirmed' if valid else 'payment_review'
        self.sql.append("UPDATE bookings SET paid=paid+"+str(amount)+",status="+q(status)+",updated="+str(self.now)+",version=version+1 WHERE reference="+q(b['reference'])+" AND changes()=1;")
        if not valid:self.sql.append(update('allocations',{'active':0},'booking_ref='+q(b['reference'])))
        if valid:
            self.sql.append(update('messages',dict(status='queued'),"booking_ref="+q(b['reference'])+" AND status='awaiting_payment'"))
            self.queue(b,'confirmed'); self.queue(b,'reminder',max(self.now,b['starts']-int(self.settings['reminder_hours'])*3600))
        self.event(b['reference'],'payment_verified',status)
        return dict(reference=b['reference'],status=status,paid=amount)
    def cancel(self,d,admin=False):
        b=self.booking(d,admin); require(b['status'] in ('held','confirmed'),'This appointment cannot be cancelled.')
        if not admin:require(b['status']=='held' or b['starts']-self.now>=int(self.settings['cancel_hours'])*3600,'The online cancellation window has closed. Please contact the studio.')
        self.sql.append(update('bookings',dict(status='cancelled',updated=self.now,version=b['version']+1),'reference='+q(b['reference'])+' AND version='+str(b['version'])))
        self.sql.append(update('allocations',dict(active=0),'booking_ref='+q(b['reference'])))
        self.sql.append("UPDATE messages SET status='cancelled' WHERE booking_ref="+q(b['reference'])+" AND status='queued';")
        if b['paid']:self.queue(b,'cancelled')
        self.event(b['reference'],'cancelled',text(d.get('reason')))
        return dict(status='cancelled',refund_pending=b['paid']>b['refunded'])
    def reschedule(self,d,admin=False):
        b=self.booking(d,admin); require(b['status']=='confirmed','Only confirmed appointments can be rescheduled.')
        if not admin:require(b['starts']-self.now>=int(self.settings['cancel_hours'])*3600,'The online rescheduling window has closed.')
        old=[a for a in self.s['allocations'] if a['booking_ref']==b['reference'] and a['active']]
        services=[next(s for s in self.s['services'] if s['Id']==a['service_id']) for a in old]
        start=integer(d['starts'],self.now+int(self.settings['lead_minutes'])*60,self.now+int(self.settings['horizon_days'])*86400,'Time')
        parts=self.allocations(services,int(d['staff_id']),start,b['reference']); require(parts,'That time is no longer available.')
        self.sql.append(update('allocations',dict(active=0),'booking_ref='+q(b['reference'])))
        for a in parts:self.sql.append(insert('allocations',dict(booking_ref=b['reference'],**a)))
        changed={**b,'starts':start,'ends':parts[-1]['ends'],'version':b['version']+1}
        self.sql.append(update('bookings',{k:changed[k] for k in ('starts','ends','version')},'reference='+q(b['reference'])))
        self.sql.append("UPDATE messages SET status='cancelled' WHERE booking_ref="+q(b['reference'])+" AND status='queued';")
        self.queue(changed,'rescheduled');self.queue(changed,'reminder',max(self.now,start-int(self.settings['reminder_hours'])*3600));self.event(b['reference'],'rescheduled')
        return {'status':'confirmed','starts':start}
    def admin_data(self):
        self.admin(); data={k:v for k,v in self.s.items() if k!='settings'}
        data['bookings']=[self.detail(b) for b in self.s['bookings']]
        data['settings']={k:v for k,v in self.settings.items() if k!='smtp_password' and not k.startswith('_')};data['settings']['smtp_password_configured']=bool(self.settings.get('smtp_password'))
        return data
    def save(self,d):
        self.admin(); entity=d.get('entity'); rec=d.get('record') or {}
        allowed={'services':('name','category','description','duration','buffer','price','deposit_percent','resource_type','active','color','intake'),'staff':('name','title','bio','color','service_ids','hours','active'),'resources':('name','type','active'),'promos':('code','percent','ends','active'),'customers':('name','phone','notes','marketing')}
        require(entity in allowed,'Unknown record type.'); row={k:rec[k] for k in allowed[entity] if k in rec}
        if 'name' in row:require(len(text(row['name']))>=2,'Name is required.');row['name']=text(row['name'],120)
        for k,lo,hi in [('duration',5,480),('buffer',0,120),('price',0,100000000),('deposit_percent',1,100),('percent',1,99)]:
            if k in row:row[k]=integer(row[k],lo,hi,k)
        if entity=='staff':
            for key in ('service_ids','hours'):
                if key in row:
                    val=json.loads(row[key]) if isinstance(row[key],str) else row[key]
                    if key=='service_ids':require(isinstance(val,list) and all(any(s['Id']==i for s in self.s['services']) for i in val),'Choose valid services.')
                    else:
                        require(isinstance(val,dict),'Hours must be a weekly schedule.')
                        for day,windows in val.items():
                            integer(day,0,6,'Weekday');require(isinstance(windows,list),'Invalid hours.')
                            for lo,hi in windows: require(dt.time.fromisoformat(lo)<dt.time.fromisoformat(hi),'Closing time must follow opening time.')
                    row[key]=encoded(val)
        if entity=='promos':
            if 'code' in row:row['code']=text(row['code'],40).upper();require(bool(row['code']),'Code is required.')
            if 'ends' in row:dt.date.fromisoformat(row['ends'])
        require(row,'No changes supplied.')
        if rec.get('Id'):
            ident=integer(rec['Id'],1,2**31-1,'Record');require(any(r['Id']==ident for r in self.s[entity]),'Record not found.')
            self.sql.append(update(entity,row,'Id='+str(ident)))
        else:require(entity!='customers','Customers are created through bookings.');self.sql.append(insert(entity,row))
        self.event(None,'save_'+entity)
        return {'ok':True}
    def dispatch(self,d):
        op=d.get('op','catalog')
        if op=='catalog':return self.catalog()
        if op=='availability':return self.availability(d)
        if op=='quote':return self.quote(d)
        if op=='account':return self.account()
        if op=='account-profile':return self.save_profile(d)
        if op=='account-link':return self.link_account(self.booking(d),d.get('token',''))
        if op=='admin-hold':
            self.admin()
            result=self.hold(d)
            if not any(b['request_key']==d.get('request_key') for b in self.s['bookings']):
                self.event(result['reference'],'front_desk_booking','Client policy agreement recorded by studio team; payment required to confirm.')
            return result
        if op=='admin-abandon-hold':
            self.admin(); key=text(d.get('request_key'),128)
            require(len(key)>=16,'A checkout request is required.')
            b=next((b for b in self.s['bookings'] if b['request_key']==key),None)
            if b and b['status'] not in ('held','cancelled','expired'):
                raise ValueError('This appointment has a payment or is confirmed. Manage it from Appointments.')
            self.sql.append(insert('abandoned_booking_requests',dict(request_key=key,created=self.now)).replace('INSERT INTO','INSERT OR IGNORE INTO',1))
            if b and b['status']=='held':self.cancel(dict(reference=b['reference']),True)
            self.event(b['reference'] if b else None,'front_desk_request_released')
            return {'ok':True}
        if op=='hold':return self.hold(d)
        if op=='get':return self.detail(self.booking(d))
        if op=='cancel':return self.cancel(d)
        if op=='reschedule':return self.reschedule(d)
        if op=='payment-apply':return self.payment(d)
        if op=='payment-save':
            require(self.internal,'Internal operation.');b=next((b for b in self.s['bookings'] if b['reference']==d.get('reference')),None);require(b,'Appointment not found.')
            require(b['status']=='held' and b['expires']>self.now,'Checkout hold has expired.')
            require(not b['payment_id'] or b['payment_id']==str(d['payment_id']),'A payment session already exists.')
            self.sql.append(update('bookings',dict(payment_id=str(d['payment_id']),payment_url=str(d['payment_url'])),'reference='+q(b['reference'])))
            return dict(payment_url=d['payment_url'],reference=b['reference'])
        if op=='refund-apply':
            require(self.internal,'Refund results must be verified by the payment provider.')
            b=next((b for b in self.s['bookings'] if b['reference']==d.get('reference')),None);require(b,'Appointment not found.')
            request=next((r for r in self.s['refund_requests'] if r['request_key']==d.get('request_key') and r['booking_ref']==b['reference']),None)
            require(request,'Refund request not found.')
            provider=d.get('provider') or {}
            require(str(provider.get('PaymentId'))==str(b['payment_id']) and provider.get('Amount')==request['amount'] and str(provider.get('Currency','')).upper()==b['currency'],'The Wallet refund does not match this booking and amount.')
            require(provider.get('IdempotencyKey')=='booking-refund-'+request['request_key'],'The Wallet refund request key does not match.')
            status=provider.get('Status');require(status in ('submitting','pending','succeeded','failed','reconciliation_required'),'Unknown refund status.')
            if request['status'] in ('succeeded','failed'):return {'ok':True,'status':request['status']}
            refund_id=str(provider.get('RefundId') or '')
            if request.get('provider_id'):require(request['provider_id']==refund_id,'The Wallet refund ID changed.')
            if status!='succeeded':
                self.sql.append(update('refund_requests',dict(status=status,provider_id=refund_id or None),'Id='+str(request['Id'])))
                self.event(b['reference'],'refund_'+status);return {'ok':True,'status':status}
            require(refund_id,'Refund reference required.')
            external='refund-'+refund_id
            require(not any(p['external_id']==external for p in self.s['payments']),'This provider refund belongs to another request.')
            d['amount']=provider['Amount']
            amount=integer(d['amount'],1,b['paid']-b['refunded'],'Refund amount')
            self.sql.append(insert('payments',dict(booking_ref=b['reference'],external_id=external,kind='refund',amount=amount,status='succeeded',created=self.now)))
            self.sql.append('UPDATE bookings SET refunded=refunded+'+str(amount)+' WHERE reference='+q(b['reference'])+';')
            self.sql.append(update('refund_requests',dict(status='succeeded',provider_id=refund_id),'Id='+str(request['Id'])))
            self.event(b['reference'],'refund_verified',str(amount));return {'ok':True,'status':'succeeded'}
        if op=='refund-claim':
            require(self.internal,'Internal operation.');b=self.booking(d,True)
            key=text(d.get('request_key'),128);require(len(key)>=16,'Refund request key required.')
            existing=next((r for r in self.s['refund_requests'] if r['request_key']==key),None)
            if existing:
                require(existing['booking_ref']==b['reference'] and existing['amount']==d.get('amount'),'This refund request key was used with different parameters.')
                return {'claimed':True,'status':existing['status']}
            amount=integer(d['amount'],1,b['paid']-b['refunded'],'Refund amount')
            require(not any(r['booking_ref']==b['reference'] and r['status'] not in ('succeeded','failed') for r in self.s['refund_requests']),'A refund is already pending verification.')
            self.sql.append(insert('refund_requests',dict(booking_ref=b['reference'],request_key=key,amount=amount,created=self.now)))
            return {'claimed':True}
        if op=='waitlist':
            service=integer(d['service_id'],1,2**31-1);require(any(s['Id']==service and s['active'] for s in self.s['services']),'Service not found.')
            date=dt.date.fromisoformat(d['preferred_date']);require(date>=dt.datetime.fromtimestamp(self.now,self.tz).date(),'Choose a future date.')
            name=text(d.get('name'),120);require(len(name)>=2,'Name is required.')
            self.sql.append(insert('waitlist',dict(name=name,email=email(d['email']),phone=text(d.get('phone'),40),service_id=service,staff_id=d.get('staff_id') or None,preferred_date=date.isoformat(),notes=text(d.get('notes')),created=self.now)))
            return {'ok':True}
        if op=='admin-data':return self.admin_data()
        if op=='admin-save':return self.save(d)
        if op=='admin-cancel':return self.cancel(d,True)
        if op=='admin-reschedule':return self.reschedule(d,True)
        if op=='admin-status':
            b=self.booking(d,True);status=d['status']; transitions={'confirmed':['arrived','no_show'],'arrived':['completed','no_show']}
            require(status in transitions.get(b['status'],[]),'Invalid appointment status change.')
            if status=='completed':require(b['paid']>=b['total'],'Collect the outstanding balance before completing.')
            self.sql.append(update('bookings',dict(status=status,updated=self.now),'reference='+q(b['reference'])))
            if status in ('completed','no_show'):
                self.sql.append(update('allocations',dict(active=0),'booking_ref='+q(b['reference'])))
                self.sql.append("UPDATE messages SET status='cancelled' WHERE booking_ref="+q(b['reference'])+" AND status='queued' AND dedupe LIKE "+q(b['reference']+':reminder:%')+';')
            self.event(b['reference'],status);return {'ok':True}
        if op=='admin-cash':
            b=self.booking(d,True);require(b['status'] in ('confirmed','arrived'),'This appointment cannot accept a balance payment.')
            key=text(d.get('request_key'),128);require(len(key)>=16,'Payment request key required.')
            if any(p['external_id']=='cash-'+key for p in self.s['payments']):return {'ok':True}
            amount=integer(d['amount'],1,b['total']-b['paid'],'Amount')
            self.sql.append(insert('payments',dict(booking_ref=b['reference'],external_id='cash-'+key,kind='cash',amount=amount,status='succeeded',created=self.now)))
            self.sql.append('UPDATE bookings SET paid=paid+'+str(amount)+' WHERE reference='+q(b['reference'])+' AND paid+'+str(amount)+'<=total;');self.event(b['reference'],'cash_received',str(amount));return {'ok':True}
        if op=='admin-block':
            self.admin();start=integer(d['starts'],0,2**40);end=integer(d['ends'],start+1,2**40)
            self.sql.append(insert('blocks',dict(starts=start,ends=end,staff_id=d.get('staff_id') or None,resource_id=d.get('resource_id') or None,reason=text(d.get('reason'),200))));self.event(None,'time_blocked');return {'ok':True}
        if op=='admin-unblock':
            self.admin();self.sql.append('DELETE FROM blocks WHERE Id='+str(integer(d['Id'],1,2**31-1))+';');return {'ok':True}
        if op=='admin-waitlist':
            self.admin();require(d['status'] in ('waiting','contacted','booked','closed'),'Invalid status.')
            self.sql.append(update('waitlist',dict(status=d['status']),'Id='+str(integer(d['Id'],1,2**31-1))));return {'ok':True}
        if op=='admin-settings':
            self.admin()
            for key,value in (d.get('settings') or {}).items():
                if key not in self.settings or key.startswith('_'):continue
                if key=='smtp_password' and not value:continue
                if key in ('logo_url','icon_url','favicon_url'):value=brand_asset(value)
                if key in ('theme_primary','theme_accent','theme_background'):
                    require(isinstance(value,str) and re.fullmatch(r'#[0-9a-fA-F]{6}',value),'Choose a valid six-digit theme colour.')
                if key in ('app_name','app_short_name','name'):
                    value=str(value or '').strip();require(len(value)<=(30 if key=='app_short_name' else 120),'The name is too long.')
                    if key=='name':require(bool(value),'Business name is required.')
                if key=='logo_show_name':require(str(value) in ('0','1'),'Choose whether to show the app name.')
                if key=='timezone':ZoneInfo(value)
                if key=='currency':require(re.fullmatch('[A-Z]{3}',value),'Use a three-letter currency.')
                bounds={'lead_minutes':(0,10080),'horizon_days':(1,365),'cancel_hours':(0,720),'hold_minutes':(2,30),'slot_minutes':(5,60),'reminder_hours':(1,168),'smtp_port':(1,65535)}
                if key in bounds:integer(value,*bounds[key],key)
                if key=='smtp_mode':require(value in ('starttls','ssl'),'Use STARTTLS or SSL.')
                if key=='website_url':require(not value or re.fullmatch(r'https://[^\s]+',value),'Use an HTTPS website URL.')
                self.sql.append(update('settings',dict(value=text(value,3000)),'key='+q(key)))
            self.event(None,'settings_updated');return {'ok':True}
        if op=='maintenance':
            require(self.internal,'Internal operation.');self.expire();return {'ok':True}
        raise ValueError('Unknown operation.')

def plan(snapshot, request, identity=None, now=None, internal=False):
    engine=Engine(snapshot,identity,now,internal);result=engine.dispatch(request)
    guards=[]
    if engine.sql:
        guards=[insert('write_guard',dict(expected=engine.settings.get('_revision','0'))),"UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='_revision';",'DELETE FROM write_guard;']
    sql='BEGIN IMMEDIATE;\n'+'\n'.join(guards+engine.sql)+'\nCOMMIT;\nSELECT '+q(encoded(result))+' AS payload;'
    return sql,result

b=obj('Prepare')
p=obj('WalletGet',{})
sql,result=plan(snapshot('AfterWallet'),dict(op='payment-apply',reference=b['reference'],provider=p,amount=p.get('GrossAmount'),currency=str(p.get('Currency','')).upper()),internal=True)
return sql