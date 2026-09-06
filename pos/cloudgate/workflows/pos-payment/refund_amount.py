# Amount to refund, from the chosen items (server-priced), capped at what is still refundable.

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
wanted = {to_int((x or {}).get('saleItemId'), 0): qty_of((x or {}).get('qty'), 0) for x in (d.get('items') or []) if isinstance(x, dict)}
amount = 0
for it in (sale or {}).get('Items') or []:
    q_ = wanted.get(to_int(it.get('Id'), 0), 0)
    if q_ <= 0:
        continue
    if q_ > float(it.get('Qty') or 0) - float(it.get('RefundedQty') or 0) + 1e-9:
        fail('Refund quantity exceeds what was sold for ' + str(it.get('Name')) + '.')
    amount += money_round(to_int(it.get('LineTotalCents'), 0) * q_ / float(it.get('Qty') or 1))
if amount <= 0:
    fail('Choose the items to refund.')
amount = min(amount, to_int(sale.get('TotalCents'), 0) - to_int(sale.get('RefundedCents'), 0), to_int((sale.get('Succeeded') or {}).get('AmountCents'), 0))
if amount <= 0:
    fail('Nothing left to refund on this sale.')
return str(amount)
