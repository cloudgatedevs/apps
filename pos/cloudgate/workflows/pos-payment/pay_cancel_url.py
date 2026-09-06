import urllib.parse as _up

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
d = body()
base = str(settings.get('store_url') or '').strip() or str(d.get('returnBase') or '').strip()
if not base.startswith('http://') and not base.startswith('https://'):
    fail('The app URL is not configured (Settings > Store > App URL).')
return base.rstrip('/') + '/pay/cancel?ref=' + _up.quote(str((sale or {}).get('Reference') or ''))
