"""Sandbox-only sample events, relative to installation date."""
import time
from engine import Engine,q,encoded

def seed_sql(include_staff=False):
    now=int(time.time());e=Engine({},dict(Id='1',Role='Admin',IsActive=True,Name='Alex Morgan',Email='alex@example.invalid'),now=now)
    samples=[('After Hours / Live','Music','The Glasshouse','An intimate evening of live sets, unexpected collaborations and very good company.','/event-music.svg',3500,2,180),('Ideas in the Open','Talks','Foundry Studio','Meet the people making what comes next. A day of fresh ideas, honest conversations and new connections.','/event-talks.svg',7900,14,120),('Sunday Table','Food & culture','The Courtyard','Slow food. Long conversations. A neighbourhood gathering around one very generous table.','/event-food.svg',0,21,60)]
    for title,category,venue,summary,image,price,days,capacity in samples:
        r=e.dispatch(dict(op='event-save',title=title,summary=summary,description=summary+'\n\nDoors open 30 minutes before the start. Bring your ticket QR code and arrive with enough time to settle in. Our hosts will be there to welcome you.\n\nThis is a sample event for exploring the app.',category=category,venue=venue,address='12 Market Lane, Creative Quarter',starts=now+days*86400,ends=now+days*86400+14400,capacity=capacity,currency='USD',image_url=image,organiser='Cloudgate Events',refund_policy='Contact the organiser to request a refund before the event. Approved paid bookings receive a full refund.',accessibility='Step-free entrance available. Contact the organiser for accessibility requirements.'))
        e.dispatch(dict(op='tier-save',event=r['ref'],name='General admission',description='Your place in the room.',price=price,capacity=capacity,sale_end=r['starts'],max_per_order=6))
        if price:e.dispatch(dict(op='tier-save',event=r['ref'],name='Supporter',description='Admission plus a little extra support for the organisers.',price=price+2000,capacity=30,sale_end=r['starts'],max_per_order=4))
        e.dispatch(dict(op='event-publish',ref=r['ref'],version=r['version']))
    if include_staff:e.dispatch(dict(op='staff-save',name='Alex at the door',user_id='3',events=[r['ref'] for r in e.all('event')],active=True))
    return '\n'.join('INSERT OR IGNORE INTO entities(kind,ref,owner,version,data) VALUES('+','.join([q(r['kind']),q(r['ref']),q(r['owner']),str(r['version']),q(encoded(r))])+');' for r in e.rows)
