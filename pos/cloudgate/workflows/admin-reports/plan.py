user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'summary')
frm = q(str(d.get('from') or '2000-01-01')[:10] + ' 00:00:00')
to = q(str(d.get('to') or '2100-01-01')[:10] + ' 23:59:59')
DONE = "x.Status IN ('completed','refunded','partially_refunded') AND x.CompletedAt BETWEEN " + frm + " AND " + to
if op == 'summary':
    return ("SELECT date(x.CompletedAt) AS Day, COUNT(*) AS Sales, COALESCE(SUM(x.SubtotalCents), 0) AS SubtotalCents, COALESCE(SUM(x.DiscountCents), 0) AS DiscountCents, COALESCE(SUM(x.TaxCents), 0) AS TaxCents, COALESCE(SUM(x.TotalCents), 0) AS RevenueCents, "
            "COALESCE(SUM(x.RefundedCents), 0) AS RefundedCents, COALESCE(SUM((SELECT SUM(i.Qty * COALESCE(p.CostCents, 0)) FROM sale_items i LEFT JOIN products p ON p.Id = i.ProductId WHERE i.SaleId = x.Id)), 0) AS CostCents "
            "FROM sales x WHERE " + DONE + " GROUP BY Day ORDER BY Day;")
if op == 'products':
    return ("SELECT i.ProductId, i.Name, i.Sku, SUM(i.Qty) AS Units, SUM(i.LineTotalCents) AS RevenueCents, SUM(i.TaxCents) AS TaxCents, SUM(i.Qty * COALESCE(p.CostCents, 0)) AS CostCents, SUM(i.RefundedQty) AS RefundedUnits "
            "FROM sale_items i JOIN sales x ON x.Id = i.SaleId LEFT JOIN products p ON p.Id = i.ProductId WHERE " + DONE + " GROUP BY i.ProductId, i.Name, i.Sku ORDER BY RevenueCents DESC;")
if op == 'categories':
    return ("SELECT COALESCE(c.Name, 'Uncategorised') AS Category, SUM(i.Qty) AS Units, SUM(i.LineTotalCents) AS RevenueCents, SUM(i.Qty * COALESCE(p.CostCents, 0)) AS CostCents "
            "FROM sale_items i JOIN sales x ON x.Id = i.SaleId LEFT JOIN products p ON p.Id = i.ProductId LEFT JOIN categories c ON c.Id = p.CategoryId WHERE " + DONE + " GROUP BY Category ORDER BY RevenueCents DESC;")
if op == 'tellers':
    return ("SELECT x.TellerUserId, x.TellerName, COUNT(*) AS Sales, COALESCE(SUM(x.TotalCents), 0) AS RevenueCents, COALESCE(AVG(x.TotalCents), 0) AS AvgCents, COALESCE(SUM(x.RefundedCents), 0) AS RefundedCents "
            "FROM sales x WHERE " + DONE + " GROUP BY x.TellerUserId, x.TellerName ORDER BY RevenueCents DESC;")
if op == 'methods':
    return ("SELECT sp.Method, COUNT(*) AS Payments, COALESCE(SUM(sp.AmountCents), 0) AS AmountCents FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE sp.Status = 'succeeded' AND " + DONE + " GROUP BY sp.Method;")
if op == 'tax':
    return ("SELECT i.TaxRateBp, SUM(i.LineTotalCents) AS GrossCents, SUM(i.TaxCents) AS TaxCents, SUM(i.LineTotalCents - i.TaxCents) AS NetCents FROM sale_items i JOIN sales x ON x.Id = i.SaleId WHERE " + DONE + " GROUP BY i.TaxRateBp ORDER BY i.TaxRateBp;")
if op == 'z-reports':
    return ("SELECT s.*, r.Name AS RegisterName, (SELECT COUNT(*) FROM sales x WHERE x.ShiftId = s.Id AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesCount, "
            "(SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales x WHERE x.ShiftId = s.Id AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesTotalCents "
            "FROM shifts s JOIN registers r ON r.Id = s.RegisterId WHERE s.Status = 'closed' AND s.ClosedAt BETWEEN " + frm + " AND " + to + " ORDER BY s.Id DESC;")
fail('Unknown op.')
