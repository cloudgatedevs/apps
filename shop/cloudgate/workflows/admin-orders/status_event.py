rows = rows_of(value('Run'))
if not rows:
    return ''
o = rows[0]
return out({'type': 'order.status', 'orderId': o.get('Id'), 'reference': o.get('Reference'), 'status': o.get('Status'), 'paymentStatus': o.get('PaymentStatus'), 'fulfillmentStatus': o.get('FulfillmentStatus'), 'at': now_sql()})
