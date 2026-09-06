# Payment Status / ShapeCached — the order as stored; nothing needed checking with the wallet.
rows = rows_of('''${LoadOrder}''')
if not rows:
    fail('Order not found.')
o = rows[0]
items = load_json(o.pop('ItemsJson', None), []) or []
addr = load_json(o.pop('ShippingAddressJson', None), None)
return out({
    'orderId': o.get('Id'), 'reference': o.get('Reference'), 'email': o.get('Email'),
    'name': ' '.join(x for x in (o.get('Name'), o.get('Surname')) if x),
    'currency': o.get('Currency'), 'subtotalCents': o.get('SubtotalCents'), 'shippingCents': o.get('ShippingCents'),
    'taxCents': o.get('TaxCents'), 'totalCents': o.get('TotalCents'),
    'status': o.get('Status'), 'paymentStatus': o.get('PaymentStatus'), 'fulfillmentStatus': o.get('FulfillmentStatus'),
    'paidAt': o.get('PaidAt'), 'createdAt': o.get('CreatedAt'), 'shippingAddress': addr,
    'paymentUrl': o.get('PaymentUrl') if str(o.get('PaymentStatus') or '') == 'pending' else None,
    'items': items, 'checked': False,
})
