user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
if op == 'list':
    return ("SELECT t.TellerUserId, t.TellerName, t.TellerEmail, "
            "(SELECT COUNT(*) FROM shifts s WHERE s.TellerUserId = t.TellerUserId) AS ShiftCount, "
            "(SELECT MAX(s.OpenedAt) FROM shifts s WHERE s.TellerUserId = t.TellerUserId) AS LastShiftAt, "
            "(SELECT s.Status FROM shifts s WHERE s.TellerUserId = t.TellerUserId ORDER BY s.Id DESC LIMIT 1) AS LastShiftStatus, "
            "(SELECT COUNT(*) FROM sales x WHERE x.TellerUserId = t.TellerUserId AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesCount, "
            "(SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales x WHERE x.TellerUserId = t.TellerUserId AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesTotalCents, "
            "(SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f JOIN sales x ON x.Id = f.SaleId WHERE x.TellerUserId = t.TellerUserId) AS RefundsCents "
            "FROM (SELECT TellerUserId, MAX(TellerName) AS TellerName, MAX(TellerEmail) AS TellerEmail FROM shifts GROUP BY TellerUserId) t ORDER BY LastShiftAt DESC;")
fail('Unknown op.')
