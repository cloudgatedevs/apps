# Payment Status / PayId — the Cloudgate wallet payment id to re-read.
rows = rows_of('''${LoadOrder}''')
return str(to_int(rows[0].get('ConnectPaymentId'), 0) if rows else 0)
