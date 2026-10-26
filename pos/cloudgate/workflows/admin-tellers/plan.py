user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'list')
if op == 'list':
    return "SELECT t.TellerUserId, t.TellerName, t.TellerEmail, (SELECT COUNT_BIG(*) FROM shifts AS s WHERE s.TellerUserId = t.TellerUserId) AS ShiftCount, (SELECT MAX(s.OpenedAt) FROM shifts AS s WHERE s.TellerUserId = t.TellerUserId) AS LastShiftAt, (SELECT TOP 1 s.Status FROM shifts AS s WHERE s.TellerUserId = t.TellerUserId ORDER BY s.Id DESC) AS LastShiftStatus, (SELECT COUNT_BIG(*) FROM sales AS x WHERE x.TellerUserId = t.TellerUserId AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales AS x WHERE x.TellerUserId = t.TellerUserId AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesTotalCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds AS f JOIN sales AS x ON x.Id = f.SaleId WHERE x.TellerUserId = t.TellerUserId) AS RefundsCents FROM (SELECT TellerUserId AS TellerUserId, MAX(TellerName) AS TellerName, MAX(TellerEmail) AS TellerEmail FROM shifts GROUP BY TellerUserId) AS t ORDER BY LastShiftAt DESC;"
fail('Unknown op.')
