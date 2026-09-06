# The succeeded wallet payment to refund (card refunds go back to the card that paid).

def load_pay():
    rows = rows_of('''${Load}''')
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    sale = load_json(r.get('SaleJson'), None)
    shift = load_json(r.get('ShiftJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
        for k in ('Pending', 'Succeeded'):
            if isinstance(sale.get(k), str):
                sale[k] = load_json(sale.get(k), None)
    return settings, (sale if isinstance(sale, dict) and sale.get('Id') else None), (shift if isinstance(shift, dict) and shift.get('Id') else None)

settings, sale, shift = load_pay()
if not sale or sale.get('Status') not in ('completed', 'partially_refunded'):
    fail('Only a completed sale can be refunded.')
ok = sale.get('Succeeded') or {}
pid = to_int(ok.get('ConnectPaymentId'), 0)
if pid <= 0:
    fail('This sale was not paid by card. Refund it in cash instead.')
return str(pid)
