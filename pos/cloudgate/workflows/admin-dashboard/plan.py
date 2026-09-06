user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'stats')
DONE = "x.Status IN ('completed','refunded','partially_refunded')"
days = clamp(d.get('days'), 1, 365, 30)
take = clamp(d.get('take'), 1, 50, 8)
if op == 'wallet-status':
    return "SELECT 1;"
if op == 'stats':
    return ("SELECT "
            "(SELECT COALESCE(SUM(TotalCents), 0) FROM sales x WHERE " + DONE + " AND date(CompletedAt) = date('now')) AS TodayCents, "
            "(SELECT COUNT(*) FROM sales x WHERE " + DONE + " AND date(CompletedAt) = date('now')) AS TodayCount, "
            "(SELECT COALESCE(SUM(TotalCents), 0) FROM sales x WHERE " + DONE + " AND CompletedAt >= datetime('now', '-7 days')) AS Week7Cents, "
            "(SELECT COALESCE(SUM(TotalCents), 0) FROM sales x WHERE " + DONE + " AND CompletedAt >= datetime('now', '-30 days')) AS Month30Cents, "
            "(SELECT COUNT(*) FROM sales x WHERE " + DONE + " AND CompletedAt >= datetime('now', '-30 days')) AS Month30Count, "
            "(SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND sp.Method = 'cash' AND date(x.CompletedAt) = date('now')) AS TodayCashCents, "
            "(SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND sp.Method = 'card' AND date(x.CompletedAt) = date('now')) AS TodayCardCents, "
            "(SELECT COALESCE(SUM(AmountCents), 0) FROM refunds WHERE date(CreatedAt) = date('now')) AS TodayRefundsCents, "
            "(SELECT COUNT(*) FROM shifts WHERE Status = 'open') AS OpenShifts, "
            "(SELECT COUNT(*) FROM sales WHERE Status = 'held') AS HeldSales, "
            "(SELECT COUNT(*) FROM products p WHERE p.Status = 'active') AS ActiveProducts, "
            "(SELECT COUNT(*) FROM products p WHERE p.TrackInventory = 1 AND p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST(Value AS REAL) FROM settings WHERE Key = 'low_stock_threshold'), 5)) AS LowStock, "
            "(SELECT COUNT(*) FROM products p WHERE p.TrackInventory = 1 AND p.StockQty <= 0) AS OutOfStock, "
            "(SELECT COALESCE(SUM(StockQty * COALESCE(CostCents, 0)), 0) FROM products WHERE TrackInventory = 1) AS StockValueCents, "
            "(SELECT COUNT(*) FROM customers) AS Customers, "
            "(SELECT Value FROM settings WHERE Key = 'currency') AS Currency;")
if op == 'by-hour':
    return ("SELECT strftime('%H', CompletedAt) AS Hour, COUNT(*) AS Sales, COALESCE(SUM(TotalCents), 0) AS RevenueCents FROM sales x WHERE " + DONE + " AND date(CompletedAt) = date('now') GROUP BY Hour ORDER BY Hour;")
if op == 'by-day':
    return ("SELECT date(CompletedAt) AS Day, COUNT(*) AS Sales, COALESCE(SUM(TotalCents), 0) AS RevenueCents FROM sales x WHERE " + DONE + " AND CompletedAt >= datetime('now', '-" + str(days) + " days') GROUP BY Day ORDER BY Day;")
if op == 'top':
    return ("SELECT i.ProductId, i.Name, SUM(i.Qty) AS UnitsSold, SUM(i.LineTotalCents) AS RevenueCents FROM sale_items i JOIN sales x ON x.Id = i.SaleId WHERE " + DONE + " AND x.CompletedAt >= datetime('now', '-" + str(days) + " days') GROUP BY i.ProductId, i.Name ORDER BY RevenueCents DESC LIMIT " + str(take) + ";")
if op == 'by-teller':
    return ("SELECT x.TellerUserId, x.TellerName, COUNT(*) AS Sales, COALESCE(SUM(x.TotalCents), 0) AS RevenueCents FROM sales x WHERE " + DONE + " AND x.CompletedAt >= datetime('now', '-" + str(days) + " days') GROUP BY x.TellerUserId, x.TellerName ORDER BY RevenueCents DESC LIMIT " + str(take) + ";")
if op == 'by-category':
    return ("SELECT COALESCE(c.Name, 'Uncategorised') AS Category, SUM(i.LineTotalCents) AS RevenueCents, SUM(i.Qty) AS Units FROM sale_items i JOIN sales x ON x.Id = i.SaleId LEFT JOIN products p ON p.Id = i.ProductId LEFT JOIN categories c ON c.Id = p.CategoryId WHERE " + DONE + " AND x.CompletedAt >= datetime('now', '-" + str(days) + " days') GROUP BY Category ORDER BY RevenueCents DESC;")
if op == 'by-method':
    return ("SELECT sp.Method, COUNT(*) AS Payments, COALESCE(SUM(sp.AmountCents), 0) AS AmountCents FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND x.CompletedAt >= datetime('now', '-" + str(days) + " days') GROUP BY sp.Method;")
if op == 'recent':
    return ("SELECT s.Id, s.Reference, s.Status, s.TellerName, s.TotalCents, s.Currency, s.CompletedAt, (SELECT COUNT(*) FROM sale_items i WHERE i.SaleId = s.Id) AS ItemCount, (SELECT group_concat(DISTINCT Method) FROM sale_payments p WHERE p.SaleId = s.Id AND p.Status = 'succeeded') AS Methods "
            "FROM sales s WHERE s.Status IN ('completed','refunded','partially_refunded') ORDER BY s.Id DESC LIMIT " + str(take) + ";")
fail('Unknown op.')
