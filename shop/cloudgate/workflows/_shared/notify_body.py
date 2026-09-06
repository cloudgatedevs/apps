# Shared / NotifyBody — the "order.paid" event for the back office's live channel.
# Runs on the thread branch after finalisation; empty output means "nothing to announce".
# Payload is deliberately small: the channel credentials live in the back-office bundle,
# so it carries only what the dashboard needs to refresh, never customer details.
rows = rows_of('''${Run}''')
if not rows:
    return ''
o = rows[0]
if to_int(o.get('JustPaid'), 0) != 1 or str(o.get('PaymentStatus') or '') != 'paid':
    return ''
return out({
    'type': 'order.paid',
    'reference': o.get('Reference'),
    'orderId': o.get('Id'),
    'totalCents': to_int(o.get('TotalCents'), 0),
    'currency': o.get('Currency'),
    'at': o.get('PaidAt') or now_sql(),
})
