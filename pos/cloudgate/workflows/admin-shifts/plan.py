user = require_admin(value('IdpAuth'))
actor = str(user.get('Email') or 'admin')
d = body()
op = op_of(d, 'list')
skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)
SUMMARY = "SELECT TOP 1 s.*, r.Name AS RegisterName, r.Location AS RegisterLocation, (SELECT COUNT_BIG(*) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesTotalCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') AS CashSalesCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'card' AND sp.Status = 'succeeded') AS CardSalesCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds AS f WHERE f.ShiftId = s.Id AND f.Method = 'cash') AS CashRefundsCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds AS f WHERE f.ShiftId = s.Id AND f.Method = 'card') AS CardRefundsCents, (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements AS m WHERE m.ShiftId = s.Id) AS CashMovementsCents, (SELECT m.Id AS [Id], m.Type AS [Type], m.AmountCents AS [AmountCents], m.Note AS [Note], m.CreatedBy AS [CreatedBy], m.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM cash_movements WHERE ShiftId = s.Id ORDER BY Id) AS m FOR JSON PATH, INCLUDE_NULL_VALUES) AS MovementsJson FROM shifts AS s JOIN registers AS r ON r.Id = s.RegisterId WHERE {where} ORDER BY s.Id DESC;"
if op == 'list':
    where = ['1 = 1']
    if d.get('status') in ('open', 'closed'):
        where.append('s.Status = ' + q(d.get('status')))
    if d.get('registerId'):
        where.append('s.RegisterId = ' + qi(d.get('registerId')))
    if d.get('from'):
        where.append('s.OpenedAt >= ' + q(str(d.get('from'))[:10] + ' 00:00:00'))
    if d.get('to'):
        where.append('s.OpenedAt <= ' + q(str(d.get('to'))[:10] + ' 23:59:59'))
    return "SELECT s.*, r.Name AS RegisterName, (SELECT COUNT_BIG(*) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesTotalCents, COUNT_BIG(*) OVER () AS TotalCount FROM shifts AS s JOIN registers AS r ON r.Id = s.RegisterId WHERE " + ' AND '.join(where) + ' ORDER BY s.Id DESC OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'get':
    return SUMMARY.replace('{where}', 's.Id = ' + qi(d.get('id'), 0))
if op == 'force-close':
    sid = qi(d.get('id'), 0)
    counted = cents(d.get('countedCents'), None)
    expected = "(shifts.OpeningFloatCents + (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE x.ShiftId = shifts.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') - (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f WHERE f.ShiftId = shifts.Id AND f.Method = 'cash') + (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements m WHERE m.ShiftId = shifts.Id))"
    return '\n'.join(['UPDATE shifts SET ExpectedCashCents = ' + expected + ' WHERE Id = ' + sid + " AND Status = 'open';", "UPDATE shifts SET Status = 'closed', CountedCashCents = " + (str(counted) if counted is not None else 'NULL') + ', DifferenceCents = ' + (str(counted) + ' - COALESCE(ExpectedCashCents, 0)' if counted is not None else 'NULL') + ', Note = ' + qs(d.get('note'), 500, default='Closed by administrator') + ', ClosedAt = SYSUTCDATETIME(), ClosedBy = ' + q(actor) + ' WHERE Id = ' + sid + " AND Status = 'open';", SUMMARY.replace('{where}', 's.Id = ' + sid)])
fail('Unknown op.')
