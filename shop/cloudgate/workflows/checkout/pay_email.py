# Checkout / PayEmail — the customer's email (required by Paystack, prefilled by Stripe).
rows = rows_of('''${CreateOrder}''')
return str(rows[0].get('Email') if rows else '')
