# Checkout / PayEmail — the customer's email (required by the hosted checkout page).
rows = rows_of('''${CreateOrder}''')
return str(rows[0].get('Email') if rows else '')
