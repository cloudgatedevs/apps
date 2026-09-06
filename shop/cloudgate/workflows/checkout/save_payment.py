# Checkout / SavePayment — record the wallet checkout session against the order.
order = rows_of('''${CreateOrder}''')
pay = load_json('''${Pay}''', None)
if not order or not isinstance(pay, dict) or not pay.get('Id'):
    fail('The payment could not be created.')
o = order[0]
oid = to_int(o.get('Id'), 0)
raw = out(pay)
return (
    "BEGIN;\n"
    "INSERT INTO payments (OrderId, Provider, ConnectPaymentId, IdempotencyKey, PaymentUrl, AmountCents, Currency, Status, IsProduction, RawJson) VALUES (" +
    str(oid) + ", 'cloudgate_wallet', " + str(to_int(pay.get('Id'), 0)) + ", " + q('order-' + str(o.get('Reference'))) + ", " + qs(pay.get('PaymentUrl'), 2048) + ", " +
    str(to_int(pay.get('GrossAmount'), 0)) + ", " + qs(str(pay.get('Currency') or '').upper(), 3) + ", 'pending', " + ('1' if pay.get('IsProduction') else '0') + ", " + q(raw) + ");\n"
    "UPDATE orders SET PaymentStatus = 'pending', UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + ";\n"
    "INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) VALUES (" + str(oid) + ", 'payment_pending', 'Checkout session created', " + q(raw) + ", 'system');\n"
    "COMMIT;\n"
    "SELECT o.Id, o.Reference, o.Email, o.TotalCents, o.Currency, o.Status, o.PaymentStatus, p.PaymentUrl, p.ConnectPaymentId "
    "FROM orders o JOIN payments p ON p.OrderId = o.Id WHERE o.Id = " + str(oid) + " ORDER BY p.Id DESC LIMIT 1;"
)
