user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'stats')
DONE = "x.Status IN ('completed','refunded','partially_refunded')"
days = clamp(d.get('days'), 1, 365, 30)
take = clamp(d.get('take'), 1, 50, 8)
if op == 'wallet-status':
    return 'SELECT 1;'
if op == 'stats':
    return 'SELECT (SELECT COALESCE(SUM(TotalCents), 0) FROM sales AS x WHERE ' + DONE + ' AND CONVERT(DATE, CompletedAt) = CONVERT(DATE, SYSUTCDATETIME())) AS TodayCents, (SELECT COUNT_BIG(*) FROM sales AS x WHERE ' + DONE + ' AND CONVERT(DATE, CompletedAt) = CONVERT(DATE, SYSUTCDATETIME())) AS TodayCount, (SELECT COALESCE(SUM(TotalCents), 0) FROM sales AS x WHERE ' + DONE + ' AND CompletedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS Week7Cents, (SELECT COALESCE(SUM(TotalCents), 0) FROM sales AS x WHERE ' + DONE + ' AND CompletedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Month30Cents, (SELECT COUNT_BIG(*) FROM sales AS x WHERE ' + DONE + " AND CompletedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Month30Count, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND sp.Method = 'cash' AND CONVERT(DATE, x.CompletedAt) = CONVERT(DATE, SYSUTCDATETIME())) AS TodayCashCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND sp.Method = 'card' AND CONVERT(DATE, x.CompletedAt) = CONVERT(DATE, SYSUTCDATETIME())) AS TodayCardCents, (SELECT COALESCE(SUM(AmountCents), 0) FROM refunds WHERE CONVERT(DATE, CreatedAt) = CONVERT(DATE, SYSUTCDATETIME())) AS TodayRefundsCents, (SELECT COUNT_BIG(*) FROM shifts WHERE Status = 'open') AS OpenShifts, (SELECT COUNT_BIG(*) FROM sales WHERE Status = 'held') AS HeldSales, (SELECT COUNT_BIG(*) FROM products AS p WHERE p.Status = 'active') AS ActiveProducts, (SELECT COUNT_BIG(*) FROM products AS p WHERE p.TrackInventory = 1 AND p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS FLOAT) FROM settings WHERE [Key] = 'low_stock_threshold'), 5)) AS LowStock, (SELECT COUNT_BIG(*) FROM products AS p WHERE p.TrackInventory = 1 AND p.StockQty <= 0) AS OutOfStock, (SELECT COALESCE(SUM(StockQty * COALESCE(CostCents, 0)), 0) FROM products WHERE TrackInventory = 1) AS StockValueCents, (SELECT COUNT_BIG(*) FROM customers) AS Customers, (SELECT [Value] FROM settings WHERE [Key] = 'currency') AS Currency;"
if op == 'by-hour':
    return "SELECT FORMAT(CAST(CompletedAt AS DATETIME2), 'HH') AS Hour, COUNT_BIG(*) AS Sales, COALESCE(SUM(TotalCents), 0) AS RevenueCents FROM sales AS x WHERE " + DONE + " AND CONVERT(DATE, CompletedAt) = CONVERT(DATE, SYSUTCDATETIME()) GROUP BY FORMAT(CAST(CompletedAt AS DATETIME2), 'HH') ORDER BY Hour;"
if op == 'by-day':
    return 'SELECT CONVERT(DATE, CompletedAt) AS Day, COUNT_BIG(*) AS Sales, COALESCE(SUM(TotalCents), 0) AS RevenueCents FROM sales AS x WHERE ' + DONE + ' AND CompletedAt >= DATEADD(DAY, -' + str(days) + ', SYSUTCDATETIME()) GROUP BY CONVERT(DATE, CompletedAt) ORDER BY Day;'
if op == 'top':
    return 'SELECT TOP (' + str(take) + ') i.ProductId, i.Name, SUM(i.Qty) AS UnitsSold, SUM(i.LineTotalCents) AS RevenueCents FROM sale_items AS i JOIN sales AS x ON x.Id = i.SaleId WHERE ' + DONE + ' AND x.CompletedAt >= DATEADD(DAY, -' + str(days) + ', SYSUTCDATETIME()) GROUP BY i.ProductId, i.Name ORDER BY RevenueCents DESC;'
if op == 'by-teller':
    return 'SELECT TOP (' + str(take) + ') x.TellerUserId, x.TellerName, COUNT_BIG(*) AS Sales, COALESCE(SUM(x.TotalCents), 0) AS RevenueCents FROM sales AS x WHERE ' + DONE + ' AND x.CompletedAt >= DATEADD(DAY, -' + str(days) + ', SYSUTCDATETIME()) GROUP BY x.TellerUserId, x.TellerName ORDER BY RevenueCents DESC;'
if op == 'by-category':
    return "SELECT COALESCE(c.Name, 'Uncategorised') AS Category, SUM(i.LineTotalCents) AS RevenueCents, SUM(i.Qty) AS Units FROM sale_items AS i JOIN sales AS x ON x.Id = i.SaleId LEFT JOIN products AS p ON p.Id = i.ProductId LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE " + DONE + ' AND x.CompletedAt >= DATEADD(DAY, -' + str(days) + ", SYSUTCDATETIME()) GROUP BY COALESCE(c.Name, 'Uncategorised') ORDER BY RevenueCents DESC;"
if op == 'by-method':
    return "SELECT sp.Method, COUNT_BIG(*) AS Payments, COALESCE(SUM(sp.AmountCents), 0) AS AmountCents FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND x.CompletedAt >= DATEADD(DAY, -" + str(days) + ', SYSUTCDATETIME()) GROUP BY sp.Method;'
if op == 'recent':
    return 'SELECT TOP (' + str(take) + ") s.Id, s.Reference, s.Status, s.TellerName, s.TotalCents, s.Currency, s.CompletedAt, (SELECT COUNT_BIG(*) FROM sale_items AS i WHERE i.SaleId = s.Id) AS ItemCount, (SELECT STRING_AGG(Method, ',') FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Status = 'succeeded') AS Methods FROM sales AS s WHERE s.Status IN ('completed', 'refunded', 'partially_refunded') ORDER BY s.Id DESC;"
fail('Unknown op.')
