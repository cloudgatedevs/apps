# Catalog — shape the database rows into the response.
d = body()
op = op_of(d, 'products')
rows = rows_of('''${Run}''')

if op == 'settings':
    return out({r.get('Key'): r.get('Value') for r in rows})

if op == 'categories':
    return out({'items': rows})

if op == 'bounds':
    r = rows[0] if rows else {}
    return out({'minCents': to_int(r.get('MinCents'), 0), 'maxCents': to_int(r.get('MaxCents'), 0), 'products': to_int(r.get('Products'), 0)})

if op == 'product':
    if not rows:
        fail('Product not found.')
    p = rows[0]
    p['Options'] = load_json(p.pop('OptionsJson', None), []) or []
    p['Variants'] = load_json(p.pop('VariantsJson', None), []) or []
    p['Images'] = load_json(p.pop('ImagesJson', None), []) or []
    for o in p['Options']:
        if isinstance(o.get('Values'), str):
            o['Values'] = load_json(o['Values'], []) or []
    for v in p['Variants']:
        if isinstance(v.get('Options'), str):
            v['Options'] = load_json(v['Options'], {}) or {}
    # Never expose cost price on the storefront.
    p.pop('CostCents', None)
    return out(p)

# products / featured
total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
for r in rows:
    r.pop('TotalCount', None)
return out({
    'items': rows,
    'total': total,
    'skip': clamp(d.get('skip'), 0, 1000000, 0),
    'take': clamp(d.get('take'), 1, 60, 8 if op == 'featured' else 24),
})
