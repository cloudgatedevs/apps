# Newsletter — shape.
rows = rows_of('''${Run}''')
r = rows[0] if rows else {}
return out({'subscribed': to_int(r.get('Subscribed'), 0) == 1, 'email': r.get('Email')})
