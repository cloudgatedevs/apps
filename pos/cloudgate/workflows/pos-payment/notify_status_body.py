# POS Payment / NotifyStatusBody — announce a completed card sale to the back office (only on the poll that completed it).
rows = rows_of('''${RunStatus}''')
if not rows:
    return ''
s = rows[0]
if to_int(s.get('JustCompleted'), 0) != 1:
    return ''
return out({'type': 'sale.completed', 'reference': s.get('Reference'), 'saleId': s.get('Id'), 'totalCents': to_int(s.get('TotalCents'), 0), 'currency': s.get('Currency'), 'tellerName': s.get('TellerName'), 'at': now_sql()})
