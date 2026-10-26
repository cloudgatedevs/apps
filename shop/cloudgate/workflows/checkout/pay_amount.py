rows = rows_of(value('CreateOrder'))
if not rows:
    fail('The order could not be created.')
return str(to_int(rows[0].get('TotalCents'), 0))
