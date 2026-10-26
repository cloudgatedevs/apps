user = require_teller(value('IdpAuth'))
uid = user_id_of(user)
d = body()
if op_of(d, '') in ('refund', 'refund-status', 'retry'):
    fail('Use the refunds action with a stable requestKey. Update the app template.')
op = op_of(d, 'status')
if op not in ('start', 'status', 'cancel', 'refund', 'wallet-status'):
    fail('Unknown op.')
sid = to_int(d.get('saleId'), 0)
ref = str(d.get('reference') or '').strip()
where = 's.Id = ' + str(sid) if sid > 0 else 's.Reference = ' + q(ref) if ref else '1 = 0'
return 'SELECT (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings) AS SettingsJson, (SELECT TOP 1 JSON_OBJECT(\'Id\': s.Id, \'Reference\': s.Reference, \'Status\': s.Status, \'ShiftId\': s.ShiftId, \'RegisterId\': s.RegisterId, \'TellerUserId\': s.TellerUserId, \'TotalCents\': s.TotalCents, \'PaidCents\': s.PaidCents, \'RefundedCents\': s.RefundedCents, \'Currency\': s.Currency, \'CustomerEmail\': s.CustomerEmail, \'ItemsJson\': JSON_QUERY((SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Qty AS [Qty], i.LineTotalCents AS [LineTotalCents], i.RefundedQty AS [RefundedQty] FROM sale_items AS i WHERE i.SaleId = s.Id FOR JSON PATH, INCLUDE_NULL_VALUES), \'$\'), \'CardAttempts\': (SELECT COUNT_BIG(*) FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Method = \'card\'), \'Pending\': JSON_QUERY((SELECT TOP 1 JSON_OBJECT(\'Id\': p.Id, \'ConnectPaymentId\': p.ConnectPaymentId, \'AmountCents\': p.AmountCents, \'PaymentUrl\': p.PaymentUrl, \'Status\': p.Status, \'IsProduction\': p.IsProduction) FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Method = \'card\' AND p.Status = \'pending\' ORDER BY p.Id DESC), \'$\'), \'Succeeded\': JSON_QUERY((SELECT TOP 1 JSON_OBJECT(\'Id\': p.Id, \'ConnectPaymentId\': p.ConnectPaymentId, \'AmountCents\': p.AmountCents) FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Method = \'card\' AND p.Status = \'succeeded\' ORDER BY p.Id DESC), \'$\')) FROM sales AS s WHERE {where}) AS SaleJson, (SELECT TOP 1 JSON_OBJECT(\'Id\': s.Id, \'RegisterId\': s.RegisterId) FROM shifts AS s WHERE s.TellerUserId = {uid} AND s.Status = \'open\') AS ShiftJson;'.replace('{where}',where).replace('{uid}',str(uid))
