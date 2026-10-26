rows = rows_of(value('Run'))
o = rows[0] if rows else {}
return out({'checked': True, 'reference': o.get('Reference'), 'status': o.get('Status'), 'paymentStatus': o.get('PaymentStatus'), 'paidAt': o.get('PaidAt')})
