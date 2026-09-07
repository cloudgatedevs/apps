# POS Sale / Shape — the response for each op (runs on the thread branch so the WebSocket notify never delays the till).
d = body()
op = op_of(d, 'complete')
rows = rows_of('''${Run}''')

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

if op == 'recent':
    items = [{k: v for k, v in dict(r).items() if k != 'Total'} for r in rows]
    return out({'items': items, 'total': to_int(rows[0].get('Total'), 0) if rows else 0})
if op == 'held':
    return out({'items': rows})
s = shape_sale(rows[0] if rows else None)
if not s:
    fail('Sale not found.')
return out(s)
