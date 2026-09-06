# Admin Dashboard — shape rows.
d = body()
op = op_of(d, 'stats')
rows = rows_of('''${Run}''')
if op == 'stats':
    return out(rows[0] if rows else {})
return out({'items': rows})
