rows = rows_of('''${RunRefund}''')
if not rows:
    return ''
s = rows[0]
return out({'type': 'sale.refunded', 'reference': s.get('Reference'), 'saleId': s.get('Id'), 'at': now_sql()})
