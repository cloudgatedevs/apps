# POS Shift / Shape — the shift with derived cash figures.
d = body()
op = op_of(d, 'current')
rows = rows_of('''${Run}''')
if op == 'registers':
    return out({'items': rows})
if not rows:
    if op == 'open':
        fail('Could not open the shift: you already have an open shift, or this register is in use.')
    if op == 'close':
        fail('No open shift to close.')
    return out({'shift': None})
s = dict(rows[0])
s['Movements'] = load_json(s.pop('MovementsJson', None), []) or []
expected = to_int(s.get('OpeningFloatCents'), 0) + to_int(s.get('CashSalesCents'), 0) - to_int(s.get('CashRefundsCents'), 0) + to_int(s.get('CashMovementsCents'), 0)
s['ExpectedCashNowCents'] = expected
return out({'shift': s})
