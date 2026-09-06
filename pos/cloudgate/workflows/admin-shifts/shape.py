d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')
if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})
if not rows:
    fail('Shift not found.')
s = dict(rows[0])
s['Movements'] = load_json(s.pop('MovementsJson', None), []) or []
s['ExpectedCashNowCents'] = to_int(s.get('OpeningFloatCents'), 0) + to_int(s.get('CashSalesCents'), 0) - to_int(s.get('CashRefundsCents'), 0) + to_int(s.get('CashMovementsCents'), 0)
return out(s)
