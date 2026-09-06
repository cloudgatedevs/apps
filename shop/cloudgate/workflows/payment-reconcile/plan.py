# Payment Reconcile / Plan — expire stale orders in bulk, then pick one pending payment to re-read.
#
# Runs on the Cloudgate schedule (and may be called manually). The same Apply script as
# payment-status handles the wallet answer, so the node after WalletGet must be named "LoadOrder"
# here as well.
NO_SESSION_MINUTES = 30      # order created but the wallet session was never created
SESSION_EXPIRY_HOURS = 24    # hosted checkout sessions expire after a day
RECHECK_AFTER_MINUTES = 2    # give the customer time to come back through the return page first

RELEASE = (
    "UPDATE product_variants SET ReservedQty = MAX(0, ReservedQty - (SELECT COALESCE(SUM(i.Qty), 0) FROM order_items i "
    "  WHERE i.VariantId = product_variants.Id AND i.OrderId IN (SELECT Id FROM _stale))), UpdatedAt = CURRENT_TIMESTAMP "
    "WHERE Id IN (SELECT VariantId FROM order_items WHERE OrderId IN (SELECT Id FROM _stale)) "
    "  AND EXISTS (SELECT 1 FROM products p WHERE p.Id = product_variants.ProductId AND p.TrackInventory = 1);"
)

parts = [
    "BEGIN;",
    "CREATE TEMP TABLE IF NOT EXISTS _stale (Id INTEGER PRIMARY KEY);", "DELETE FROM _stale;",
    # (a) never reached the payment page
    "INSERT INTO _stale SELECT Id FROM orders WHERE Status = 'pending' AND PaymentStatus = 'unpaid' AND CreatedAt < datetime('now', '-" + str(NO_SESSION_MINUTES) + " minutes');",
    # (b) payment session expired without a decision
    "INSERT OR IGNORE INTO _stale SELECT o.Id FROM orders o WHERE o.Status = 'pending' AND o.PaymentStatus = 'pending' AND o.CreatedAt < datetime('now', '-" + str(SESSION_EXPIRY_HOURS) + " hours');",
    RELEASE,
    "UPDATE payments SET Status = 'expired', UpdatedAt = CURRENT_TIMESTAMP WHERE OrderId IN (SELECT Id FROM _stale) AND Status = 'pending';",
    "INSERT INTO order_events (OrderId, Type, Message, CreatedBy) SELECT Id, 'status', 'Cancelled by reconciliation: payment not completed in time; reservation released', 'system' FROM _stale;",
    "UPDATE orders SET Status = 'cancelled', PaymentStatus = 'failed', CancelledAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE Id IN (SELECT Id FROM _stale);",
    "COMMIT;",
    "DROP TABLE IF EXISTS _stale;",
    # candidate to re-read: same shape as payment-status LoadOrder so Apply can reuse it
    "SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, "
    "o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.CreatedAt, o.ShippingAddressJson, "
    "p.Id AS PaymentRowId, p.ConnectPaymentId, p.Status AS PaymentRowStatus, p.PaymentUrl, "
    "(SELECT json_group_array(json_object('Title', i.Title, 'VariantTitle', i.VariantTitle, 'Sku', i.Sku, 'ImageUrl', i.ImageUrl, "
    "   'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
    " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson "
    "FROM orders o JOIN payments p ON p.Id = (SELECT Id FROM payments WHERE OrderId = o.Id ORDER BY Id DESC LIMIT 1) "
    "WHERE o.Status = 'pending' AND o.PaymentStatus = 'pending' AND p.Status = 'pending' AND p.ConnectPaymentId IS NOT NULL "
    "  AND o.CreatedAt < datetime('now', '-" + str(RECHECK_AFTER_MINUTES) + " minutes') "
    "ORDER BY p.UpdatedAt ASC, o.Id ASC LIMIT 1;",
]
return '\n'.join(parts)
