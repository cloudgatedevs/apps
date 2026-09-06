rows = rows_of('''${RunRefund}''')

def shape_sale(r):
    """Row from SALE_DETAIL -> receipt-ready dict."""
    if not r:
        return None
    s = dict(r)
    s['Items'] = load_json(s.pop('ItemsJson', None), []) or []
    s['Payments'] = load_json(s.pop('PaymentsJson', None), []) or []
    s['Refunds'] = load_json(s.pop('RefundsJson', None), []) or []
    s['Settings'] = load_json(s.pop('SettingsJson', None), {}) or {}
    s['OutstandingCents'] = max(0, to_int(s.get('TotalCents'), 0) - to_int(s.get('PaidCents'), 0))
    return s

s = shape_sale(rows[0] if rows else None)
if not s:
    fail('Sale not found.')
return out(s)
