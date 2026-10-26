rows = rows_of(value('Run'))
if not rows:
    return ''
o = rows[0]
if to_int(o.get('JustPaid'), 0) != 1 or str(o.get('PaymentStatus') or '') != 'paid':
    return ''
return out({'type': 'order.paid', 'reference': o.get('Reference'), 'orderId': o.get('Id'), 'totalCents': to_int(o.get('TotalCents'), 0), 'currency': o.get('Currency'), 'at': o.get('PaidAt') or now_sql()})
