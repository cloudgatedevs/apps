user = require_admin(value('IdpAuth'))
actor = str(user.get('Email') or 'admin')
d = body()
op = op_of(d, 'list')
skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)

def load_admin():
    rows = rows_of(value('Load'))
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    sale = load_json(r.get('SaleJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
        if isinstance(sale.get('Succeeded'), str):
            sale['Succeeded'] = load_json(sale.get('Succeeded'), None)
    return (settings, sale if isinstance(sale, dict) and sale.get('Id') else None)
settings, sale = load_admin()
SALE_DETAIL = 'SELECT TOP 1 s.*, r.Name AS RegisterName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Sku AS [Sku], i.Barcode AS [Barcode], i.Unit AS [Unit], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.DiscountCents AS [DiscountCents], i.TaxRateBp AS [TaxRateBp], i.TaxCents AS [TaxCents], i.LineTotalCents AS [LineTotalCents], i.RefundedQty AS [RefundedQty], i.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson, (SELECT p.Id AS [Id], p.Method AS [Method], p.AmountCents AS [AmountCents], p.TenderedCents AS [TenderedCents], p.ChangeCents AS [ChangeCents], p.Status AS [Status], p.Reference AS [Reference], p.ConnectPaymentId AS [ConnectPaymentId], p.PaymentUrl AS [PaymentUrl], p.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) AS p FOR JSON PATH, INCLUDE_NULL_VALUES) AS PaymentsJson, (SELECT f.Id AS [Id], f.Reference AS [Reference], f.Method AS [Method], f.AmountCents AS [AmountCents], f.Reason AS [Reason], f.Status AS [Status], f.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM refunds WHERE SaleId = s.Id ORDER BY Id) AS f FOR JSON PATH, INCLUDE_NULL_VALUES) AS RefundsJson, (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings WHERE [Key] IN (\'store_name\', \'store_tagline\', \'store_address\', \'store_phone\', \'support_email\', \'store_url\', \'store_logo_url\', \'store_icon_url\', \'currency\', \'tax_rate_bp\', \'prices_include_tax\', \'tax_number\', \'receipt_header\', \'receipt_footer\', \'payment_cash_enabled\', \'payment_card_enabled\', \'allow_negative_stock\', \'require_shift\', \'quick_cash_amounts\', \'theme_primary\', \'theme_secondary\')) AS SettingsJson FROM sales AS s LEFT JOIN registers AS r ON r.Id = s.RegisterId WHERE {where};'
if op == 'list':
    where = ['1 = 1']
    st = str(d.get('status') or '').lower()
    if st:
        where.append('s.Status = ' + q(st))
    else:
        where.append("s.Status <> 'discarded'")
    if d.get('from'):
        where.append('s.CreatedAt >= ' + q(str(d.get('from'))[:10] + ' 00:00:00'))
    if d.get('to'):
        where.append('s.CreatedAt <= ' + q(str(d.get('to'))[:10] + ' 23:59:59'))
    if d.get('tellerUserId'):
        where.append('s.TellerUserId = ' + qi(d.get('tellerUserId')))
    if d.get('registerId'):
        where.append('s.RegisterId = ' + qi(d.get('registerId')))
    if d.get('shiftId'):
        where.append('s.ShiftId = ' + qi(d.get('shiftId')))
    term = str(d.get('search') or '').strip()
    if term:
        where.append('(s.Reference LIKE ' + like(term) + ' OR s.CustomerName LIKE ' + like(term) + ' OR s.TellerName LIKE ' + like(term) + ')')
    return "SELECT s.Id, s.Reference, s.Status, s.TellerName, s.CustomerName, s.RegisterId, r.Name AS RegisterName, s.SubtotalCents, s.DiscountCents, s.TaxCents, s.TotalCents, s.PaidCents, s.RefundedCents, s.Currency, s.CompletedAt, s.CreatedAt, (SELECT COUNT_BIG(*) FROM sale_items AS i WHERE i.SaleId = s.Id) AS ItemCount, (SELECT STRING_AGG(Method, ',') FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Status = 'succeeded') AS Methods, COUNT_BIG(*) OVER () AS TotalCount FROM sales AS s LEFT JOIN registers AS r ON r.Id = s.RegisterId WHERE " + ' AND '.join(where) + ' ORDER BY s.Id DESC OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'get':
    if not sale:
        fail('Sale not found.')
    return SALE_DETAIL.replace('{where}', 's.Id = ' + str(sale['Id']))
if op == 'void':
    if not sale or sale.get('Status') not in ('open', 'held'):
        fail('Only an open or parked sale can be voided; refund completed sales instead.')
    sid = str(sale['Id'])
    return '\n'.join(["UPDATE sales SET Status = 'voided', VoidedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = " + sid + ';', "UPDATE sale_payments SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE SaleId = " + sid + " AND Status = 'pending';", 'INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) VALUES (' + sid + ", 'voided', 'Voided in the back office', " + qs(d.get('reason'), 300) + ', ' + q(actor) + ');', SALE_DETAIL.replace('{where}', 's.Id = ' + sid)])
if op == 'refund':
    fail('Use the refunds action with a stable requestKey. Update the app template.')
fail('Unknown op.')
