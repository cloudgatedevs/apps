rows = rows_of(value('CreateOrder'))
return str(rows[0].get('Reference') if rows else '')
