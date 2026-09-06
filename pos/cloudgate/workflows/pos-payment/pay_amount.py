# POS Payment / PayAmount — the outstanding amount in minor units.

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
if not sale:
    fail('Sale not found.')
if sale.get('Status') not in ('open',):
    fail('This sale is not open for payment.')
if str(settings.get('payment_card_enabled') or '1') != '1':
    fail('Card payments are switched off in Settings.')
if sale.get('Pending'):
    fail('A card payment is already in progress for this sale. Cancel it first to start another.')
outstanding = to_int(sale.get('TotalCents'), 0) - to_int(sale.get('PaidCents'), 0)
if outstanding <= 0:
    fail('Nothing outstanding on this sale.')
return str(outstanding)
