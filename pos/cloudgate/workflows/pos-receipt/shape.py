rows = rows_of('''${Run}''')
if not rows:
    fail('Sale not found.')
d = body()
return out({'queued': True, 'to': str(d.get('to') or '').strip(), 'reference': rows[0].get('Reference')})
