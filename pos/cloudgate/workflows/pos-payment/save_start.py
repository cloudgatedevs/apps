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
settings, sale, shift = load_pay()
pay = load_json(value('WalletCreate'), None)
if not sale or not isinstance(pay, dict) or (not pay.get('Id')):
    fail('The card payment could not be created.')
if pay.get('GrossAmount') != to_int(sale.get('TotalCents'), 0) - to_int(sale.get('PaidCents'), 0) or str(pay.get('Currency') or '').upper() != str(sale.get('Currency') or '').upper():
    fail('Wallet checkout details do not match this sale.')
if not str(pay.get('PaymentUrl') or '').startswith('https://'):
    fail('The wallet did not return a secure checkout URL. Please try again.')
sid = str(sale['Id'])
return '\n'.join(['INSERT INTO sale_payments (SaleId, Method, AmountCents, Status, Reference, ConnectPaymentId, PaymentUrl, IsProduction, RawJson, CreatedBy) VALUES (' + sid + ", 'card', " + str(to_int(pay.get('GrossAmount'), 0)) + ", 'pending', " + q('sale-' + str(sale.get('Reference')) + '-' + str(to_int(sale.get('CardAttempts'), 0) + 1)) + ', ' + str(to_int(pay.get('Id'), 0)) + ', ' + qs(pay.get('PaymentUrl'), 2048) + ', ' + ('1' if pay.get('IsProduction') else '0') + ', ' + q(out(pay)) + ', ' + q(actor) + ');', 'INSERT INTO sale_events (SaleId, Type, Message, CreatedBy) VALUES (' + sid + ", 'card_started', 'Card payment started', " + q(actor) + ');', 'SELECT TOP 1 s.*, r.Name AS RegisterName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Sku AS [Sku], i.Barcode AS [Barcode], i.Unit AS [Unit], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.DiscountCents AS [DiscountCents], i.TaxRateBp AS [TaxRateBp], i.TaxCents AS [TaxCents], i.LineTotalCents AS [LineTotalCents], i.RefundedQty AS [RefundedQty], i.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson, (SELECT p.Id AS [Id], p.Method AS [Method], p.AmountCents AS [AmountCents], p.TenderedCents AS [TenderedCents], p.ChangeCents AS [ChangeCents], p.Status AS [Status], p.Reference AS [Reference], p.ConnectPaymentId AS [ConnectPaymentId], p.PaymentUrl AS [PaymentUrl], p.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) AS p FOR JSON PATH, INCLUDE_NULL_VALUES) AS PaymentsJson, (SELECT f.Id AS [Id], f.Reference AS [Reference], f.Method AS [Method], f.AmountCents AS [AmountCents], f.Reason AS [Reason], f.Status AS [Status], f.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM refunds WHERE SaleId = s.Id ORDER BY Id) AS f FOR JSON PATH, INCLUDE_NULL_VALUES) AS RefundsJson, (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings WHERE [Key] IN (\'store_name\', \'store_tagline\', \'store_address\', \'store_phone\', \'support_email\', \'store_url\', \'store_logo_url\', \'store_icon_url\', \'currency\', \'tax_rate_bp\', \'prices_include_tax\', \'tax_number\', \'receipt_header\', \'receipt_footer\', \'payment_cash_enabled\', \'payment_card_enabled\', \'allow_negative_stock\', \'require_shift\', \'quick_cash_amounts\', \'theme_primary\', \'theme_secondary\')) AS SettingsJson FROM sales AS s LEFT JOIN registers AS r ON r.Id = s.RegisterId WHERE {where};'.replace('{where}', 's.Id = ' + sid)])
