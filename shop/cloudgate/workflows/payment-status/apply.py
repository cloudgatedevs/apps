# Payment Status / Apply — turn the wallet's answer into order state.
#   Succeeded (1)            -> order paid: sell reserved stock, write the ledger, convert the cart.
#   Failed (2) / Expired (3) -> order cancelled, reservation released; the cart stays open to retry.
#   Pending (0)              -> nothing changes.
# Every write is guarded by changes() so two concurrent polls cannot finalise twice.
rows = rows_of('''${LoadOrder}''')
pay = load_json('''${WalletGet}''', None)
if not rows or not isinstance(pay, dict):
    fail('Order or payment not found.')
o = rows[0]
oid = to_int(o.get('Id'), 0)
pid = to_int(o.get('PaymentRowId'), 0)
status = to_int(pay.get('Status'), 0)
raw = q(out(pay))

RELOAD = (
    "SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, "
    "o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.CreatedAt, o.ShippingAddressJson, "
    "p.Id AS PaymentRowId, p.ConnectPaymentId, p.Status AS PaymentRowStatus, p.PaymentUrl, "
    "(SELECT json_group_array(json_object('Title', i.Title, 'VariantTitle', i.VariantTitle, 'Sku', i.Sku, 'ImageUrl', i.ImageUrl, "
    "   'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
    " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson "
    "FROM orders o LEFT JOIN payments p ON p.Id = " + str(pid) + " WHERE o.Id = " + str(oid) + " LIMIT 1;"
)

if status == 1:
    return '\n'.join([
        "BEGIN;",
        "CREATE TEMP TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v INTEGER);", "DELETE FROM _ctx;",
        "UPDATE orders SET Status = 'paid', PaymentStatus = 'paid', PaidAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + " AND PaymentStatus <> 'paid';",
        "INSERT INTO _ctx (k, v) VALUES ('fin', changes());",
        "UPDATE payments SET Status = 'succeeded', PaidAt = CURRENT_TIMESTAMP, RawJson = " + raw + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(pid) + " AND (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "UPDATE product_variants SET "
        "  StockQty = MAX(0, StockQty - (SELECT COALESCE(SUM(Qty), 0) FROM order_items WHERE OrderId = " + str(oid) + " AND VariantId = product_variants.Id)), "
        "  ReservedQty = MAX(0, ReservedQty - (SELECT COALESCE(SUM(Qty), 0) FROM order_items WHERE OrderId = " + str(oid) + " AND VariantId = product_variants.Id)), "
        "  UpdatedAt = CURRENT_TIMESTAMP "
        "WHERE Id IN (SELECT VariantId FROM order_items WHERE OrderId = " + str(oid) + ") AND (SELECT v FROM _ctx WHERE k = 'fin') = 1 "
        "  AND EXISTS (SELECT 1 FROM products p WHERE p.Id = product_variants.ProductId AND p.TrackInventory = 1);",
        "INSERT INTO inventory_movements (VariantId, ProductId, Delta, Reason, Reference, Note, CreatedBy) "
        "SELECT i.VariantId, i.ProductId, -i.Qty, 'sale', " + q(str(o.get('Reference'))) + ", 'Order paid', 'system' "
        "FROM order_items i JOIN products p ON p.Id = i.ProductId WHERE i.OrderId = " + str(oid) + " AND p.TrackInventory = 1 AND (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "UPDATE carts SET Status = 'converted', UpdatedAt = CURRENT_TIMESTAMP WHERE Id = (SELECT CartId FROM orders WHERE Id = " + str(oid) + ") AND (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "DELETE FROM cart_items WHERE CartId = (SELECT CartId FROM orders WHERE Id = " + str(oid) + ") AND (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) SELECT " + str(oid) + ", 'paid', 'Payment received', " + raw + ", 'system' WHERE (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "COMMIT;",
        # JustPaid = 1 only on the run that flipped the order, so the receipt thread sends once.
        RELOAD.replace(" AS ItemsJson FROM orders o LEFT JOIN", " AS ItemsJson, (SELECT v FROM _ctx WHERE k = 'fin') AS JustPaid FROM orders o LEFT JOIN"),
        "DROP TABLE IF EXISTS _ctx;",
    ])

if status in (2, 3):
    label = 'failed' if status == 2 else 'expired'
    return '\n'.join([
        "BEGIN;",
        "CREATE TEMP TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v INTEGER);", "DELETE FROM _ctx;",
        "UPDATE orders SET Status = 'cancelled', PaymentStatus = 'failed', CancelledAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(oid) + " AND Status = 'pending';",
        "INSERT INTO _ctx (k, v) VALUES ('fin', changes());",
        "UPDATE payments SET Status = " + q(label) + ", RawJson = " + raw + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(pid) + ";",
        "UPDATE product_variants SET ReservedQty = MAX(0, ReservedQty - (SELECT COALESCE(SUM(Qty), 0) FROM order_items WHERE OrderId = " + str(oid) + " AND VariantId = product_variants.Id)), UpdatedAt = CURRENT_TIMESTAMP "
        "WHERE Id IN (SELECT VariantId FROM order_items WHERE OrderId = " + str(oid) + ") AND (SELECT v FROM _ctx WHERE k = 'fin') = 1 "
        "  AND EXISTS (SELECT 1 FROM products p WHERE p.Id = product_variants.ProductId AND p.TrackInventory = 1);",
        "INSERT INTO order_events (OrderId, Type, Message, DataJson, CreatedBy) SELECT " + str(oid) + ", 'payment_failed', 'Payment " + label + "; reservation released', " + raw + ", 'system' WHERE (SELECT v FROM _ctx WHERE k = 'fin') = 1;",
        "COMMIT;",
        RELOAD,
        "DROP TABLE IF EXISTS _ctx;",
    ])

# still pending: keep the latest raw snapshot for support, change nothing else
return "UPDATE payments SET RawJson = " + raw + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(pid) + ";\n" + RELOAD
