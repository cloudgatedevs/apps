# Admin Messages — shape.
d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')
if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    new = to_int(rows[0].get('NewCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
        r.pop('NewCount', None)
    return out({'items': rows, 'total': total, 'newCount': new})
if op == 'delete':
    return out({'id': to_int((rows[0] if rows else {}).get('Id'), 0), 'deleted': True})
if not rows:
    fail('Message not found.')
return out(rows[0])
