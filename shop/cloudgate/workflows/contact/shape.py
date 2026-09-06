# Contact — shape.
rows = rows_of('''${Run}''')
r = rows[0] if rows else {}
return out({'received': True, 'id': to_int(r.get('Id'), 0)})
