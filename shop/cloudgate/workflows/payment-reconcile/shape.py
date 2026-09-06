# Payment Reconcile / Shape — report what happened to the order that was re-read.
rows = rows_of('''${Run}''')
o = rows[0] if rows else {}
return out({'checked': True, 'reference': o.get('Reference'), 'status': o.get('Status'), 'paymentStatus': o.get('PaymentStatus'), 'paidAt': o.get('PaidAt')})
