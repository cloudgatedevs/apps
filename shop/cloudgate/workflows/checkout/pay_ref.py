# Checkout / PayRef — the order reference (also the wallet reference and idempotency key).
rows = rows_of('''${CreateOrder}''')
return str(rows[0].get('Reference') if rows else '')
