# POS Payment / ApplyRefund — record the wallet refund, restock and mark the sale.
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
d = body()
ref = load_json('''${WalletRefund}''', None)
if not sale or not isinstance(ref, dict):
    fail('The refund could not be created.')
amount = to_int('''${RefundAmount}'''.strip(), 0)
wanted = {to_int((x or {}).get('saleItemId'), 0): qty_of((x or {}).get('qty'), 0) for x in (d.get('items') or []) if isinstance(x, dict)}
lines = []
for it in sale['Items']:
    q_ = wanted.get(to_int(it.get('Id'), 0), 0)
    if q_ > 0:
        lines.append({'saleItemId': to_int(it.get('Id'), 0), 'productId': to_int(it.get('ProductId'), 0), 'qty': q_})
sid = str(sale['Id'])
parts = ["BEGIN;",
         "INSERT INTO refunds (SaleId, Reference, Method, AmountCents, Reason, ItemsJson, ConnectRefundId, ShiftId, CreatedBy) VALUES ("
         + sid + ", " + q(str(sale.get('Reference')) + '-RF') + ", 'card', " + str(amount) + ", " + qs(d.get('reason'), 300) + ", " + q(out(lines)) + ", "
         + qi(ref.get('Id') or ref.get('RefundId')) + ", " + (str(shift['Id']) if shift else 'NULL') + ", " + q(actor) + ");"]
for ln in lines:
    parts.append("UPDATE sale_items SET RefundedQty = RefundedQty + " + repr(float(ln['qty'])) + " WHERE Id = " + str(ln['saleItemId']) + ";")
    parts.append("UPDATE products SET StockQty = StockQty + " + repr(float(ln['qty'])) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(ln['productId']) + " AND TrackInventory = 1;")
    parts.append("INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT " + str(ln['productId']) + ", " + repr(float(ln['qty'])) + ", 'refund', " + q(str(sale.get('Reference'))) + ", 'Card refund', " + q(actor) + " WHERE EXISTS (SELECT 1 FROM products WHERE Id = " + str(ln['productId']) + " AND TrackInventory = 1);")
parts.append("UPDATE sales SET RefundedCents = RefundedCents + " + str(amount) + ", Status = CASE WHEN RefundedCents + " + str(amount) + " >= TotalCents THEN 'refunded' ELSE 'partially_refunded' END, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + sid + ";")
parts.append("INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) VALUES (" + sid + ", 'refund', 'Card refund', " + q(out(ref)) + ", " + q(actor) + ");")
parts.append("COMMIT;")
parts.append("SELECT s.*, r.Name AS RegisterName, (SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Sku', i.Sku, 'Barcode', i.Barcode, 'Unit', i.Unit,    'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'DiscountCents', i.DiscountCents, 'TaxRateBp', i.TaxRateBp, 'TaxCents', i.TaxCents,    'LineTotalCents', i.LineTotalCents, 'RefundedQty', i.RefundedQty, 'Position', i.Position))  FROM (SELECT * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) i) AS ItemsJson, (SELECT json_group_array(json_object('Id', p.Id, 'Method', p.Method, 'AmountCents', p.AmountCents, 'TenderedCents', p.TenderedCents,    'ChangeCents', p.ChangeCents, 'Status', p.Status, 'Reference', p.Reference, 'ConnectPaymentId', p.ConnectPaymentId, 'PaymentUrl', p.PaymentUrl, 'CreatedAt', p.CreatedAt))  FROM (SELECT * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) p) AS PaymentsJson, (SELECT json_group_array(json_object('Id', f.Id, 'Reference', f.Reference, 'Method', f.Method, 'AmountCents', f.AmountCents, 'Reason', f.Reason, 'Status', f.Status, 'CreatedAt', f.CreatedAt))  FROM (SELECT * FROM refunds WHERE SaleId = s.Id ORDER BY Id) f) AS RefundsJson, (SELECT json_group_object(Key, Value) FROM settings WHERE Key IN ('store_name','store_tagline','store_address','store_phone','support_email','store_url','store_logo_url','store_icon_url','currency','tax_rate_bp','prices_include_tax','tax_number','receipt_header','receipt_footer','payment_cash_enabled','payment_card_enabled','allow_negative_stock','require_shift','quick_cash_amounts','theme_primary','theme_secondary')) AS SettingsJson FROM sales s LEFT JOIN registers r ON r.Id = s.RegisterId WHERE {where} LIMIT 1;".format(where="s.Id = " + sid))
return "\n".join(parts)
