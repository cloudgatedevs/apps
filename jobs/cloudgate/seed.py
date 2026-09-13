"""Deterministic fictional sandbox records. Never applied to production."""
import json
from pathlib import Path
from engine import encoded,q
NOW=1789034400
def seed_sql(local=False):
    rows=[]
    def add(kind,ref,**v):
        r=dict(kind=kind,ref=ref,owner='',job='',created=NOW,updated=NOW,version=1);r.update(v);rows.append(r);return r
    for ref,name,desc,category,price in [('SER-PLUMBING','Plumbing & repairs','Leaks, fittings and everyday repairs, handled with care.','Repairs',65000),('SER-ELECTRICAL','Electrical services','Lighting, fault finding and safe installations.','Installation',85000),('SER-CLEANING','Home & office cleaning','A fresh start for the spaces you use every day.','Maintenance',45000),('SER-MAINTENANCE','Property maintenance','Keep your property working as it should.','Maintenance',55000)]:add('service',ref,name=name,description=desc,category=category,price=price,active=True,image_url='')
    for ref,name,title,uid in [('TEAM-MAYA','Maya Daniels','Lead technician','3'),('TEAM-LEO','Leo Martins','Field technician','4'),('TEAM-AMINA','Amina Patel','Service specialist','5')]:add('team',ref,name=name,title=title,user_id=uid,role='technician',active=True,image_url='')
    add('customer','CUS-SAMPLE',name='Jordan Williams',email='jordan@example.invalid',phone='082 555 0142',**{'owner':'2'})
    add('address','ADR-HOME',customer='CUS-SAMPLE',label='Home',address='18 Oak Avenue, Parkhurst',instructions='Please use the side gate.',**{'owner':'2'})
    for ref,title,address,status in [('REQ-KITCHEN','Kitchen tap replacement','18 Oak Avenue, Parkhurst','new'),('REQ-LIGHTS','Install pendant lights','18 Oak Avenue, Parkhurst','reviewing'),('REQ-GARDEN','Garden cottage refresh','18 Oak Avenue, Parkhurst','new')]:add('request',ref,title=title,address=address,description='Please provide a quote and let me know your next available date.',customer='CUS-SAMPLE',status=status,request_key=ref,**{'owner':'2'})
    if not local:
        for r in rows:
            if r['owner']:r['owner']='sandbox-demo-customer'
            if 'user_id' in r:r['user_id']=''
    return '\n'.join('INSERT OR IGNORE INTO entities(kind,ref,owner,job,version,data) VALUES('+','.join([q(r['kind']),q(r['ref']),q(r['owner']),q(r['job']),'1',q(encoded(r))])+');' for r in rows)
if __name__=='__main__':Path(__file__).with_name('seed.sql').write_text(seed_sql(),encoding='utf8')
