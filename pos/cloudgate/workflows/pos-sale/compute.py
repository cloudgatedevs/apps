user = require_teller(value('IdpAuth'))
uid = user_id_of(user)
actor = display_name(user)
d = body()
op = op_of(d, 'complete')
SALE_DETAIL = 'SELECT TOP 1 s.*, r.Name AS RegisterName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Name AS [Name], i.Sku AS [Sku], i.Barcode AS [Barcode], i.Unit AS [Unit], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.DiscountCents AS [DiscountCents], i.TaxRateBp AS [TaxRateBp], i.TaxCents AS [TaxCents], i.LineTotalCents AS [LineTotalCents], i.RefundedQty AS [RefundedQty], i.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson, (SELECT p.Id AS [Id], p.Method AS [Method], p.AmountCents AS [AmountCents], p.TenderedCents AS [TenderedCents], p.ChangeCents AS [ChangeCents], p.Status AS [Status], p.Reference AS [Reference], p.ConnectPaymentId AS [ConnectPaymentId], p.PaymentUrl AS [PaymentUrl], p.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) AS p FOR JSON PATH, INCLUDE_NULL_VALUES) AS PaymentsJson, (SELECT f.Id AS [Id], f.Reference AS [Reference], f.Method AS [Method], f.AmountCents AS [AmountCents], f.Reason AS [Reason], f.Status AS [Status], f.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM refunds WHERE SaleId = s.Id ORDER BY Id) AS f FOR JSON PATH, INCLUDE_NULL_VALUES) AS RefundsJson, (SELECT JSON_QUERY(CONCAT(N\'{\', STRING_AGG(CONVERT(NVARCHAR(MAX), CONCAT(N\'"\', STRING_ESCAPE([Key], \'json\'), N\'":\', CASE WHEN [Value] IS NULL THEN N\'null\' ELSE CONCAT(N\'"\', STRING_ESCAPE([Value], \'json\'), N\'"\') END)), N\',\'), N\'}\'), \'$\') FROM settings WHERE [Key] IN (\'store_name\', \'store_tagline\', \'store_address\', \'store_phone\', \'support_email\', \'store_url\', \'store_logo_url\', \'store_icon_url\', \'currency\', \'tax_rate_bp\', \'prices_include_tax\', \'tax_number\', \'receipt_header\', \'receipt_footer\', \'payment_cash_enabled\', \'payment_card_enabled\', \'allow_negative_stock\', \'require_shift\', \'quick_cash_amounts\', \'theme_primary\', \'theme_secondary\')) AS SettingsJson FROM sales AS s LEFT JOIN registers AS r ON r.Id = s.RegisterId WHERE {where};'

def load_ctx():
    rows = rows_of(value('Load'))
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    products = load_json(r.get('ProductsJson'), []) or []
    shift = load_json(r.get('ShiftJson'), None)
    sale = load_json(r.get('SaleJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
    return (settings, {to_int(p.get('Id'), 0): p for p in products if isinstance(p, dict)}, shift if isinstance(shift, dict) and shift.get('Id') else None, sale if isinstance(sale, dict) and sale.get('Id') else None)
settings, products, shift, sale = load_ctx()
currency = str(settings.get('currency') or 'ZAR').upper()
require_shift = str(settings.get('require_shift') or '1') == '1'

def price_lines(lines, products, settings):
    """Server-side pricing: never trust client prices. Returns (items, subtotal, tax)."""
    incl = str(settings.get('prices_include_tax') or '1') == '1'
    default_bp = to_int(settings.get('tax_rate_bp'), 0)
    items = []
    for pos, ln in enumerate(lines or []):
        pid = to_int((ln or {}).get('productId'), 0)
        p = products.get(pid)
        if not p:
            fail('A product in the sale is no longer available.')
        if p.get('Status') != 'active':
            fail(str(p.get('Name')) + ' is not for sale.')
        qty = qty_of((ln or {}).get('qty'), 1.0)
        if not p.get('IsWeighed'):
            qty = float(int(round(qty)))
        unit = to_int(p.get('PriceCents'), 0)
        gross = money_round(qty * unit)
        disc = max(0, min(gross, to_int(cents((ln or {}).get('discountCents'), 0), 0)))
        total = gross - disc
        bp = 0 if to_int(p.get('TaxExempt'), 0) else to_int(p.get('TaxRateBp'), default_bp) if p.get('TaxRateBp') is not None else default_bp
        if incl:
            tax = total - money_round(total / (1 + bp / 10000.0)) if bp else 0
        else:
            tax = money_round(total * bp / 10000.0) if bp else 0
            total = total + tax
        items.append({'ProductId': pid, 'Name': p.get('Name'), 'Sku': p.get('Sku'), 'Barcode': p.get('Barcode'), 'Unit': p.get('Unit') or 'each', 'Qty': qty, 'UnitPriceCents': unit, 'DiscountCents': disc, 'TaxRateBp': bp, 'TaxCents': tax, 'LineTotalCents': total, 'TrackInventory': to_int(p.get('TrackInventory'), 1), 'StockQty': float(p.get('StockQty') or 0), 'Position': pos})
    if not items:
        fail('Add at least one item.')
    subtotal = sum((i['LineTotalCents'] for i in items))
    tax = sum((i['TaxCents'] for i in items))
    return (items, subtotal, tax)

def check_stock(items, settings):
    if str(settings.get('allow_negative_stock') or '0') == '1':
        return
    short = [i for i in items if i['TrackInventory'] and i['StockQty'] < i['Qty']]
    if short:
        fail('Not enough stock for ' + str(short[0]['Name']) + ' (have ' + str(short[0]['StockQty']) + ').')

def insert_sale_sql(items, subtotal, tax, sale_disc, status, ctx):
    """INSERT the sale + items using the next receipt number; the sale id is kept in #ctx('sid')."""
    total = max(0, subtotal - sale_disc)
    parts = ["UPDATE settings SET [Value] = CAST([Value] AS INTEGER) + 1, UpdatedAt = SYSUTCDATETIME() WHERE [Key] = 'sale_reference_seed';", "INSERT INTO sales (Reference, ShiftId, RegisterId, TellerUserId, TellerName, CustomerId, CustomerName, CustomerEmail, Status, Currency, SubtotalCents, DiscountCents, TaxCents, TotalCents, HoldLabel, Note) VALUES ((SELECT CONCAT(COALESCE((SELECT [Value] FROM settings WHERE [Key] = 'sale_reference_prefix'), 'R-'), (SELECT [Value] FROM settings WHERE [Key] = 'sale_reference_seed'))), " + ctx['shift_id'] + ', ' + ctx['register_id'] + ', ' + str(ctx['uid']) + ', ' + q(ctx['actor']) + ', ' + qi(ctx['customer_id']) + ', ' + qs(ctx['customer_name'], 200) + ', ' + qs(ctx['customer_email'], 200) + ', ' + q(status) + ', ' + q(ctx['currency']) + ', ' + str(subtotal) + ', ' + str(sale_disc) + ', ' + str(tax) + ', ' + str(total) + ', ' + qs(ctx['hold_label'], 120) + ', ' + qs(ctx['note'], 500) + ');', "INSERT INTO #ctx (k, v) VALUES ('sid', CONVERT(BIGINT, SCOPE_IDENTITY()));"]
    for i in items:
        parts.append("INSERT INTO sale_items (SaleId, ProductId, Name, Sku, Barcode, Unit, Qty, UnitPriceCents, DiscountCents, TaxRateBp, TaxCents, LineTotalCents, Position) VALUES ((SELECT v FROM #ctx WHERE k = 'sid'), " + str(i['ProductId']) + ', ' + q(i['Name']) + ', ' + qs(i['Sku'], 64) + ', ' + qs(i['Barcode'], 64) + ', ' + q(i['Unit']) + ', ' + repr(float(i['Qty'])) + ', ' + str(i['UnitPriceCents']) + ', ' + str(i['DiscountCents']) + ', ' + str(i['TaxRateBp']) + ', ' + str(i['TaxCents']) + ', ' + str(i['LineTotalCents']) + ', ' + str(i['Position']) + ');')
    return (parts, total)

def stock_out_sql(sale_id_expr, reference_expr, actor):
    """Deduct tracked stock for a sale's items and write the ledger (idempotent per sale via the 'sale' reason + reference)."""
    return ['UPDATE products SET StockQty = StockQty - (SELECT COALESCE(SUM(i.Qty), 0) FROM sale_items AS i WHERE i.SaleId = ' + sale_id_expr + ' AND i.ProductId = products.Id), UpdatedAt = SYSUTCDATETIME() WHERE TrackInventory = 1 AND Id IN (SELECT ProductId FROM sale_items WHERE SaleId = ' + sale_id_expr + ');', "INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT i.ProductId, -i.Qty, 'sale', " + reference_expr + ", 'Sale', " + q(actor) + ' FROM sale_items AS i JOIN products AS p ON p.Id = i.ProductId WHERE i.SaleId = ' + sale_id_expr + ' AND p.TrackInventory = 1;']

def ctx_for():
    if require_shift and (not shift) and (op in ('complete', 'create', 'hold')):
        fail('Open a shift before selling.')
    return {'uid': uid, 'actor': actor, 'currency': currency, 'shift_id': str(shift['Id']) if shift else 'NULL', 'register_id': str(shift['RegisterId']) if shift else 'NULL', 'customer_id': d.get('customerId'), 'customer_name': d.get('customerName'), 'customer_email': d.get('customerEmail'), 'hold_label': d.get('holdLabel'), 'note': d.get('note')}

def detail(where):
    return SALE_DETAIL.replace('{where}', where)
CTX_TABLE = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;']
SID = "(SELECT v FROM #ctx WHERE k = 'sid')"
REF = '(SELECT Reference FROM sales WHERE Id = ' + SID + ')'
if op in ('create', 'hold', 'complete'):
    items, subtotal, tax = price_lines(d.get('lines'), products, settings)
    sale_disc = max(0, min(subtotal, to_int(cents(d.get('discountCents'), 0), 0)))
    ctx = ctx_for()
    parts = list(CTX_TABLE)
    held_id = to_int(d.get('heldSaleId'), 0)
    if held_id > 0:
        parts.append("UPDATE sales SET Status = 'discarded', UpdatedAt = SYSUTCDATETIME() WHERE Id = " + str(held_id) + " AND Status = 'held';")
    status = 'held' if op == 'hold' else 'open'
    ins, total = insert_sale_sql(items, subtotal, tax, sale_disc, status, ctx)
    parts += ins
    if op == 'complete':
        check_stock(items, settings)
        if str(settings.get('payment_cash_enabled') or '1') != '1':
            fail('Cash payments are switched off. Take a card payment instead.')
        pays = [p for p in d.get('payments') or [] if isinstance(p, dict)]
        cash = [p for p in pays if str(p.get('method') or 'cash').lower() == 'cash']
        if not cash or len(cash) != len(pays):
            fail('Complete with cash payments here; card payments go through the payment screen.')
        tendered = sum((max(0, to_int(cents(p.get('tenderedCents', p.get('amountCents')), 0), 0)) for p in cash))
        if tendered < total:
            fail('The amount tendered is less than the total.')
        change = tendered - total
        parts.append('INSERT INTO sale_payments (SaleId, Method, AmountCents, TenderedCents, ChangeCents, Status, CreatedBy) VALUES (' + SID + ", 'cash', " + str(total) + ', ' + str(tendered) + ', ' + str(change) + ", 'succeeded', " + q(actor) + ');')
        parts.append("UPDATE sales SET Status = 'completed', PaidCents = " + str(total) + ', ChangeCents = ' + str(change) + ', CompletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + SID + ';')
        parts += stock_out_sql(SID, REF, actor)
        parts.append('INSERT INTO sale_events (SaleId, Type, Message, CreatedBy) VALUES (' + SID + ", 'completed', 'Paid in cash', " + q(actor) + ');')
    parts.append('COMMIT TRANSACTION;')
    parts.append(detail('s.Id = ' + SID))
    parts.append('DROP TABLE IF EXISTS #ctx;')
    return '\n'.join(parts)
if op == 'held':
    where = "s.Status = 'held'"
    if shift:
        where += ' AND (s.RegisterId = ' + str(shift['RegisterId']) + ' OR s.TellerUserId = ' + str(uid) + ')'
    return 'SELECT TOP 50 s.Id, s.Reference, s.HoldLabel, s.CustomerName, s.TotalCents, s.TellerName, s.CreatedAt, (SELECT COUNT_BIG(*) FROM sale_items AS i WHERE i.SaleId = s.Id) AS ItemCount FROM sales AS s WHERE ' + where + ' ORDER BY s.Id DESC;'
if op in ('get', 'recall'):
    if not sale:
        fail('Sale not found.')
    return detail('s.Id = ' + str(sale['Id']))
if op == 'discard':
    if not sale or sale.get('Status') != 'held':
        fail('Only a parked sale can be discarded.')
    return "UPDATE sales SET Status = 'discarded', UpdatedAt = SYSUTCDATETIME() WHERE Id = " + str(sale['Id']) + " AND Status = 'held'; " + detail('s.Id = ' + str(sale['Id']))
if op == 'recent':
    take = clamp(d.get('take'), 1, 100, 20)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    where = "s.Status IN ('completed','refunded','partially_refunded','voided')"
    where += ' AND s.ShiftId = ' + str(shift['Id']) if shift else ' AND s.TellerUserId = ' + str(uid)
    return "SELECT s.Id, s.Reference, s.Status, s.TotalCents, s.PaidCents, s.CustomerName, s.CompletedAt, s.CreatedAt, (SELECT COUNT_BIG(*) FROM sale_items AS i WHERE i.SaleId = s.Id) AS ItemCount, (SELECT STRING_AGG(Method, ',') FROM sale_payments AS p WHERE p.SaleId = s.Id AND p.Status = 'succeeded') AS Methods, (SELECT COUNT_BIG(*) FROM sales AS t WHERE " + where.replace('s.', 't.') + ') AS Total FROM sales AS s WHERE ' + where + ' ORDER BY s.Id DESC OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'refund':
    fail('Use the refunds action with a stable requestKey. Update the app template.')
fail('Unknown op.')
