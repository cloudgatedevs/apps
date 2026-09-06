# Payment Status / NeedsCheck — only ask the wallet while the payment is genuinely undecided.
# Condition nodes must return a Python bool: a string such as 'True' is serialised with quotes
# and the engine then falls through to the negative branch.
rows = rows_of('''${LoadOrder}''')
if not rows:
    fail('Order not found.')
o = rows[0]
pending = str(o.get('PaymentStatus') or '') == 'pending' and str(o.get('PaymentRowStatus') or '') == 'pending'
has_payment = to_int(o.get('ConnectPaymentId'), 0) > 0
return bool(pending and has_payment)
