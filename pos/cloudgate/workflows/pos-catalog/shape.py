# POS Catalog / Shape.
d = body()
op = op_of(d, 'products')
rows = rows_of('''${Run}''')
if op == 'settings':
    return out({'values': {r.get('Key'): r.get('Value') for r in rows}})
if op == 'lookup':
    if not rows:
        return out({'found': False})
    p = rows[0]
    return out({'found': True, 'product': p})
return out({'items': rows})
