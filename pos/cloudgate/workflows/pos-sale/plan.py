# POS Sale / Plan — one SELECT that gathers everything Compute needs, as JSON columns:
# settings, the products in the request, the teller's open shift, and (for get/complete/refund) the sale.
user = require_teller('''${IdpAuth}''')
uid = user_id_of(user)
d = body()
if op_of(d, '') in ('refund','refund-status','retry'):
    fail('Use the refunds action with a stable requestKey. Update the app template.')
op = op_of(d, 'complete')

ids = sorted({to_int((ln or {}).get('productId'), 0) for ln in (d.get('lines') or []) if isinstance(ln, dict)})
ids = [i for i in ids if i > 0]
sale_where = "1 = 0"
sid = to_int(d.get('saleId') or d.get('heldSaleId'), 0)
ref = str(d.get('reference') or '').strip()
if sid > 0:
    sale_where = "s.Id = " + str(sid)
elif ref:
    sale_where = "s.Reference = " + q(ref)

return (
    "SELECT "
    "(SELECT json_group_object(Key, Value) FROM settings) AS SettingsJson, "
    "(SELECT json_group_array(json_object('Id', p.Id, 'Name', p.Name, 'Sku', p.Sku, 'Barcode', p.Barcode, 'PriceCents', p.PriceCents, 'TaxRateBp', p.TaxRateBp, "
    "   'TaxExempt', p.TaxExempt, 'TrackInventory', p.TrackInventory, 'StockQty', p.StockQty, 'Unit', p.Unit, 'IsWeighed', p.IsWeighed, 'Status', p.Status)) "
    " FROM products p WHERE p.Id IN (" + (','.join(str(i) for i in ids) or '0') + ")) AS ProductsJson, "
    "(SELECT json_object('Id', s.Id, 'RegisterId', s.RegisterId, 'Status', s.Status) FROM shifts s WHERE s.TellerUserId = " + str(uid) + " AND s.Status = 'open' LIMIT 1) AS ShiftJson, "
    "(SELECT json_object('Id', s.Id, 'Reference', s.Reference, 'Status', s.Status, 'ShiftId', s.ShiftId, 'TellerUserId', s.TellerUserId, 'TotalCents', s.TotalCents, 'PaidCents', s.PaidCents, "
    "   'RefundedCents', s.RefundedCents, 'Currency', s.Currency, 'ItemsJson', json((SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Qty', i.Qty, "
    "   'LineTotalCents', i.LineTotalCents, 'TaxCents', i.TaxCents, 'RefundedQty', i.RefundedQty)) FROM sale_items i WHERE i.SaleId = s.Id))) "
    " FROM sales s WHERE " + sale_where + " LIMIT 1) AS SaleJson;"
)
