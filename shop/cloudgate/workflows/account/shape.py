# Account — shape rows.
d = body()
op = op_of(d, 'orders')
rows = rows_of('''${Run}''')

if op == 'orders':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})

if op == 'me':
    if not rows:
        return out({'customer': None})
    c = rows[0]
    c['DefaultAddress'] = load_json(c.pop('DefaultAddressJson', None), None)
    return out({'customer': c})

if not rows:
    fail('Order not found.')
o = rows[0]
o['Items'] = load_json(o.pop('ItemsJson', None), []) or []
o['Events'] = load_json(o.pop('EventsJson', None), []) or []
o['ShippingAddress'] = load_json(o.pop('ShippingAddressJson', None), None)
return out(o)
