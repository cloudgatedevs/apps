# Checkout / PayCurrency — ISO currency code (lower case, as the wallet expects).
rows = rows_of('''${CreateOrder}''')
return str((rows[0].get('Currency') if rows else None) or 'zar').lower()
