d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')
if op in ('list', 'search'):
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})
if op == 'delete':
    return out({'deleted': True})
if not rows:
    fail('Customer not found.')
c = dict(rows[0])
c['Sales'] = load_json(c.pop('SalesJson', None), []) or []
return out(c)
