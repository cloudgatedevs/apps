user = require_teller(value('IdpAuth'))
uid = user_id_of(user)
actor = display_name(user)
d = body()
op = op_of(d, 'current')
SUMMARY = "SELECT TOP 1 s.*, r.Name AS RegisterName, r.Location AS RegisterLocation, (SELECT COUNT_BIG(*) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales AS x WHERE x.ShiftId = s.Id AND x.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesTotalCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') AS CashSalesCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments AS sp JOIN sales AS x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'card' AND sp.Status = 'succeeded') AS CardSalesCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds AS f WHERE f.ShiftId = s.Id AND f.Method = 'cash') AS CashRefundsCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds AS f WHERE f.ShiftId = s.Id AND f.Method = 'card') AS CardRefundsCents, (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements AS m WHERE m.ShiftId = s.Id) AS CashMovementsCents, (SELECT m.Id AS [Id], m.Type AS [Type], m.AmountCents AS [AmountCents], m.Note AS [Note], m.CreatedBy AS [CreatedBy], m.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM cash_movements WHERE ShiftId = s.Id ORDER BY Id) AS m FOR JSON PATH, INCLUDE_NULL_VALUES) AS MovementsJson FROM shifts AS s JOIN registers AS r ON r.Id = s.RegisterId WHERE {where} ORDER BY s.Id DESC;"
MINE_OPEN = 's.TellerUserId = ' + str(uid) + " AND s.Status = 'open'"
if op == 'registers':
    return "SELECT r.Id, r.Name, r.Location, (SELECT TOP 1 s.Id FROM shifts AS s WHERE s.RegisterId = r.Id AND s.Status = 'open') AS OpenShiftId, (SELECT TOP 1 s.TellerName FROM shifts AS s WHERE s.RegisterId = r.Id AND s.Status = 'open') AS OpenShiftTeller, (SELECT TOP 1 s.TellerUserId FROM shifts AS s WHERE s.RegisterId = r.Id AND s.Status = 'open') AS OpenShiftUserId FROM registers AS r WHERE r.IsActive = 1 ORDER BY r.Name;"
if op == 'current':
    return SUMMARY.replace('{where}', MINE_OPEN)
if op == 'open':
    rid = to_int(d.get('registerId'), 0)
    flt = cents(d.get('floatCents', d.get('float')), 0) or 0
    if rid <= 0:
        fail('Choose a register.')
    if flt < 0:
        fail('The opening float cannot be negative.')
    return '\n'.join(['INSERT INTO shifts (RegisterId, TellerUserId, TellerName, TellerEmail, OpeningFloatCents) SELECT ' + str(rid) + ', ' + str(uid) + ', ' + q(actor) + ', ' + qs(user.get('Email'), 200) + ', ' + str(flt) + ' WHERE EXISTS(SELECT 1 FROM registers WHERE Id = ' + str(rid) + " AND IsActive = 1) AND NOT EXISTS(SELECT 1 FROM shifts WHERE Status = 'open' AND (TellerUserId = " + str(uid) + ' OR RegisterId = ' + str(rid) + '));', SUMMARY.replace('{where}', MINE_OPEN)])
if op == 'movement':
    kind = str(d.get('type') or '').strip().lower()
    amt = cents(d.get('amountCents', d.get('amount')), 0) or 0
    if kind not in ('payin', 'payout', 'drop'):
        fail('Movement type must be payin, payout or drop.')
    if amt <= 0:
        fail('Enter an amount.')
    return '\n'.join(['INSERT INTO cash_movements (ShiftId, Type, AmountCents, Note, CreatedBy) SELECT s.Id, ' + q(kind) + ', ' + str(amt) + ', ' + qs(d.get('note'), 300) + ', ' + q(actor) + ' FROM shifts AS s WHERE ' + MINE_OPEN + ';', SUMMARY.replace('{where}', MINE_OPEN)])
if op == 'close':
    counted = cents(d.get('countedCents', d.get('counted')), None)
    if counted is None or counted < 0:
        fail('Enter the counted cash.')
    expected = "(s.OpeningFloatCents + (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') - (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f WHERE f.ShiftId = s.Id AND f.Method = 'cash') + (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements m WHERE m.ShiftId = s.Id))"
    return '\n'.join(['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', "INSERT INTO #ctx (k, v) SELECT TOP 1 'sid', s.Id FROM shifts AS s WHERE " + MINE_OPEN + ';', 'UPDATE shifts SET ExpectedCashCents = ' + expected.replace('s.Id', 'shifts.Id').replace('s.OpeningFloatCents', 'shifts.OpeningFloatCents') + " WHERE Id = (SELECT v FROM #ctx WHERE k = 'sid');", "UPDATE shifts SET Status = 'closed', CountedCashCents = " + str(counted) + ', DifferenceCents = ' + str(counted) + ' - COALESCE(ExpectedCashCents, 0), Note = ' + qs(d.get('note'), 500) + ', ClosedAt = SYSUTCDATETIME(), ClosedBy = ' + q(actor) + " WHERE Id = (SELECT v FROM #ctx WHERE k = 'sid') AND Status = 'open';", 'COMMIT TRANSACTION;', SUMMARY.replace('{where}', "s.Id = (SELECT v FROM #ctx WHERE k = 'sid')"), 'DROP TABLE IF EXISTS #ctx;'])
if op == 'summary':
    sid = to_int(d.get('shiftId'), 0)
    return SUMMARY.replace('{where}', 's.Id = ' + str(sid) + ' AND s.TellerUserId = ' + str(uid))
fail('Unknown op.')
