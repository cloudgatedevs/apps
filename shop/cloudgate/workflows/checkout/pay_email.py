rows = rows_of(value('CreateOrder'))
return str(rows[0].get('Email') if rows else '')
