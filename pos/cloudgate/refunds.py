"""Durable refund plans shared by the Shop/POS refund workflows.

No provider calls here: claim commits before Wallet, and SQLite triggers apply a
confirmed result atomically. Keep the POS copy identical (enforced by tests).
"""
import json
import re
from decimal import Decimal, ROUND_HALF_UP


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def quote(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


def require(test, message):
    if not test:
        raise Exception(message)


def number(value, label='Amount'):
    try:
        n = Decimal(str(value))
        require(n.is_finite() and n > 0, label + ' must be positive.')
        return n
    except Exception:
        raise Exception(label + ' must be a positive number.')


def integer(value, label='Amount'):
    n = number(value, label)
    require(n == int(n), label + ' must be an integer.')
    return int(n)


def authorize(app, user):
    require(isinstance(user, dict) and user.get('Id') and user.get('IsActive') is not False, 'Sign in required.')
    admin = str(user.get('Role', '')).lower() in ('admin', 'administrator', 'owner')
    require(app != 'shop' or admin, 'Admin role required.')
    return admin


def intent(app, data):
    method = str(data.get('method') or 'card').lower()
    require(method in (('card',) if app == 'shop' else ('cash', 'card')), 'Invalid refund method.')
    result = dict(method=method, reason=str(data.get('reason') or '').strip()[:500])
    if app == 'shop':
        result.update(amountCents=integer(data['amountCents']) if data.get('amountCents') is not None else None,
                      restock=data.get('restock') is True)
    else:
        items = data.get('items')
        require(isinstance(items, list) and 0 < len(items) <= 200, 'Choose the items to refund.')
        result['items'] = sorted([dict(saleItemId=integer(i.get('saleItemId'), 'Item'),
                                     qty=str(number(i.get('qty'), 'Quantity').normalize())) for i in items], key=lambda i: i['saleItemId'])
        require(len({i['saleItemId'] for i in result['items']}) == len(items), 'Duplicate refund item.')
    return result


def key_of(data):
    key = str(data.get('requestKey') or '')
    require(re.fullmatch(r'[A-Za-z0-9_-]{16,96}', key), 'A stable refund requestKey is required.')
    return key


def rows(value):
    if isinstance(value, str):
        value = json.loads(value) if value and value != 'No records found' else []
    return [value] if isinstance(value, dict) else (value or [])


def read_sql(app, data, user):
    authorize(app, user)
    bid = integer(data.get('id'), 'Order or sale id')
    entity, fk, items, payments = ('orders', 'OrderId', 'order_items', 'payments') if app == 'shop' else ('sales', 'SaleId', 'sale_items', 'sale_payments')
    columns = ['Id', 'Reference', 'TotalCents', 'Currency', 'Status'] + (['RefundedCents'] if app == 'pos' else [])
    item_columns = ['Id', 'ProductId', 'Qty', 'LineTotalCents'] + (['VariantId'] if app == 'shop' else ['RefundedQty'])
    payment_columns = ['Id', 'AmountCents', 'ConnectPaymentId', 'Status'] + (['RefundedCents'] if app == 'shop' else ['Method'])

    def array(table, columns, where):
        fields = ','.join(quote(c) + ',' + c for c in columns)
        return '(SELECT json_group_array(json_object(' + fields + ')) FROM ' + table + ' WHERE ' + where + ')'

    result = 'SELECT ' + array(entity, columns, 'Id=' + str(bid)) + ' AS EntityJson,'
    result += array(items, item_columns, fk + '=' + str(bid)) + ' AS ItemsJson,'
    result += array(payments, payment_columns, fk + '=' + str(bid)) + ' AS PaymentsJson,'
    result += '(SELECT json_group_array(json_object(' + ','.join(quote(c) + ',' + c for c in REQUEST_COLUMNS) + ')) FROM refund_requests WHERE BusinessId=' + str(bid) + ') AS RequestsJson'
    if app == 'pos':
        result += ',(SELECT json_group_object(Key,Value) FROM settings) AS SettingsJson'
        result += ',' + array('shifts', ['Id', 'Status'], 'Status=\'open\' AND TellerUserId=' + str(integer(user['Id']))) + ' AS ShiftsJson'
        result += ',' + array('refunds', ['AmountCents', 'Method', 'ConnectRefundId'], 'SaleId=' + str(bid) + " AND Status='completed'") + ' AS LegacyJson'
    return result + ';'


REQUEST_COLUMNS = ['Id', 'RequestKey', 'BusinessId', 'Method', 'AmountCents', 'Currency', 'PaymentRowId', 'PaymentId',
                   'IntentJson', 'LinesJson', 'Status', 'ProviderRefundId', 'Applied', 'ShiftId', 'CreatedBy', 'CreatedAt']


def request_select(bid, key=None):
    return 'SELECT * FROM refund_requests WHERE BusinessId=' + str(bid) + (' AND RequestKey=' + quote(key) if key else '') + ' ORDER BY Id DESC;'


def claim_sql(app, data, user, loaded):
    admin = authorize(app, user)
    bid = integer(data.get('id'), 'Order or sale id')
    op = data.get('op', 'refund')
    require(op in ('list', 'refund', 'refund-status', 'retry', 'discard-unsent'), 'Unknown refund operation.')
    snapshot = rows(loaded)[0]
    entities = rows(snapshot.get('EntityJson'))
    require(entities, 'Order or sale not found.')
    entity = entities[0]
    if op == 'list':
        return request_select(bid)
    key = key_of(data)
    existing = next((r for r in rows(snapshot.get('RequestsJson')) if r['RequestKey'] == key), None)
    if existing:
        if op == 'refund':
            require(encode(intent(app, data)) == existing['IntentJson'], 'This refund key is already bound to a different request.')
        return request_select(bid, key)
    if op == 'discard-unsent':
        # A tombstone races atomically with a delayed claim. If the claim won,
        # preserve it; otherwise the original key can never submit a payment.
        spec = intent(app, data)
        return ("BEGIN IMMEDIATE;\nINSERT INTO refund_requests(RequestKey,BusinessId,Method,AmountCents,Currency,IntentJson,SnapshotRefunded,Status,CreatedBy) VALUES (" +
                ','.join(quote(v) for v in [key,bid,spec['method'],0,str(entity['Currency']).upper(),encode(spec),0,'failed',str(user['Id'])]) +
                ") ON CONFLICT(RequestKey) DO NOTHING;\nCOMMIT;\n" + request_select(bid,key))
    require(op == 'refund', 'Refund request not found. Retry the original request with its original details.')
    spec = intent(app, data)
    payments = [p for p in rows(snapshot.get('PaymentsJson')) if p['Status'] in ('succeeded', 'partially_refunded')]
    fields = dict(RequestKey=key, BusinessId=bid, Method=spec['method'], Currency=str(entity['Currency']).upper(),
                  IntentJson=encode(spec), LinesJson='[]', Status='submitting', CreatedBy=str(user.get('Email') or user['Id']),
                  SnapshotRefunded=0, ShiftId=None, PaymentRowId=None, PaymentId=None)
    if app == 'shop':
        payments = [p for p in payments if p['ConnectPaymentId'] and p['AmountCents'] > (p['RefundedCents'] or 0)]
        require(payments, 'No refundable card payment.')
        payment = sorted(payments, key=lambda p: p['Id'], reverse=True)[0]
        remaining = payment['AmountCents'] - (payment['RefundedCents'] or 0)
        amount = spec['amountCents'] if spec['amountCents'] is not None else remaining
        require(amount <= remaining, 'Refund exceeds the original payment balance.')
        fields.update(PaymentRowId=payment['Id'], PaymentId=payment['ConnectPaymentId'], SnapshotRefunded=payment['RefundedCents'] or 0)
    else:
        require(entity['Status'] in ('completed', 'partially_refunded'), 'Only a completed sale can be refunded.')
        items = rows(snapshot.get('ItemsJson'))
        total_weight = sum(i['LineTotalCents'] for i in items)
        require(total_weight > 0, 'Nothing left to refund.')
        # Allocate the sale discount to items once, including integer rounding, then
        # refund the cumulative quantity delta. Repeated fractional returns do not mint cents.
        weights = {i['Id']: Decimal(i['LineTotalCents']) * entity['TotalCents'] / total_weight for i in items}
        allocations = {k: int(v) for k, v in weights.items()}
        for k in sorted(weights, key=lambda k: (-(weights[k] - allocations[k]), k))[:entity['TotalCents'] - sum(allocations.values())]:
            allocations[k] += 1
        lines, amount = [], 0
        for chosen in spec['items']:
            item = next((i for i in items if i['Id'] == chosen['saleItemId']), None)
            require(item, 'Refund item does not belong to this sale.')
            qty, old, sold = Decimal(chosen['qty']), Decimal(str(item['RefundedQty'])), Decimal(str(item['Qty']))
            require(qty <= sold - old, 'Refund quantity exceeds the remaining quantity.')
            round_cents = lambda v: int(v.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            cents = round_cents(allocations[item['Id']] * (old + qty) / sold) - round_cents(allocations[item['Id']] * old / sold)
            amount += cents
            lines.append(dict(saleItemId=item['Id'], productId=item['ProductId'], qty=float(qty), expectedRefundedQty=float(old), amountCents=cents))
        amount = min(amount, entity['TotalCents'] - entity['RefundedCents'])
        require(amount > 0, 'Nothing left to refund for these items.')
        fields.update(SnapshotRefunded=entity['RefundedCents'], LinesJson=encode(lines))
        legacy = rows(snapshot.get('LegacyJson'))
        requests = rows(snapshot.get('RequestsJson'))
        method_refunded = sum(r['AmountCents'] for r in legacy if r['Method'] == spec['method'])
        method_paid = sum(p['AmountCents'] for p in payments if p['Method'] == spec['method'])
        require(amount <= method_paid - method_refunded, 'Refund exceeds the amount paid by this method.')
        if spec['method'] == 'card':
            # Old records did not reliably identify the payment. Reserve their total
            # conservatively against each candidate; never guess which card to debit.
            unknown = method_refunded - sum(r['AmountCents'] for r in requests if r['Method'] == 'card' and r['Applied'])
            candidates = [p for p in payments if p['Method'] == 'card' and p['ConnectPaymentId'] and
                          amount <= p['AmountCents'] - max(0, unknown) - sum(r['AmountCents'] for r in requests if r['PaymentRowId'] == p['Id'] and r['Applied'])]
            require(candidates, 'This refund exceeds a single original card payment. Refund fewer items or reconcile the earlier refunds.')
            payment = sorted(candidates, key=lambda p: p['Id'], reverse=True)[0]
            fields.update(PaymentRowId=payment['Id'], PaymentId=payment['ConnectPaymentId'])
        else:
            shifts = rows(snapshot.get('ShiftsJson'))
            settings = json.loads(snapshot.get('SettingsJson') or '{}')
            require(shifts or (admin and data.get('backOffice') is True) or settings.get('require_shift') in ('0', 'false'), 'Open a shift before recording a cash refund.')
            fields['ShiftId'] = shifts[0]['Id'] if shifts else None
    fields['AmountCents'] = amount
    sql = 'BEGIN IMMEDIATE;\nINSERT INTO refund_requests (' + ','.join(fields) + ') VALUES (' + ','.join(quote(v) for v in fields.values()) + ') ON CONFLICT(RequestKey) DO NOTHING;\n'
    if spec['method'] == 'cash':
        sql += "UPDATE refund_requests SET Status='succeeded' WHERE RequestKey=" + quote(key) + " AND Status='submitting';\n"
    return sql + 'COMMIT;\n' + request_select(bid, key)


def apply_sql(app, request_row, provider):
    r = request_row
    require(isinstance(provider, dict), 'Invalid Wallet refund response. Check this request before retrying.')
    require(provider.get('IdempotencyKey') == app + '-refund-' + r['RequestKey'], 'Wallet refund key mismatch.')
    require(provider.get('PaymentId') == r['PaymentId'], 'Wallet refund payment mismatch.')
    require(provider.get('Amount') == r['AmountCents'], 'Wallet refund amount mismatch.')
    require(str(provider.get('Currency') or '').upper() == r['Currency'], 'Wallet refund currency mismatch.')
    status = provider.get('Status')
    require(status in ('submitting', 'pending', 'succeeded', 'failed', 'reconciliation_required'), 'Unknown Wallet refund status.')
    rid = str(provider.get('RefundId') or '') or None
    require(status != 'succeeded' or rid, 'Confirmed refund is missing its provider reference.')
    require(not r.get('ProviderRefundId') or r['ProviderRefundId'] == rid, 'Wallet provider refund reference changed.')
    return ('BEGIN IMMEDIATE;\nUPDATE refund_requests SET Status=' + quote(status) + ',ProviderRefundId=COALESCE(' + quote(rid) + ',ProviderRefundId),RawJson=' + quote(encode(provider)) +
            ',UpdatedAt=CURRENT_TIMESTAMP WHERE RequestKey=' + quote(r['RequestKey']) + " AND Status NOT IN ('succeeded','failed');\nCOMMIT;\n" + request_select(r['BusinessId'], r['RequestKey']))


def response(value, key=None):
    items = rows(value)
    for r in items:
        r['intent'] = json.loads(r.pop('IntentJson'))
        r.pop('RawJson', None)
        r.pop('LinesJson', None)
    return encode(dict(items=items, request=next((r for r in items if r['RequestKey'] == key), None)))
