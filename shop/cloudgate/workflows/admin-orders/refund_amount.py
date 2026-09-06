# Admin Orders / RefundAmount — requested cents, or blank for a full refund of what remains.
d = body()
rows = rows_of('''${Run}''')
r = rows[0] if rows else {}
remaining = to_int(r.get('AmountCents'), 0) - to_int(r.get('RefundedCents'), 0)
if remaining <= 0:
    fail('This payment has already been fully refunded.')
amount = to_int(d.get('amountCents'), 0) if d.get('amountCents') not in (None, '') else 0
if amount > remaining:
    fail('Refund exceeds the remaining ' + str(remaining) + ' cents.')
return str(amount) if amount > 0 else ''
