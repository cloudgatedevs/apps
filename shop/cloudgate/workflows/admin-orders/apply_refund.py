# Admin Orders / ApplyRefund — record the refund on the shop side and optionally restock.
user = require_admin('''${IdpAuth}''')
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
rows = rows_of('''${Run}''')
res = load_json('''${WalletRefund}''', None)
if not rows or not isinstance(res, dict):
    fail('The refund could not be recorded.')
r = rows[0]
oid = to_int(r.get('Id'), 0)
pid = to_int(r.get('PaymentRowId'), 0)
ref = str(r.get('Reference') or '')
amount = to_int(res.get('Amount'), 0)
total_refunded = to_int(r.get('RefundedCents'), 0) + amount
full = total_refunded >= to_int(r.get('AmountCents'), 0)
restock = qb(d.get('restock')) == '1'
reason = str(d.get('reason') or '').strip()[:500]
raw = q(out(res))
pay_status = 'refunded' if full else 'partially_refunded'

# Same detail query as plan.py detail_sql so the response shape matches get/update.
RELOAD = (
    "SELECT o.*, "
    "(SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'VariantId', i.VariantId, 'Sku', i.Sku, 'Title', i.Title, "
    "   'VariantTitle', i.VariantTitle, 'ImageUrl', i.ImageUrl, 'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
    " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson, "
    "(SELECT json_group_array(json_object('Id', e.Id, 'Type', e.Type, 'Message', e.Message, "
    "   'Data', CASE WHEN json_valid(e.DataJson) THEN json(e.DataJson) ELSE NULL END, 'CreatedBy', e.CreatedBy, 'CreatedAt', e.CreatedAt)) "
    " FROM (SELECT * FROM order_events WHERE OrderId = o.Id ORDER BY CreatedAt DESC, Id DESC) e) AS EventsJson, "
    "(SELECT json_group_array(json_object('Id', p.Id, 'Provider', p.Provider, 'ConnectPaymentId', p.ConnectPaymentId, 'PaymentUrl', p.PaymentUrl, "
    "   'AmountCents', p.AmountCents, 'Currency', p.Currency, 'Status', p.Status, 'RefundedCents', p.RefundedCents, 'IsProduction', p.IsProduction, "
    "   'PaidAt', p.PaidAt, 'CreatedAt', p.CreatedAt)) "
    " FROM (SELECT * FROM payments WHERE OrderId = o.Id ORDER BY Id DESC) p) AS PaymentsJson "
    "FROM orders o WHERE o.Id = " + str(oid) + " LIMIT 1;"
)

parts = [
    "BEGIN;",
    "UPDATE payments SET RefundedCents = RefundedCents + " + str(amount) + ", Status = " + q(pay_status) + ", RawJson = " + raw + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(pid) + ";",
    "UPDATE orders SET PaymentStatus = " + q(pay_status) + (", Status = 'refunded'" if full else "") + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + ";",
]
if restock:
    # Restock once per order, whatever the number of partial refunds.
    guard = "AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.Reference = " + q(ref) + " AND m.Reason = 'refund')"
    parts += [
        "UPDATE product_variants SET StockQty = StockQty + (SELECT COALESCE(SUM(Qty), 0) FROM order_items WHERE OrderId = " + str(oid) + " AND VariantId = product_variants.Id), UpdatedAt = CURRENT_TIMESTAMP "
        "WHERE Id IN (SELECT VariantId FROM order_items WHERE OrderId = " + str(oid) + ") "
        "  AND EXISTS (SELECT 1 FROM products p WHERE p.Id = product_variants.ProductId AND p.TrackInventory = 1) " + guard + ";",
        "INSERT INTO inventory_movements (VariantId, ProductId, Delta, Reason, Reference, Note, CreatedBy) "
        "SELECT i.VariantId, i.ProductId, i.Qty, 'refund', " + q(ref) + ", 'Restocked on refund', " + q(actor) + " "
        "FROM order_items i JOIN products p ON p.Id = i.ProductId WHERE i.OrderId = " + str(oid) + " AND p.TrackInventory = 1 " + guard + ";",
    ]
message = 'Refunded ' + str(amount) + ' cents' + (' (full)' if full else ' (partial)') + (', restocked' if restock else '') + (': ' + reason if reason else '')
parts += [
    "INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) VALUES (" + str(oid) + ", 'refund', " + q(message) + ", " + raw + ", " + q(actor) + ");",
    "COMMIT;",
    RELOAD,
]
return '\n'.join(parts)
