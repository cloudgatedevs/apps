# Checkout / PayAmount — the order total in minor units, for the Wallet Payment node.
rows = rows_of('''${CreateOrder}''')
if not rows:
    fail('The order could not be created.')
return str(to_int(rows[0].get('TotalCents'), 0))
