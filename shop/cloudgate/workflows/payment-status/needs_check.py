rows = rows_of(value('LoadOrder'))
if not rows:
    fail('Order not found.')
o = rows[0]
pending = str(o.get('PaymentStatus') or '') == 'pending' and str(o.get('PaymentRowStatus') or '') == 'pending'
has_payment = to_int(o.get('ConnectPaymentId'), 0) > 0
return bool(pending and has_payment)
