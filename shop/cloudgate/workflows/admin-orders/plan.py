# Admin Orders — build SQL. Requires IdP admin.
user = require_admin('''${IdpAuth}''')
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
if op_of(d, '') in ('refund','refund-status','retry'):
    fail('Use the refunds action with a stable requestKey. Update the app template.')
op = op_of(d, 'list')

STATUSES = ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
FULFILMENT = ('unfulfilled', 'partial', 'fulfilled')


def detail_sql(where):
    return (
        "SELECT o.*, "
        "(SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'VariantId', i.VariantId, 'Sku', i.Sku, 'Title', i.Title, "
        "   'VariantTitle', i.VariantTitle, 'ImageUrl', i.ImageUrl, 'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
        " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson, "
        "(SELECT json_group_array(json_object('Id', e.Id, 'Type', e.Type, 'Message', e.Message, "
        "   'Data', CASE WHEN json_valid(e.DataJson) THEN json(e.DataJson) ELSE NULL END, 'CreatedBy', e.CreatedBy, 'CreatedAt', e.CreatedAt)) "
        " FROM (SELECT * FROM order_events WHERE OrderId = o.Id ORDER BY CreatedAt DESC, Id DESC) e) AS EventsJson, "
        "(SELECT json_group_array(json_object('Id', p.Id, 'Provider', p.Provider, 'ConnectPaymentId', p.ConnectPaymentId, 'PaymentUrl', p.PaymentUrl, "
        "   'AmountCents', p.AmountCents, 'Currency', p.Currency, 'Status', p.Status, 'RefundedCents', p.RefundedCents, 'IsProduction', p.IsProduction, "
        "   'PaidAt', p.PaidAt, 'CreatedAt', p.CreatedAt)) "
        " FROM (SELECT * FROM payments WHERE OrderId = o.Id ORDER BY Id DESC) p) AS PaymentsJson "
        "FROM orders o WHERE " + where + " LIMIT 1;"
    )


if op == 'list':
    where = ['1=1']
    st = str(d.get('status') or '').lower()
    if st in STATUSES:
        where.append('o.Status = ' + q(st))
    ps = str(d.get('paymentStatus') or '').lower()
    if ps:
        where.append('o.PaymentStatus = ' + qs(ps, 30))
    fs = str(d.get('fulfillmentStatus') or '').lower()
    if fs in FULFILMENT:
        where.append('o.FulfillmentStatus = ' + q(fs))
    term = str(d.get('search') or '').strip()
    if term:
        lk = like(term)
        where.append('(o.Reference LIKE ' + lk + ' OR o.Email LIKE ' + lk + ' OR o.Name LIKE ' + lk + ' OR o.Surname LIKE ' + lk + ' OR o.Phone LIKE ' + lk + ')')
    take = clamp(d.get('take'), 1, 200, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return (
        "SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Phone, o.Currency, o.SubtotalCents, o.ShippingCents, o.TotalCents, "
        "o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.ShippedAt, o.CreatedAt, o.UpdatedAt, "
        "(SELECT COALESCE(SUM(i.Qty), 0) FROM order_items i WHERE i.OrderId = o.Id) AS Items, "
        "COUNT(*) OVER () AS TotalCount "
        "FROM orders o WHERE " + ' AND '.join(where) + " ORDER BY o.CreatedAt DESC, o.Id DESC LIMIT " + str(take) + " OFFSET " + str(skip) + ";"
    )

if op == 'get':
    oid = to_int(d.get('id'), 0)
    ref = str(d.get('reference') or '').strip()
    if oid > 0:
        return detail_sql('o.Id = ' + str(oid))
    if ref:
        return detail_sql('o.Reference = ' + qs(ref, 40))
    fail('id or reference is required.')

if op == 'set-status':
    oid = to_int(d.get('id'), 0)
    st = str(d.get('status') or '').lower()
    if oid <= 0 or st not in STATUSES:
        fail('id and a valid status are required.')
    note = str(d.get('note') or '').strip()[:500]
    carrier = str(d.get('carrier') or '').strip()[:60]
    tracking = str(d.get('trackingNumber') or '').strip()[:80]
    tracking_url = str(d.get('trackingUrl') or '').strip()[:500]
    if tracking_url and not (tracking_url.startswith('http://') or tracking_url.startswith('https://')):
        fail('trackingUrl must be an http(s) link.')
    notify = d.get('notifyCustomer') not in (False, 0, '0', 'false', 'no')
    extra = ''
    if st == 'shipped':
        extra = ", ShippedAt = CURRENT_TIMESTAMP, FulfillmentStatus = 'fulfilled'"
    elif st == 'delivered':
        extra = ", FulfillmentStatus = 'fulfilled'"
    elif st == 'cancelled':
        extra = ", CancelledAt = CURRENT_TIMESTAMP"
    message = 'Status set to ' + st
    if st == 'shipped' and (carrier or tracking):
        message = 'Shipped' + (' with ' + carrier if carrier else '') + (' - tracking ' + tracking if tracking else '')
    if note:
        message += '. ' + note
    data = {'status': st, 'notifyCustomer': notify}
    if carrier:
        data['carrier'] = carrier
    if tracking:
        data['trackingNumber'] = tracking
    if tracking_url:
        data['trackingUrl'] = tracking_url
    # The customer email + live event branch off this statement's reloaded order (see workflow.json).
    return (
        "BEGIN;\n"
        "UPDATE orders SET Status = " + q(st) + extra + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + ";\n"
        "INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) VALUES (" + str(oid) + ", " + q('shipped' if st == 'shipped' else 'status') + ", " + q(message) + ", " + q(_json.dumps(data)) + ", " + q(actor) + ");\n"
        "COMMIT;\n" + detail_sql('o.Id = ' + str(oid))
    )

if op == 'add-note':
    oid = to_int(d.get('id'), 0)
    note = str(d.get('note') or '').strip()
    if oid <= 0 or not note:
        fail('id and note are required.')
    return (
        "BEGIN;\n"
        "UPDATE orders SET InternalNote = " + qs(note, 2000) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + ";\n"
        "INSERT INTO order_events (OrderId, Type, Message, CreatedBy) VALUES (" + str(oid) + ", 'note', " + qs(note, 2000) + ", " + q(actor) + ");\n"
        "COMMIT;\n" + detail_sql('o.Id = ' + str(oid))
    )

fail('Unknown op: ' + op)
