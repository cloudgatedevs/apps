# Admin Customers — shape rows.
d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')

if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})

if not rows:
    fail('Customer not found.')
c = rows[0]
c['OrderCount'] = to_int(c.pop('Orders', 0), 0)
c['Orders'] = load_json(c.pop('OrdersJson', None), []) or []
if isinstance(c.get('DefaultAddressJson'), str):
    c['DefaultAddress'] = load_json(c.pop('DefaultAddressJson'), None)
return out(c)
