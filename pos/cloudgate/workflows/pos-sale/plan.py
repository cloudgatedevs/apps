user = require_teller(value('IdpAuth'))
uid = user_id_of(user)
d = body()
if op_of(d, '') in ('refund', 'refund-status', 'retry'):
    fail('Use the refunds action with a stable requestKey. Update the app template.')
op = op_of(d, 'complete')
ids = sorted({to_int((ln or {}).get('productId'), 0) for ln in d.get('lines') or [] if isinstance(ln, dict)})
ids = [i for i in ids if i > 0]
sale_where = '1 = 0'
sid = to_int(d.get('saleId') or d.get('heldSaleId'), 0)
ref = str(d.get('reference') or '').strip()
if sid > 0:
    sale_where = 's.Id = ' + str(sid)
elif ref:
    sale_where = 's.Reference = ' + q(ref)
return 'SELECT (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings) AS SettingsJson, (SELECT p.Id AS [Id], p.Name AS [Name], p.Sku AS [Sku], p.Barcode AS [Barcode], p.PriceCents AS [PriceCents], p.TaxRateBp AS [TaxRateBp], p.TaxExempt AS [TaxExempt], p.TrackInventory AS [TrackInventory], p.StockQty AS [StockQty], p.Unit AS [Unit], p.IsWeighed AS [IsWeighed], p.Status AS [Status] FROM products AS p WHERE p.Id IN (' + (','.join((str(i) for i in ids)) or '0') + ") FOR JSON PATH, INCLUDE_NULL_VALUES) AS ProductsJson, (SELECT TOP 1 JSON_OBJECT('Id': s.Id, 'RegisterId': s.RegisterId, 'Status': s.Status) FROM shifts AS s WHERE s.TellerUserId = " + str(uid) + " AND s.Status = 'open') AS ShiftJson, (SELECT TOP 1 JSON_OBJECT('Id': s.Id, 'Reference': s.Reference, 'Status': s.Status, 'ShiftId': s.ShiftId, 'TellerUserId': s.TellerUserId, 'TotalCents': s.TotalCents, 'PaidCents': s.PaidCents, 'RefundedCents': s.RefundedCents, 'Currency': s.Currency, 'ItemsJson': JSON_QUERY((SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Qty AS [Qty], i.LineTotalCents AS [LineTotalCents], i.TaxCents AS [TaxCents], i.RefundedQty AS [RefundedQty] FROM sale_items AS i WHERE i.SaleId = s.Id FOR JSON PATH, INCLUDE_NULL_VALUES), '$')) FROM sales AS s WHERE " + sale_where + ') AS SaleJson;'
