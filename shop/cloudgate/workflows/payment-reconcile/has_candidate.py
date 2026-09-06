# Payment Reconcile / HasCandidate — is there a pending payment to re-read? (Condition: return a bool.)
rows = rows_of('''${LoadOrder}''')
return bool(rows and to_int(rows[0].get('ConnectPaymentId'), 0) > 0)
