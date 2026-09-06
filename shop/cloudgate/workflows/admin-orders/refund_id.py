# Admin Orders / RefundId — the wallet payment id to refund.
rows = rows_of('''${Run}''')
r = rows[0] if rows else {}
if to_int(r.get('ConnectPaymentId'), 0) <= 0:
    fail('No wallet payment to refund on this order.')
return str(to_int(r.get('ConnectPaymentId'), 0))
