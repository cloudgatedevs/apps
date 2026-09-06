# POS Payment / SaveStart — record the pending wallet payment against the sale.
user = require_teller('''${IdpAuth}''')
actor = display_name(user)

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
pay = load_json('''${WalletCreate}''', None)
if not sale or not isinstance(pay, dict) or not pay.get('Id'):
    fail('The card payment could not be created.')
sid = str(sale['Id'])
return "\n".join([
    "INSERT INTO sale_payments (SaleId, Method, AmountCents, Status, Reference, ConnectPaymentId, PaymentUrl, IsProduction, RawJson, CreatedBy) VALUES ("
    + sid + ", 'card', " + str(to_int(pay.get('GrossAmount'), 0)) + ", 'pending', " + q('sale-' + str(sale.get('Reference')) + '-' + str(to_int(sale.get('CardAttempts'), 0) + 1)) + ", "
    + str(to_int(pay.get('Id'), 0)) + ", " + qs(pay.get('PaymentUrl'), 2048) + ", " + ('1' if pay.get('IsProduction') else '0') + ", " + q(out(pay)) + ", " + q(actor) + ");",
    "INSERT INTO sale_events (SaleId, Type, Message, CreatedBy) VALUES (" + sid + ", 'card_started', 'Card payment started', " + q(actor) + ");",
    "SELECT s.*, r.Name AS RegisterName, (SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Sku', i.Sku, 'Barcode', i.Barcode, 'Unit', i.Unit,    'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'DiscountCents', i.DiscountCents, 'TaxRateBp', i.TaxRateBp, 'TaxCents', i.TaxCents,    'LineTotalCents', i.LineTotalCents, 'RefundedQty', i.RefundedQty, 'Position', i.Position))  FROM (SELECT * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) i) AS ItemsJson, (SELECT json_group_array(json_object('Id', p.Id, 'Method', p.Method, 'AmountCents', p.AmountCents, 'TenderedCents', p.TenderedCents,    'ChangeCents', p.ChangeCents, 'Status', p.Status, 'Reference', p.Reference, 'ConnectPaymentId', p.ConnectPaymentId, 'PaymentUrl', p.PaymentUrl, 'CreatedAt', p.CreatedAt))  FROM (SELECT * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) p) AS PaymentsJson, (SELECT json_group_array(json_object('Id', f.Id, 'Reference', f.Reference, 'Method', f.Method, 'AmountCents', f.AmountCents, 'Reason', f.Reason, 'Status', f.Status, 'CreatedAt', f.CreatedAt))  FROM (SELECT * FROM refunds WHERE SaleId = s.Id ORDER BY Id) f) AS RefundsJson, (SELECT json_group_object(Key, Value) FROM settings WHERE Key IN ('store_name','store_tagline','store_address','store_phone','support_email','store_url','store_logo_url','store_icon_url','currency','tax_rate_bp','prices_include_tax','tax_number','receipt_header','receipt_footer','payment_cash_enabled','payment_card_enabled','allow_negative_stock','require_shift','quick_cash_amounts','theme_primary','theme_secondary')) AS SettingsJson FROM sales s LEFT JOIN registers r ON r.Id = s.RegisterId WHERE {where} LIMIT 1;".format(where="s.Id = " + sid),
])
