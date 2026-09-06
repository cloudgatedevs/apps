d = body()
op = op_of(d, 'levels')
rows = rows_of('''${Run}''')
if op in ('levels', 'movements', 'receipts'):
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})
if op == 'count':
    return out({'counted': to_int(rows[0].get('Counted'), 0) if rows else 0})
if not rows:
    fail('Not found.')
r = dict(rows[0])
if 'ItemsJson' in r:
    r['Items'] = load_json(r.pop('ItemsJson', None), []) or []
return out(r)
