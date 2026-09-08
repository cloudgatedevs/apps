"""Real SQLite regression tests for the source and packaged native refund workflow.
Run: python -X utf8 cloudgate/test_refunds.py (in either template).
"""
import copy
import json
import sqlite3
import sys
import tempfile
import threading
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import refunds as engine

ROOT = Path(__file__).parent
APP = ROOT.parent.name
USER = dict(Id=91, Email='teller@example.test', Role='Admin', IsActive=True)
KEY = 'refund-regression-0001'


def execute(db, sql):
    statement, result = '', []
    for c in sql:
        statement += c
        if c == ';' and sqlite3.complete_statement(statement):
            cursor = db.execute(statement)
            if cursor.description:
                result = [dict(r) for r in cursor.fetchall()]
            statement = ''
    if statement.strip():
        raise AssertionError('Incomplete SQL: ' + statement)
    return result


def connection(path):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.row_factory = sqlite3.Row
    return db


class RefundTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'refunds.sqlite')
        self.db = connection(self.path)
        self.db.executescript((ROOT / 'schema.sql').read_text(encoding='utf-8'))
        if APP == 'shop':
            self.db.executescript("""
            INSERT INTO products(Id,Name,Slug,TrackInventory) VALUES(9001,'Test','refund-test',1);
            INSERT INTO product_variants(Id,ProductId,StockQty) VALUES(9001,9001,10);
            INSERT INTO orders(Id,Reference,Email,TotalCents,Status,PaymentStatus) VALUES(9001,'TEST-1','buyer@example.test',1000,'paid','paid');
            INSERT INTO order_items(Id,OrderId,ProductId,VariantId,Title,Qty,UnitPriceCents,LineTotalCents) VALUES(9001,9001,9001,9001,'Test',2,500,1000);
            INSERT INTO payments(Id,OrderId,ConnectPaymentId,AmountCents,Currency,Status) VALUES(9001,9001,71001,1000,'ZAR','succeeded');
            """)
        else:
            self.db.executescript("""
            INSERT INTO products(Id,Name,StockQty,TrackInventory) VALUES(9001,'Test',10,1);
            INSERT INTO shifts(Id,RegisterId,TellerUserId,Status) VALUES(9001,1,91,'open');
            INSERT INTO sales(Id,Reference,TotalCents,PaidCents,Status) VALUES(9001,'TEST-1',1000,1000,'completed');
            INSERT INTO sale_items(Id,SaleId,ProductId,Name,Qty,LineTotalCents) VALUES(9001,9001,9001,'Test',2,1000);
            INSERT INTO sale_payments(Id,SaleId,Method,ConnectPaymentId,AmountCents,Status) VALUES(9001,9001,'card',71001,1000,'succeeded');
            """)
        self.data = dict(op='refund', id=9001, requestKey=KEY, reason="Customer's return", method='card')
        self.data.update(dict(amountCents=500, restock=True) if APP == 'shop' else dict(items=[dict(saleItemId=9001, qty=1)]))

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def loaded(self, data=None):
        return execute(self.db, engine.read_sql(APP, data or self.data, USER))

    def claim(self, data=None, loaded=None):
        data = data or self.data
        return execute(self.db, engine.claim_sql(APP, data, USER, loaded or self.loaded(data)))[0]

    def provider(self, row, status='succeeded', **patch):
        return dict(IdempotencyKey=APP + '-refund-' + row['RequestKey'], PaymentId=row['PaymentId'],
                    Amount=row['AmountCents'], Currency='zar', RefundId='re_test_123', Status=status, **patch)

    def apply(self, row, status='succeeded'):
        return execute(self.db, engine.apply_sql(APP, row, self.provider(row, status)))[0]

    def money(self):
        return self.db.execute('SELECT RefundedCents FROM ' + ('payments' if APP == 'shop' else 'sales') + ' WHERE Id=9001').fetchone()[0]

    def stock(self):
        return self.db.execute('SELECT StockQty FROM ' + ('product_variants' if APP == 'shop' else 'products') + ' WHERE Id=9001').fetchone()[0]

    def test_pending_and_uncertain_do_not_change_money_or_stock(self):
        r = self.claim()
        for status in ['pending', 'reconciliation_required', 'submitting']:
            r = self.apply(r, status)
            self.assertEqual(self.money(), 0)
            self.assertEqual(self.stock(), 10)

    def test_repeat_success_applies_once_even_with_stale_snapshot(self):
        r = self.claim()
        sql = engine.apply_sql(APP, r, self.provider(r))
        execute(self.db, sql)
        execute(self.db, sql)
        self.assertEqual(self.money(), 500)
        self.assertEqual(self.stock(), 12 if APP == 'shop' else 11)
        events = 'order_events' if APP == 'shop' else 'sale_events'
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM " + events + " WHERE Type='refund'").fetchone()[0], 1)
        self.assertEqual(self.claim()['Status'], 'succeeded')

    def test_failed_never_applies_or_retries_under_same_key(self):
        r = self.apply(self.claim(), 'failed')
        self.assertEqual(self.money(), 0)
        self.assertEqual(self.stock(), 10)
        self.assertEqual(self.claim()['Status'], 'failed')

    def test_new_key_blocked_until_original_resolved(self):
        self.claim()
        with self.assertRaises(sqlite3.IntegrityError):
            self.claim(dict(self.data, requestKey='different-request-0002'))
        self.db.rollback()
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM refund_requests').fetchone()[0], 1)

    def test_changed_request_details_rejected(self):
        self.claim()
        with self.assertRaisesRegex(Exception, 'different request'):
            self.claim(dict(self.data, reason='changed reason'))

    def test_missing_key_and_invalid_quantities_rejected(self):
        with self.assertRaisesRegex(Exception, 'requestKey'):
            self.claim(dict(self.data, requestKey=''))
        invalid = dict(self.data, amountCents=1.5) if APP == 'shop' else dict(self.data, items=[dict(saleItemId=9001,qty='NaN')])
        with self.assertRaises(Exception):
            self.claim(invalid)

    def test_wallet_contract_validates_all_bindings(self):
        r = self.claim()
        for key, value in [('Amount', 501), ('PaymentId', 2), ('Currency', 'USD'), ('IdempotencyKey', 'wrong'), ('RefundId', None), ('Status', 'unknown')]:
            p = self.provider(r);p[key] = value
            with self.subTest(field=key), self.assertRaises(Exception):
                engine.apply_sql(APP, r, p)
        self.assertEqual(self.money(), 0)

    def test_provider_reference_is_text_and_cannot_change(self):
        r = self.apply(self.claim(), 'pending')
        p = self.provider(r);p['RefundId'] = 'different'
        with self.assertRaisesRegex(Exception, 'reference changed'):
            engine.apply_sql(APP, r, p)
        r = self.apply(r)
        self.assertEqual(r['ProviderRefundId'], 're_test_123')
        if APP == 'pos':
            self.assertEqual(self.db.execute('SELECT ConnectRefundId FROM refunds').fetchone()[0], 're_test_123')

    def test_stale_claim_after_another_success_cannot_overrefund(self):
        snapshot = self.loaded()
        stale = engine.claim_sql(APP, dict(self.data, requestKey='stale-request-0002'), USER, snapshot)
        self.apply(self.claim())
        with self.assertRaisesRegex(sqlite3.IntegrityError, 'balance changed'):
            execute(self.db, stale)
        self.assertEqual(self.money(), 500)

    def test_concurrent_claims_reserve_only_once(self):
        snapshot = self.loaded()
        sqls = [engine.claim_sql(APP, dict(self.data, requestKey='parallel-request-' + str(n)), USER, snapshot) for n in range(2)]
        barrier = threading.Barrier(2)
        def run(sql):
            db = connection(self.path)
            try:
                barrier.wait()
                execute(db, sql)
                return 'claimed'
            except sqlite3.IntegrityError:
                return 'blocked'
            finally:
                db.close()
        with ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(run, sqls)), ['claimed', 'blocked'])

    def test_concurrent_same_key_returns_one_request(self):
        snapshot = self.loaded()
        sql = engine.claim_sql(APP, self.data, USER, snapshot)
        first = execute(self.db, sql)[0]
        second = execute(self.db, sql)[0]
        self.assertEqual(first['Id'], second['Id'])

    def test_discard_unsent_prevents_delayed_submission(self):
        original = engine.claim_sql(APP, self.data, USER, self.loaded())
        r = self.claim(dict(self.data, op='discard-unsent'))
        self.assertEqual(r['AmountCents'], 0)
        self.assertEqual(execute(self.db, original)[0]['Status'], 'failed')
        self.assertEqual(self.money(), 0)

    def test_discard_cannot_cancel_a_claim_that_already_won(self):
        discard = engine.claim_sql(APP, dict(self.data, op='discard-unsent'), USER, self.loaded())
        self.claim()
        self.assertEqual(execute(self.db, discard)[0]['Status'], 'submitting')

    def test_migration_repeat_keeps_history(self):
        self.apply(self.claim())
        self.db.executescript((ROOT/'migrations/1.1.1-refunds.sql').read_text(encoding='utf-8'))
        self.assertEqual(self.money(), 500)
        self.assertEqual(self.claim()['Status'], 'succeeded')

    def test_packaged_schema_works_with_app_store_update_splitter(self):
        import re
        self.apply(self.claim())
        # Match WebAppService.AppStoreUpdate.cs exactly; do not hide split errors.
        schema=(ROOT.parent/'.template/schema.sql').read_text(encoding='utf-8')
        for statement in re.split(r';\s*(?:\r?\n|$)',schema):
            if statement.strip():
                try:
                    self.db.execute(statement+';')
                except sqlite3.OperationalError as error:
                    # The updater explicitly treats an existing ALTER column as benign.
                    if 'duplicate column name:' not in str(error):
                        raise
        self.assertEqual(self.money(),500)
        self.assertEqual(self.claim()['Status'],'succeeded')

    def test_upgrade_from_previous_schema_creates_complete_triggers(self):
        import re
        old=connection(':memory:')
        try:
            old.executescript((ROOT/'schema.sql').read_text(encoding='utf-8').split('-- @durable-refunds')[0])
            migration=(ROOT.parent/'.template/schema.sql').read_text(encoding='utf-8').split('-- @durable-refunds')[1]
            for statement in re.split(r';\s*(?:\r?\n|$)',migration):
                if statement.strip(): old.execute(statement+';')
            self.assertEqual(old.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'refund_%'").fetchone()[0],3)
        finally:
            old.close()

    @unittest.skipUnless(APP == 'shop', 'Shop')
    def test_delayed_payment_poll_cannot_undo_a_refund(self):
        self.apply(self.claim())
        lib=(ROOT/'workflows/_shared/lib.py').read_text(encoding='utf-8')
        script=(ROOT/'workflows/payment-status/apply.py').read_text(encoding='utf-8')
        for status in (1,2,3):
            code=lib+'\n'+script.replace('${LoadOrder}',json.dumps([{'Id':9001,'PaymentRowId':9001,'Reference':'TEST-1'}])).replace('${WalletGet}',json.dumps({'Status':status}))
            scope={}
            exec('def main():\n'+'\n'.join('    '+ln for ln in code.splitlines()),scope)
            execute(self.db,scope['main']())
            self.assertEqual(self.money(),500)
            self.assertEqual(self.stock(),12)
            self.assertEqual(self.db.execute('SELECT Status FROM payments WHERE Id=9001').fetchone()[0],'partially_refunded')

    def test_status_lookup_cannot_create_request(self):
        with self.assertRaisesRegex(Exception, 'not found'):
            self.claim(dict(self.data, op='refund-status'))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM refund_requests').fetchone()[0], 0)

    def test_authorization(self):
        for user in [{}, dict(USER,IsActive=False), *([dict(USER,Role='User')] if APP=='shop' else [])]:
            with self.assertRaises(Exception):
                engine.read_sql(APP,self.data,user)

    @unittest.skipUnless(APP == 'shop', 'Shop')
    def test_second_partial_refund_does_not_restock_order_twice(self):
        self.apply(self.claim())
        r = self.claim(dict(self.data,requestKey='second-refund-0002'))
        p = self.provider(r);p['RefundId']='re_second'
        execute(self.db,engine.apply_sql(APP,r,p))
        self.assertEqual(self.money(),1000)
        self.assertEqual(self.stock(),12)

    @unittest.skipUnless(APP == 'shop', 'Shop')
    def test_full_refund_replay_retains_original_amount(self):
        data=dict(self.data,amountCents=None)
        self.apply(self.claim(data))
        self.assertEqual(self.claim(data)['AmountCents'],1000)

    @unittest.skipUnless(APP == 'pos', 'POS')
    def test_cash_refund_and_shift_are_atomic(self):
        self.db.execute("UPDATE sale_payments SET Method='cash',ConnectPaymentId=NULL")
        data=dict(self.data,method='cash')
        r=self.claim(data)
        self.assertEqual(r['Status'],'succeeded')
        self.assertEqual(self.claim(data)['Id'],r['Id'])
        self.assertEqual(self.money(),500)
        self.assertEqual(self.stock(),11)
        self.assertEqual(self.db.execute('SELECT ShiftId FROM refunds').fetchone()[0],9001)

    @unittest.skipUnless(APP == 'pos', 'POS')
    def test_closed_shift_rejects_stale_cash_plan(self):
        self.db.execute("UPDATE sale_payments SET Method='cash',ConnectPaymentId=NULL")
        data=dict(self.data,method='cash')
        sql=engine.claim_sql(APP,data,USER,self.loaded(data))
        self.db.execute("UPDATE shifts SET Status='closed'")
        with self.assertRaisesRegex(sqlite3.IntegrityError,'shift has closed'):
            execute(self.db,sql)

    @unittest.skipUnless(APP == 'pos', 'POS')
    def test_cash_cannot_refund_card_tender(self):
        with self.assertRaisesRegex(Exception,'amount paid by this method'):
            self.claim(dict(self.data,method='cash'))

    @unittest.skipUnless(APP == 'pos', 'POS')
    def test_discount_is_prorated_and_fractional_returns_conserve_cents(self):
        self.db.execute('UPDATE sales SET TotalCents=999')
        for n in range(4):
            d=dict(self.data,requestKey='fractional-refund-'+str(n),items=[dict(saleItemId=9001,qty=.5)])
            r=self.claim(d);p=self.provider(r);p['RefundId']='re_fraction_'+str(n)
            execute(self.db,engine.apply_sql(APP,r,p))
        self.assertEqual(self.money(),999)
        self.assertEqual(self.stock(),12)

    def test_packaged_native_flow_pending_status_and_retry(self):
        bundle=json.loads((ROOT.parent/'.template/workflow-template.json').read_text(encoding='utf-8'))['Projects'][0]['Template']
        endpoint=next(e for e in bundle['Endpoints'] if e['Route']=='refunds')
        nodes={n['Id']:n for n in bundle['Nodes'] if n['EndpointId']==endpoint['Id']}
        calls=[]
        status=['pending']
        def run(data):
            values={'body':json.dumps(data),'IdpAuth':json.dumps(USER)}
            module=types.ModuleType('Web.Core.Shared.Services.Endpoints.Engine')
            module.WorkflowSessionKeyExecutionContext=types.SimpleNamespace(GetKeys=lambda sid:[types.SimpleNamespace(Key=k,Value=v) for k,v in values.items()])
            sys.modules[module.__name__]=module
            sys.modules['clr']=types.SimpleNamespace(AddReference=lambda _:None)
            def substitute(s):
                import re
                return re.sub(r'\$\{([^}]+)\}',lambda m:str(values[m[1]]),s)
            nid=endpoint['NodeId']
            for _ in range(30):
                n=nodes[nid]
                if n['NodeType']==9: result=json.dumps(USER)
                elif n['NodeType']==5: result=json.dumps(execute(self.db,substitute(n['MainScript'])))
                elif n['NodeType']==11:
                    calls.append(substitute(n['Param1']))
                    r=json.loads(values['ClaimRun'])[0]
                    self.assertEqual(substitute(n['Param9']),APP+'-refund-'+KEY)
                    result=json.dumps(self.provider(r,status[0]))
                else:
                    code=n['MainScript'].replace('${sessionid}','1')
                    scope={}
                    exec('def main():\n'+'\n'.join('    '+ln for ln in code.splitlines()),scope)
                    result=scope['main']()
                values[n['Name']]=str(result)
                nid=n.get('PositiveNodeId') if n['NodeType']==4 and result else n.get('NegativeNodeId') if n['NodeType']==4 else n.get('NodeId')
                if not nid: return json.loads(result)
            self.fail('Workflow did not terminate')
        # Quotes, newlines and placeholder-like text remain data in the Python bridge.
        data=dict(self.data,reason="Customer's ''' return\n${WalletRefund}")
        self.assertEqual(run(data)['request']['Status'],'pending')
        self.assertEqual(self.stock(),10)
        status[0]='succeeded'
        self.assertEqual(run(dict(data,op='refund-status'))['request']['Status'],'succeeded')
        self.assertEqual(run(dict(data,op='retry'))['request']['Status'],'succeeded')
        self.assertEqual(calls,['refund','refund-status'])
        self.assertEqual(self.money(),500)

    def test_package_links_scripts_roles_and_versions(self):
        import ast
        import deploy
        bundle=json.loads((ROOT.parent/'.template/workflow-template.json').read_text(encoding='utf-8'))['Projects'][0]['Template']
        config=json.loads((ROOT/'deploy.config.json').read_text(encoding='utf-8'))
        for endpoint in bundle['Endpoints']:
            nodes=[n for n in bundle['Nodes'] if n['EndpointId']==endpoint['Id']]
            ids={n['Id'] for n in nodes}
            self.assertIn(endpoint['NodeId'],ids)
            for n in nodes:
                for edge in ['NodeId','PositiveNodeId','NegativeNodeId','ThreadEntryNodeId']:
                    if n.get(edge): self.assertIn(n[edge],ids)
                if n['NodeType'] in (1,4): ast.parse('def main():\n'+'\n'.join('    '+ln for ln in n['MainScript'].splitlines()))
            if endpoint['Route']=='refunds':
                auth=next(n for n in nodes if n['Name']=='IdpAuth')
                self.assertEqual(auth.get('IdpAuthorizeRole'), 'Admin' if APP=='shop' else '')
                _,compiled=deploy.compile_workflow(str(ROOT/'workflows/refunds'),config,endpoint['Id'])
                for n in nodes:
                    other=next(c for c in compiled['Nodes'] if c['Name']==n['Name'])
                    self.assertEqual(n.get('MainScript'),other.get('MainScript'))
                self.assertEqual(sum(n['NodeType']==11 for n in nodes),1)
        manifest=json.loads((ROOT.parent/'template.json').read_text(encoding='utf-8'))
        catalog=json.loads((ROOT.parent.parent/'apps.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['version'],'1.1.1')
        self.assertEqual(next(a for a in catalog['apps'] if a['id']==APP)['version'],manifest['version'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
