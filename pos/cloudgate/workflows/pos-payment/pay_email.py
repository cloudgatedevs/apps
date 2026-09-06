# The hosted payment page needs an email: the customer's when known, else the store's support address, else the teller's.
user = require_teller('''${IdpAuth}''')

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
email = str((sale or {}).get('CustomerEmail') or settings.get('support_email') or user.get('Email') or '').strip()
if not email:
    fail('Set a support email under Settings so card payments can be created.')
return email
