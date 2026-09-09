import json
import secrets
import sqlite3
import unittest
from pathlib import Path
import test_engine as base
from engine import Engine, plan

ADMIN=base.ADMIN
ROOT=Path(__file__).parents[1]/'cloudgate'

class ServiceTests(unittest.TestCase):
    setUp=base.BookingTests.setUp
    tearDown=base.BookingTests.tearDown
    snapshot=base.BookingTests.snapshot
    run_op=base.BookingTests.run_op
    slot=base.BookingTests.slot
    hold=base.BookingTests.hold
    pay=base.BookingTests.pay

    def create(self,**changes):
        record=dict(name='Business consultation',category='Consulting',description='A focused planning session.',duration=45,buffer=0,price=55000,deposit_percent=25,resource_type='',active=1,color='#336699',image_url='https://cdn.example/consulting.png',staff_ids=[1],intake='What would you like to discuss?')
        record.update(changes)
        return self.run_op('admin-save',entity='services',record=record,_identity=ADMIN)['Id']

    def test_create_custom_service_assigns_team_photo_and_bookable_time(self):
        ident=self.create();catalog=self.run_op('catalog');service=next(s for s in catalog['services'] if s['Id']==ident)
        self.assertEqual((service['category'],service['image_url']),('Consulting','https://cdn.example/consulting.png'))
        self.assertIn(ident,next(p for p in catalog['staff'] if p['Id']==1)['service_ids'])
        self.assertNotIn(ident,next(p for p in catalog['staff'] if p['Id']==3)['service_ids'])
        slot=self.slot([ident]);b=self.hold(slot,service_ids=[ident]);self.assertEqual(b['total'],55000)
        self.assertEqual(b['due'],13750);self.assertEqual(b['items'][0]['duration'],45)

    def test_edit_remove_photo_hide_and_republish(self):
        ident=self.create()
        self.run_op('admin-save',entity='services',record=dict(Id=ident,name='Laptop diagnostics',category='Repairs',image_url='',active=0,price=30000),_identity=ADMIN)
        self.assertNotIn(ident,[s['Id'] for s in self.run_op('catalog')['services']])
        saved=next(s for s in self.run_op('admin-data',_identity=ADMIN)['services'] if s['Id']==ident)
        self.assertEqual((saved['image_url'],saved['category']),('','Repairs'))
        self.run_op('admin-save',entity='services',record=dict(Id=ident,active=1),_identity=ADMIN)
        self.assertIn(ident,[s['Id'] for s in self.run_op('catalog')['services']])

    def test_delete_preserves_paid_booking_and_snapshot_on_reschedule(self):
        b=self.hold();self.pay(b);original=b['items'][0]
        self.run_op('admin-save',entity='services',record=dict(Id=1,name='Changed service',duration=30,buffer=0,price=10000),_identity=ADMIN)
        self.run_op('admin-delete-service',Id=1,_identity=ADMIN)
        before=self.snapshot();self.run_op('admin-delete-service',Id=1,_identity=ADMIN)
        self.assertEqual(before,self.snapshot())
        self.assertNotIn(1,[s['Id'] for s in self.run_op('catalog')['services']])
        current=self.run_op('get',reference=b['reference'],token=self.token)
        self.assertEqual(current['status'],'confirmed');self.assertEqual(current['paid'],b['total'])
        self.assertEqual(current['items'][0]['service_name'],original['service_name'])
        date=base.dt.datetime.fromtimestamp(b['starts'],Engine(self.snapshot()).tz).date().isoformat()
        available=self.run_op('availability',reference=b['reference'],token=self.token,date=date)['slots']
        target=next(s for s in available if s['starts']==b['starts'] and s['staff_id']==original['staff_id'])
        self.run_op('reschedule',reference=b['reference'],token=self.token,starts=target['starts'],staff_id=target['staff_id'])
        item=self.run_op('get',reference=b['reference'],token=self.token)['items'][0]
        for key in ('service_name','price','duration','ends','starts'):self.assertEqual(item[key],original[key])

    def test_deleted_service_rejects_new_booking_and_edit(self):
        ident=self.create();slot=self.slot([ident]);self.run_op('admin-delete-service',Id=ident,_identity=ADMIN)
        with self.assertRaisesRegex(ValueError,'no longer available'):self.hold(slot,service_ids=[ident])
        with self.assertRaisesRegex(ValueError,'deleted'):self.run_op('admin-save',entity='services',record=dict(Id=ident,name='Restore by stale form'),_identity=ADMIN)
        with self.assertRaisesRegex(ValueError,'Service not found'):self.run_op('waitlist',service_id=ident,preferred_date='2099-01-01')

    def test_service_changes_require_admin_and_validate_atomically(self):
        before=self.snapshot()
        for op,data in [('admin-delete-service',dict(Id=1)),('admin-save',dict(entity='services',record=dict(Id=1,name='Intruder')))]:
            with self.assertRaisesRegex(ValueError,'Admin access'):self.run_op(op,**data)
        for change in [dict(image_url='javascript:alert(1)'),dict(image_url='data:image/png;base64,AA'),dict(price=0),dict(duration=481),dict(category=''),dict(staff_ids=[999]),dict(staff_ids=[]),dict(color='red'),dict(resource_type='missing'),dict(name='x')]:
            with self.subTest(change=change),self.assertRaises(ValueError):self.create(**change)
        self.assertEqual(before,self.snapshot())

    def test_draft_can_be_created_without_staff_then_assigned(self):
        ident=self.create(active=0,staff_ids=[])
        self.assertNotIn(ident,[s['Id'] for s in self.run_op('catalog')['services']])
        self.run_op('admin-save',entity='services',record=dict(Id=ident,active=1,staff_ids=[3]),_identity=ADMIN)
        self.assertTrue(self.slot([ident],staff_id=3))

    def test_reschedule_availability_requires_owner_or_admin(self):
        b=self.hold();self.pay(b);date=base.dt.datetime.fromtimestamp(b['starts'],Engine(self.snapshot()).tz).date().isoformat()
        for data in [dict(reference=b['reference']),dict(reference=b['reference'],admin=True)]:
            with self.assertRaises(ValueError):self.run_op('availability',date=date,**data)
        self.assertTrue(self.run_op('availability',date=date,reference=b['reference'],admin=True,_identity=ADMIN)['slots'])

    def test_concurrent_deletion_invalidates_a_prepared_hold(self):
        ident=self.create();slot=self.slot([ident])
        sql,_=plan(self.snapshot(),dict(op='hold',service_ids=[ident],starts=slot['starts'],staff_id=slot['staff_id'],name='Client',email='client@example.com',consent=True,request_key=secrets.token_hex(16),token=self.token),now=self.now)
        self.run_op('admin-delete-service',Id=ident,_identity=ADMIN)
        with self.assertRaisesRegex(sqlite3.IntegrityError,'calendar changed'):self.db.executescript(sql)
        self.db.rollback();self.assertFalse(self.snapshot()['bookings'])

    def test_migration_is_idempotent_and_keeps_service_and_business_customizations(self):
        ident=self.create();self.run_op('admin-settings',settings=dict(hero_title='Book a lesson',hero_image_url='https://cdn.example/school.png'),_identity=ADMIN)
        self.run_op('admin-delete-service',Id=ident,_identity=ADMIN)
        before=self.snapshot()
        for _ in range(2):self.db.executescript((ROOT/'migrations/1.4.0-services.sql').read_text(encoding='utf-8'))
        self.assertEqual(before,self.snapshot())

if __name__=='__main__':unittest.main()
