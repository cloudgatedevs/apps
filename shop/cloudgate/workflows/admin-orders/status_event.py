# Admin Orders / StatusEvent — "order.status" for the live channel; the email thread branches off this node.
# Small payload by design (the channel credentials ship in the back-office bundle): ids and states only.
rows = rows_of('''${Run}''')
if not rows:
    return ''
o = rows[0]
return out({
    'type': 'order.status',
    'orderId': o.get('Id'),
    'reference': o.get('Reference'),
    'status': o.get('Status'),
    'paymentStatus': o.get('PaymentStatus'),
    'fulfillmentStatus': o.get('FulfillmentStatus'),
    'at': now_sql(),
})
