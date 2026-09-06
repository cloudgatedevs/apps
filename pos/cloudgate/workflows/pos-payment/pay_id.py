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
pending = (sale or {}).get('Pending') if sale else None
if not sale:
    fail('Sale not found.')
if not pending:
    # Nothing pending: answer from the database without touching the wallet (paymentId 0 -> node error), so signal via a benign id.
    fail('No card payment is in progress for this sale.')
return str(to_int(pending.get('ConnectPaymentId'), 0))
