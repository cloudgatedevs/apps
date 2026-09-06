# POS Sale / NotifyBody — 'sale.completed' for the back office when a cash sale or refund lands.
d = body()
op = op_of(d, 'complete')
if op not in ('complete', 'refund'):
    return ''
rows = rows_of('''${Run}''')
if not rows:
    return ''
s = rows[0]
return out({'type': 'sale.completed' if op == 'complete' else 'sale.refunded', 'reference': s.get('Reference'), 'saleId': s.get('Id'),
            'totalCents': to_int(s.get('TotalCents'), 0), 'currency': s.get('Currency'), 'tellerName': s.get('TellerName'), 'at': now_sql()})
