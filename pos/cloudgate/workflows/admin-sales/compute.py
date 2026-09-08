# Admin Sales / Compute — list, get, void and cash refunds.
user = require_admin('''${IdpAuth}''')
actor = str(user.get('Email') or 'admin')
d = body()
op = op_of(d, 'list')

skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)


def load_admin():
    rows = rows_of('''${Load}''')
    r = rows[0] if rows else {}
    settings = load_json(r.get('SettingsJson'), {}) or {}
    sale = load_json(r.get('SaleJson'), None)
    if isinstance(sale, dict):
        sale['Items'] = load_json(sale.get('ItemsJson'), []) or []
        if isinstance(sale.get('Succeeded'), str):
            sale['Succeeded'] = load_json(sale.get('Succeeded'), None)
    return settings, (sale if isinstance(sale, dict) and sale.get('Id') else None)


settings, sale = load_admin()
SALE_DETAIL = "SELECT s.*, r.Name AS RegisterName, (SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Sku', i.Sku, 'Barcode', i.Barcode, 'Unit', i.Unit,    'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'DiscountCents', i.DiscountCents, 'TaxRateBp', i.TaxRateBp, 'TaxCents', i.TaxCents,    'LineTotalCents', i.LineTotalCents, 'RefundedQty', i.RefundedQty, 'Position', i.Position))  FROM (SELECT * FROM sale_items WHERE SaleId = s.Id ORDER BY Position, Id) i) AS ItemsJson, (SELECT json_group_array(json_object('Id', p.Id, 'Method', p.Method, 'AmountCents', p.AmountCents, 'TenderedCents', p.TenderedCents,    'ChangeCents', p.ChangeCents, 'Status', p.Status, 'Reference', p.Reference, 'ConnectPaymentId', p.ConnectPaymentId, 'PaymentUrl', p.PaymentUrl, 'CreatedAt', p.CreatedAt))  FROM (SELECT * FROM sale_payments WHERE SaleId = s.Id ORDER BY Id) p) AS PaymentsJson, (SELECT json_group_array(json_object('Id', f.Id, 'Reference', f.Reference, 'Method', f.Method, 'AmountCents', f.AmountCents, 'Reason', f.Reason, 'Status', f.Status, 'CreatedAt', f.CreatedAt))  FROM (SELECT * FROM refunds WHERE SaleId = s.Id ORDER BY Id) f) AS RefundsJson, (SELECT json_group_object(Key, Value) FROM settings WHERE Key IN ('store_name','store_tagline','store_address','store_phone','support_email','store_url','store_logo_url','store_icon_url','currency','tax_rate_bp','prices_include_tax','tax_number','receipt_header','receipt_footer','payment_cash_enabled','payment_card_enabled','allow_negative_stock','require_shift','quick_cash_amounts','theme_primary','theme_secondary')) AS SettingsJson FROM sales s LEFT JOIN registers r ON r.Id = s.RegisterId WHERE {where} LIMIT 1;"

if op == 'list':
    where = ["1 = 1"]
    st = str(d.get('status') or '').lower()
    if st:
        where.append("s.Status = " + q(st))
    else:
        where.append("s.Status <> 'discarded'")
    if d.get('from'):
        where.append("s.CreatedAt >= " + q(str(d.get('from'))[:10] + ' 00:00:00'))
    if d.get('to'):
        where.append("s.CreatedAt <= " + q(str(d.get('to'))[:10] + ' 23:59:59'))
    if d.get('tellerUserId'):
        where.append("s.TellerUserId = " + qi(d.get('tellerUserId')))
    if d.get('registerId'):
        where.append("s.RegisterId = " + qi(d.get('registerId')))
    if d.get('shiftId'):
        where.append("s.ShiftId = " + qi(d.get('shiftId')))
    term = str(d.get('search') or '').strip()
    if term:
        where.append("(s.Reference LIKE " + like(term) + " OR s.CustomerName LIKE " + like(term) + " OR s.TellerName LIKE " + like(term) + ")")
    return ("SELECT s.Id, s.Reference, s.Status, s.TellerName, s.CustomerName, s.RegisterId, r.Name AS RegisterName, s.SubtotalCents, s.DiscountCents, s.TaxCents, s.TotalCents, s.PaidCents, s.RefundedCents, s.Currency, s.CompletedAt, s.CreatedAt, "
            "(SELECT COUNT(*) FROM sale_items i WHERE i.SaleId = s.Id) AS ItemCount, (SELECT group_concat(DISTINCT Method) FROM sale_payments p WHERE p.SaleId = s.Id AND p.Status = 'succeeded') AS Methods, COUNT(*) OVER() AS TotalCount "
            "FROM sales s LEFT JOIN registers r ON r.Id = s.RegisterId WHERE " + ' AND '.join(where) + " ORDER BY s.Id DESC LIMIT " + str(take) + " OFFSET " + str(skip) + ";")

if op == 'get':
    if not sale:
        fail('Sale not found.')
    return SALE_DETAIL.format(where="s.Id = " + str(sale['Id']))

if op == 'void':
    if not sale or sale.get('Status') not in ('open', 'held'):
        fail('Only an open or parked sale can be voided; refund completed sales instead.')
    sid = str(sale['Id'])
    return "\n".join([
        "UPDATE sales SET Status = 'voided', VoidedAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + sid + ";",
        "UPDATE sale_payments SET Status = 'cancelled', UpdatedAt = CURRENT_TIMESTAMP WHERE SaleId = " + sid + " AND Status = 'pending';",
        "INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) VALUES (" + sid + ", 'voided', 'Voided in the back office', " + qs(d.get('reason'), 300) + ", " + q(actor) + ");",
        SALE_DETAIL.format(where="s.Id = " + sid)])

if op == 'refund':
    fail('Use the refunds action with a stable requestKey. Update the app template.')

fail('Unknown op.')
