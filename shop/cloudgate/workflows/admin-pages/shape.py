# Admin Pages — shape.
d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')
if op in ('list', 'reorder'):
    return out({'items': rows})
if op == 'delete':
    r = rows[0] if rows else {}
    still = to_int(r.get('StillExists'), 0) == 1
    if still:
        fail('System pages cannot be deleted; unpublish them instead.')
    return out({'id': to_int(r.get('Id'), 0), 'deleted': True})
if not rows:
    fail('Page not found.')
return out(rows[0])
