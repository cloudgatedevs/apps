user = require_teller(value('IdpAuth'))
actor = display_name(user)

def load_pay():
    rows = rows_of(value('Load'))
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    sale = load_json(r.get('SaleJson'), None)
    shift = load_json(r.get('ShiftJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
        for k in ('Pending', 'Succeeded'):
            if isinstance(sale.get(k), str):
                sale[k] = load_json(sale.get(k), None)
    return (settings, sale if isinstance(sale, dict) and sale.get('Id') else None, shift if isinstance(shift, dict) and shift.get('Id') else None)

def stock_out_guarded(actor):
    return ['UPDATE products SET StockQty = StockQty - (SELECT COALESCE(SUM(i.Qty), 0) FROM sale_items i WHERE i.SaleId = {SID} AND i.ProductId = products.Id), UpdatedAt = CURRENT_TIMESTAMP WHERE TrackInventory = 1 AND Id IN (SELECT ProductId FROM sale_items WHERE SaleId = {SID}){GUARD};', "INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT i.ProductId, -i.Qty, 'sale', (SELECT Reference FROM sales WHERE Id = {SID}), 'Sale (card)', " + q(actor) + ' FROM sale_items i JOIN products p ON p.Id = i.ProductId WHERE i.SaleId = {SID} AND p.TrackInventory = 1{GUARD};']
settings, sale, shift = load_pay()
pay = load_json(value('WalletGet'), None)
if not sale or not isinstance(pay, dict):
    fail('Sale or payment not found.')
pending = sale.get('Pending') or sale.get('Succeeded') or {}
if not pending or to_int(pay.get('Id'), 0) != to_int(pending.get('ConnectPaymentId'), 0) or pay.get('GrossAmount') != to_int(pending.get('AmountCents'), 0) or (str(pay.get('Currency') or '').upper() != str(sale.get('Currency') or '').upper()):
    fail('Wallet payment details do not match this sale.')
sid = str(sale['Id'])
pid = str(to_int(pending.get('Id'), 0))
status = to_int(pay.get('Status'), 0)
raw = q(out(pay))
detail = 'SELECT TOP 1 s.*, r.Name AS RegisterName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Sku AS [Sku], i.Barcode AS [Barcode], i.Unit AS [Unit], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.DiscountCents AS [DiscountCents], i.TaxRateBp AS [TaxRateBp], i.TaxCents AS [TaxCents], i.LineTotalCents AS [LineTotalCents], i.RefundedQty AS [RefundedQty], i.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson, (SELECT p.Id AS [Id], p.Method AS [Method], p.AmountCents AS [AmountCents], p.TenderedCents AS [TenderedCents], p.ChangeCents AS [ChangeCents], p.Status AS [Status], p.Reference AS [Reference], p.ConnectPaymentId AS [ConnectPaymentId], p.PaymentUrl AS [PaymentUrl], p.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) AS p FOR JSON PATH, INCLUDE_NULL_VALUES) AS PaymentsJson, (SELECT f.Id AS [Id], f.Reference AS [Reference], f.Method AS [Method], f.AmountCents AS [AmountCents], f.Reason AS [Reason], f.Status AS [Status], f.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM refunds WHERE SaleId = s.Id ORDER BY Id) AS f FOR JSON PATH, INCLUDE_NULL_VALUES) AS RefundsJson, (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings WHERE [Key] IN (\'store_name\', \'store_tagline\', \'store_address\', \'store_phone\', \'support_email\', \'store_url\', \'store_logo_url\', \'store_icon_url\', \'currency\', \'tax_rate_bp\', \'prices_include_tax\', \'tax_number\', \'receipt_header\', \'receipt_footer\', \'payment_cash_enabled\', \'payment_card_enabled\', \'allow_negative_stock\', \'require_shift\', \'quick_cash_amounts\', \'theme_primary\', \'theme_secondary\')) AS SettingsJson FROM sales AS s LEFT JOIN registers AS r ON r.Id = s.RegisterId WHERE {where};'.replace('{where}', 's.Id = ' + sid).replace(' AS SettingsJson FROM sales', " AS SettingsJson, (SELECT v FROM #ctx WHERE k = 'fin') AS JustCompleted FROM sales")
amount = str(to_int(pending.get('AmountCents'), 0))
if status == 1:
    return '\n'.join(['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', "UPDATE sale_payments SET Status = 'succeeded', RawJson = " + raw + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + " AND Status = 'pending';", "INSERT INTO #ctx (k, v) VALUES ('paid', @@ROWCOUNT);", 'UPDATE sales SET PaidCents = PaidCents + ' + amount + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + sid + " AND (SELECT v FROM #ctx WHERE k = 'paid') = 1;", "UPDATE sales SET Status = 'completed', CompletedAt = SYSUTCDATETIME() WHERE Id = " + sid + " AND Status = 'open' AND PaidCents >= TotalCents AND (SELECT v FROM #ctx WHERE k = 'paid') = 1;", "INSERT INTO #ctx (k, v) VALUES ('fin', @@ROWCOUNT);"] + [s.replace('{SID}', sid).replace('{GUARD}', " AND (SELECT v FROM #ctx WHERE k = 'fin') = 1") for s in stock_out_guarded(actor)] + ['INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) SELECT ' + sid + ", 'card_paid', 'Card payment received', " + raw + ", 'system' WHERE (SELECT v FROM #ctx WHERE k = 'paid') = 1;", 'COMMIT TRANSACTION;', detail, 'DROP TABLE IF EXISTS #ctx;'])
if status in (2, 3):
    label = 'failed' if status == 2 else 'expired'
    return '\n'.join(['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', "INSERT INTO #ctx (k, v) VALUES ('fin', 0);", 'UPDATE sale_payments SET Status = ' + q(label) + ', RawJson = ' + raw + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + " AND Status = 'pending';", 'INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) VALUES (' + sid + ", 'card_" + label + "', 'Card payment " + label + "', " + raw + ", 'system');", 'COMMIT TRANSACTION;', detail, 'DROP TABLE IF EXISTS #ctx;'])
return '\n'.join(['CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', "INSERT INTO #ctx (k, v) VALUES ('fin', 0);", 'UPDATE sale_payments SET RawJson = ' + raw + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + ';', detail, 'DROP TABLE IF EXISTS #ctx;'])
