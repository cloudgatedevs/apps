rows = rows_of(value('RunStatus'))
if not rows:
    return ''
s = rows[0]
if to_int(s.get('JustCompleted'), 0) != 1:
    return ''
return out({'type': 'sale.completed', 'reference': s.get('Reference'), 'saleId': s.get('Id'), 'totalCents': to_int(s.get('TotalCents'), 0), 'currency': s.get('Currency'), 'tellerName': s.get('TellerName'), 'at': now_sql()})
