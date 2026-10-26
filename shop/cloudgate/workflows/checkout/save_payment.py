order = rows_of(value('CreateOrder'))
pay = load_json(value('Pay'), None)
if not order or not isinstance(pay, dict) or (not pay.get('Id')):
    fail('The payment could not be created.')
o = order[0]
if pay.get('GrossAmount') != to_int(o.get('TotalCents'), 0) or str(pay.get('Currency') or '').upper() != str(o.get('Currency') or '').upper():
    fail('Wallet checkout details do not match this order. Please contact the store.')
if not str(pay.get('PaymentUrl') or '').startswith('https://'):
    fail('The wallet did not return a secure checkout URL. Please try again.')
oid = to_int(o.get('Id'), 0)
raw = out(pay)
return 'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; INSERT INTO payments (OrderId, Provider, ConnectPaymentId, IdempotencyKey, PaymentUrl, AmountCents, Currency, Status, IsProduction, RawJson) VALUES (' + str(oid) + ", 'cloudgate_wallet', " + str(to_int(pay.get('Id'), 0)) + ', ' + q('order-' + str(o.get('Reference'))) + ', ' + qs(pay.get('PaymentUrl'), 2048) + ', ' + str(to_int(pay.get('GrossAmount'), 0)) + ', ' + qs(str(pay.get('Currency') or '').upper(), 3) + ", 'pending', " + ('1' if pay.get('IsProduction') else '0') + ', ' + q(raw) + "); UPDATE orders SET PaymentStatus = 'pending', UpdatedAt = SYSUTCDATETIME() WHERE Id = " + str(oid) + '; INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) VALUES (' + str(oid) + ", 'payment_pending', 'Checkout session created', " + q(raw) + ", 'system'); COMMIT TRANSACTION; SELECT TOP 1 o.Id, o.Reference, o.Email, o.TotalCents, o.Currency, o.Status, o.PaymentStatus, p.PaymentUrl, p.ConnectPaymentId FROM orders AS o JOIN payments AS p ON p.OrderId = o.Id WHERE o.Id = " + str(oid) + ' ORDER BY p.Id DESC;'
