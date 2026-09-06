# Admin Dashboard — build SQL. Requires IdP admin.
user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'stats')

PAID = "('paid','processing','shipped','delivered')"

if op == 'stats':
    return (
        "SELECT "
        "(SELECT COUNT(*) FROM products WHERE Status = 'active') AS ActiveProducts, "
        "(SELECT COUNT(*) FROM products WHERE Status = 'draft') AS DraftProducts, "
        "(SELECT COUNT(*) FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.IsActive = 1 AND p.Status = 'active' AND p.TrackInventory = 1 AND v.StockQty <= v.LowStockThreshold) AS LowStockVariants, "
        "(SELECT COUNT(*) FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.IsActive = 1 AND p.Status = 'active' AND p.TrackInventory = 1 AND v.StockQty - v.ReservedQty <= 0) AS OutOfStockVariants, "
        "(SELECT COALESCE(SUM(v.StockQty * COALESCE(v.CostCents, p.CostCents, 0)), 0) FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.IsActive = 1) AS StockValueCents, "
        "(SELECT COUNT(*) FROM orders) AS Orders, "
        "(SELECT COUNT(*) FROM orders WHERE Status IN " + PAID + " AND CreatedAt >= datetime('now','-30 days')) AS Orders30d, "
        "(SELECT COUNT(*) FROM orders WHERE Status IN " + PAID + " AND CreatedAt >= datetime('now','start of day')) AS OrdersToday, "
        "(SELECT COALESCE(SUM(TotalCents), 0) FROM orders WHERE Status IN " + PAID + " AND CreatedAt >= datetime('now','-30 days')) AS Revenue30dCents, "
        "(SELECT COALESCE(SUM(TotalCents), 0) FROM orders WHERE Status IN " + PAID + " AND CreatedAt >= datetime('now','start of day')) AS RevenueTodayCents, "
        "(SELECT COUNT(*) FROM orders WHERE Status = 'pending') AS PendingOrders, "
        "(SELECT COUNT(*) FROM orders WHERE Status = 'paid' AND FulfillmentStatus = 'unfulfilled') AS AwaitingFulfillment, "
        "(SELECT COUNT(*) FROM customers) AS Customers, "
        "(SELECT COUNT(*) FROM carts WHERE Status = 'open' AND UpdatedAt >= datetime('now','-7 days')) AS OpenCarts7d, "
        "(SELECT Value FROM settings WHERE Key = 'currency') AS Currency;"
    )

if op == 'recent-orders':
    take = clamp(d.get('take'), 1, 50, 10)
    return ("SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.TotalCents, o.Currency, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.CreatedAt, "
            "(SELECT COUNT(*) FROM order_items i WHERE i.OrderId = o.Id) AS Items "
            "FROM orders o ORDER BY o.CreatedAt DESC, o.Id DESC LIMIT " + str(take) + ";")

if op == 'sales-by-day':
    days = clamp(d.get('days'), 1, 365, 30)
    return ("SELECT date(CreatedAt) AS Day, COUNT(*) AS Orders, COALESCE(SUM(TotalCents), 0) AS RevenueCents "
            "FROM orders WHERE Status IN " + PAID + " AND CreatedAt >= datetime('now', '-" + str(days) + " days') "
            "GROUP BY date(CreatedAt) ORDER BY Day;")

if op == 'top-products':
    days = clamp(d.get('days'), 1, 365, 30)
    take = clamp(d.get('take'), 1, 50, 10)
    return ("SELECT i.ProductId, i.Title, SUM(i.Qty) AS UnitsSold, SUM(i.LineTotalCents) AS RevenueCents "
            "FROM order_items i JOIN orders o ON o.Id = i.OrderId "
            "WHERE o.Status IN " + PAID + " AND o.CreatedAt >= datetime('now', '-" + str(days) + " days') "
            "GROUP BY i.ProductId, i.Title ORDER BY RevenueCents DESC LIMIT " + str(take) + ";")

fail('Unknown op: ' + op)
