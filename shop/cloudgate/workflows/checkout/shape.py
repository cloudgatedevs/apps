# Checkout / Shape — what the storefront needs to send the customer to the payment page.
rows = rows_of('''${Run}''')
if not rows:
    fail('The payment could not be saved.')
r = rows[0]
return out({
    'orderId': r.get('Id'), 'reference': r.get('Reference'), 'email': r.get('Email'),
    'totalCents': r.get('TotalCents'), 'currency': r.get('Currency'),
    'status': r.get('Status'), 'paymentStatus': r.get('PaymentStatus'),
    'paymentUrl': r.get('PaymentUrl'), 'paymentId': r.get('ConnectPaymentId'),
})
