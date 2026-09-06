# Admin Inventory — shape rows.
d = body()
op = op_of(d, 'stock')
rows = rows_of('''${Run}''')

for r in rows:
    if isinstance(r.get('OptionsJson'), str):
        r['Options'] = load_json(r.pop('OptionsJson'), {}) or {}
    elif 'OptionsJson' in r:
        r['Options'] = {}
        r.pop('OptionsJson', None)

if op in ('adjust', 'set-threshold'):
    if not rows:
        fail('Variant not found.')
    return out(rows[0])

total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
for r in rows:
    r.pop('TotalCount', None)
return out({'items': rows, 'total': total})
