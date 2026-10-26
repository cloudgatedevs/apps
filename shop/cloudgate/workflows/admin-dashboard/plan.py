user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'stats')
PAID = "('paid','processing','shipped','delivered')"
if op == 'stats':
    return "SELECT (SELECT COUNT_BIG(*) FROM products WHERE Status = 'active') AS ActiveProducts, (SELECT COUNT_BIG(*) FROM products WHERE Status = 'draft') AS DraftProducts, (SELECT COUNT_BIG(*) FROM product_variants AS v JOIN products AS p ON p.Id = v.ProductId WHERE v.IsActive = 1 AND p.Status = 'active' AND p.TrackInventory = 1 AND v.StockQty <= v.LowStockThreshold) AS LowStockVariants, (SELECT COUNT_BIG(*) FROM product_variants AS v JOIN products AS p ON p.Id = v.ProductId WHERE v.IsActive = 1 AND p.Status = 'active' AND p.TrackInventory = 1 AND v.StockQty - v.ReservedQty <= 0) AS OutOfStockVariants, (SELECT COALESCE(SUM(v.StockQty * COALESCE(v.CostCents, p.CostCents, 0)), 0) FROM product_variants AS v JOIN products AS p ON p.Id = v.ProductId WHERE v.IsActive = 1) AS StockValueCents, (SELECT COUNT_BIG(*) FROM orders) AS Orders, (SELECT COUNT_BIG(*) FROM orders WHERE Status IN " + PAID + ' AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Orders30d, (SELECT COUNT_BIG(*) FROM orders WHERE Status IN ' + PAID + ' AND CreatedAt >= CONVERT(DATE, SYSUTCDATETIME())) AS OrdersToday, (SELECT COALESCE(SUM(TotalCents), 0) FROM orders WHERE Status IN ' + PAID + ' AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Revenue30dCents, (SELECT COALESCE(SUM(TotalCents), 0) FROM orders WHERE Status IN ' + PAID + " AND CreatedAt >= CONVERT(DATE, SYSUTCDATETIME())) AS RevenueTodayCents, (SELECT COUNT_BIG(*) FROM orders WHERE Status = 'pending') AS PendingOrders, (SELECT COUNT_BIG(*) FROM orders WHERE Status = 'paid' AND FulfillmentStatus = 'unfulfilled') AS AwaitingFulfillment, (SELECT COUNT_BIG(*) FROM customers) AS Customers, (SELECT COUNT_BIG(*) FROM carts WHERE Status = 'open' AND UpdatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS OpenCarts7d, (SELECT [Value] FROM settings WHERE [Key] = 'currency') AS Currency;"
if op == 'recent-orders':
    take = clamp(d.get('take'), 1, 50, 10)
    return 'SELECT TOP (' + str(take) + ') o.Id, o.Reference, o.Email, o.Name, o.Surname, o.TotalCents, o.Currency, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.CreatedAt, (SELECT COUNT_BIG(*) FROM order_items AS i WHERE i.OrderId = o.Id) AS Items FROM orders AS o ORDER BY o.CreatedAt DESC, o.Id DESC;'
if op == 'sales-by-day':
    days = clamp(d.get('days'), 1, 365, 30)
    return 'SELECT CONVERT(DATE, CreatedAt) AS Day, COUNT_BIG(*) AS Orders, COALESCE(SUM(TotalCents), 0) AS RevenueCents FROM orders WHERE Status IN ' + PAID + ' AND CreatedAt >= DATEADD(DAY, -' + str(days) + ', SYSUTCDATETIME()) GROUP BY CONVERT(DATE, CreatedAt) ORDER BY Day;'
if op == 'top-products':
    days = clamp(d.get('days'), 1, 365, 30)
    take = clamp(d.get('take'), 1, 50, 10)
    return 'SELECT TOP (' + str(take) + ') i.ProductId, i.Title, SUM(i.Qty) AS UnitsSold, SUM(i.LineTotalCents) AS RevenueCents FROM order_items AS i JOIN orders AS o ON o.Id = i.OrderId WHERE o.Status IN ' + PAID + ' AND o.CreatedAt >= DATEADD(DAY, -' + str(days) + ', SYSUTCDATETIME()) GROUP BY i.ProductId, i.Title ORDER BY RevenueCents DESC;'
fail('Unknown op: ' + op)
