# POS Shift / Plan — open, run and cash up a register session.
user = require_teller('''${IdpAuth}''')
uid = user_id_of(user)
actor = display_name(user)
d = body()
op = op_of(d, 'current')
SUMMARY = "SELECT s.*, r.Name AS RegisterName, r.Location AS RegisterLocation, (SELECT COUNT(*) FROM sales x WHERE x.ShiftId = s.Id AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(x.TotalCents), 0) FROM sales x WHERE x.ShiftId = s.Id AND x.Status IN ('completed','refunded','partially_refunded')) AS SalesTotalCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') AS CashSalesCents, (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'card' AND sp.Status = 'succeeded') AS CardSalesCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f WHERE f.ShiftId = s.Id AND f.Method = 'cash') AS CashRefundsCents, (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f WHERE f.ShiftId = s.Id AND f.Method = 'card') AS CardRefundsCents, (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements m WHERE m.ShiftId = s.Id) AS CashMovementsCents, (SELECT json_group_array(json_object('Id', m.Id, 'Type', m.Type, 'AmountCents', m.AmountCents, 'Note', m.Note, 'CreatedBy', m.CreatedBy, 'CreatedAt', m.CreatedAt))  FROM (SELECT * FROM cash_movements WHERE ShiftId = s.Id ORDER BY Id) m) AS MovementsJson FROM shifts s JOIN registers r ON r.Id = s.RegisterId WHERE {where} ORDER BY s.Id DESC LIMIT 1;"
MINE_OPEN = "s.TellerUserId = " + str(uid) + " AND s.Status = 'open'"

if op == 'registers':
    return ("SELECT r.Id, r.Name, r.Location, "
            "(SELECT s.Id FROM shifts s WHERE s.RegisterId = r.Id AND s.Status = 'open' LIMIT 1) AS OpenShiftId, "
            "(SELECT s.TellerName FROM shifts s WHERE s.RegisterId = r.Id AND s.Status = 'open' LIMIT 1) AS OpenShiftTeller, "
            "(SELECT s.TellerUserId FROM shifts s WHERE s.RegisterId = r.Id AND s.Status = 'open' LIMIT 1) AS OpenShiftUserId "
            "FROM registers r WHERE r.IsActive = 1 ORDER BY r.Name;")

if op == 'current':
    return SUMMARY.format(where=MINE_OPEN)

if op == 'open':
    rid = to_int(d.get('registerId'), 0)
    flt = cents(d.get('floatCents', d.get('float')), 0) or 0
    if rid <= 0:
        fail('Choose a register.')
    if flt < 0:
        fail('The opening float cannot be negative.')
    # One open shift per teller and per register; the guarded INSERT makes both atomic.
    return "\n".join([
        "INSERT INTO shifts (RegisterId, TellerUserId, TellerName, TellerEmail, OpeningFloatCents) "
        "SELECT " + str(rid) + ", " + str(uid) + ", " + q(actor) + ", " + qs(user.get('Email'), 200) + ", " + str(flt) + " "
        "WHERE EXISTS (SELECT 1 FROM registers WHERE Id = " + str(rid) + " AND IsActive = 1) "
        "AND NOT EXISTS (SELECT 1 FROM shifts WHERE Status = 'open' AND (TellerUserId = " + str(uid) + " OR RegisterId = " + str(rid) + "));",
        SUMMARY.format(where=MINE_OPEN),
    ])

if op == 'movement':
    kind = str(d.get('type') or '').strip().lower()
    amt = cents(d.get('amountCents', d.get('amount')), 0) or 0
    if kind not in ('payin', 'payout', 'drop'):
        fail('Movement type must be payin, payout or drop.')
    if amt <= 0:
        fail('Enter an amount.')
    return "\n".join([
        "INSERT INTO cash_movements (ShiftId, Type, AmountCents, Note, CreatedBy) "
        "SELECT s.Id, " + q(kind) + ", " + str(amt) + ", " + qs(d.get('note'), 300) + ", " + q(actor) + " FROM shifts s WHERE " + MINE_OPEN + ";",
        SUMMARY.format(where=MINE_OPEN),
    ])

if op == 'close':
    counted = cents(d.get('countedCents', d.get('counted')), None)
    if counted is None or counted < 0:
        fail('Enter the counted cash.')
    # Expected = float + cash sales - cash refunds + pay-ins - pay-outs/drops, computed in SQL so it
    # matches the summary exactly.
    expected = ("(s.OpeningFloatCents "
                "+ (SELECT COALESCE(SUM(sp.AmountCents), 0) FROM sale_payments sp JOIN sales x ON x.Id = sp.SaleId WHERE x.ShiftId = s.Id AND sp.Method = 'cash' AND sp.Status = 'succeeded') "
                "- (SELECT COALESCE(SUM(f.AmountCents), 0) FROM refunds f WHERE f.ShiftId = s.Id AND f.Method = 'cash') "
                "+ (SELECT COALESCE(SUM(CASE WHEN m.Type = 'payin' THEN m.AmountCents ELSE -m.AmountCents END), 0) FROM cash_movements m WHERE m.ShiftId = s.Id))")
    return "\n".join([
        "BEGIN;",
        "CREATE TEMP TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v INTEGER);", "DELETE FROM _ctx;",
        "INSERT INTO _ctx (k, v) SELECT 'sid', s.Id FROM shifts s WHERE " + MINE_OPEN + " LIMIT 1;",
        "UPDATE shifts SET ExpectedCashCents = " + expected.replace('s.Id', 'shifts.Id').replace('s.OpeningFloatCents', 'shifts.OpeningFloatCents') + " WHERE Id = (SELECT v FROM _ctx WHERE k = 'sid');",
        "UPDATE shifts SET Status = 'closed', CountedCashCents = " + str(counted) + ", DifferenceCents = " + str(counted) + " - COALESCE(ExpectedCashCents, 0), "
        "  Note = " + qs(d.get('note'), 500) + ", ClosedAt = CURRENT_TIMESTAMP, ClosedBy = " + q(actor) + " WHERE Id = (SELECT v FROM _ctx WHERE k = 'sid') AND Status = 'open';",
        "COMMIT;",
        SUMMARY.format(where="s.Id = (SELECT v FROM _ctx WHERE k = 'sid')"),
        "DROP TABLE IF EXISTS _ctx;",
    ])

if op == 'summary':
    sid = to_int(d.get('shiftId'), 0)
    return SUMMARY.format(where="s.Id = " + str(sid) + " AND s.TellerUserId = " + str(uid))

fail('Unknown op.')
