# Admin Orders — shape rows.
d = body()
op = op_of(d, 'list')
rows = rows_of('''${RunRefund}''') if op == 'refund' else rows_of('''${Run}''')

if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})

if not rows:
    fail('Order not found.')
o = rows[0]
o['Items'] = load_json(o.pop('ItemsJson', None), []) or []
o['Events'] = load_json(o.pop('EventsJson', None), []) or []
o['Payments'] = load_json(o.pop('PaymentsJson', None), []) or []
for key in ('ShippingAddressJson', 'BillingAddressJson'):
    if isinstance(o.get(key), str):
        o[key[:-4]] = load_json(o[key], None)
return out(o)
