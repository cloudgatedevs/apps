rows = rows_of(value('CreateOrder'))
return str((rows[0].get('Currency') if rows else None) or 'zar').lower()
