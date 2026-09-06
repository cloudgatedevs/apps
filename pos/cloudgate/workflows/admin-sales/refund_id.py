def load_admin():
    rows = rows_of('''${Load}''')
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    sale = load_json(r.get('SaleJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
        if isinstance(sale.get('Succeeded'), str):
            sale['Succeeded'] = load_json(sale.get('Succeeded'), None)
    return settings, (sale if isinstance(sale, dict) and sale.get('Id') else None)

settings, sale = load_admin()
if not sale or sale.get('Status') not in ('completed', 'partially_refunded'):
    fail('Only a completed sale can be refunded.')
pid = to_int((sale.get('Succeeded') or {}).get('ConnectPaymentId'), 0)
if pid <= 0:
    fail('This sale was not paid by card; refund it in cash.')
return str(pid)
