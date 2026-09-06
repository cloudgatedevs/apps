# Admin Sales / Plan — load the target sale (for get/void/refund) and the settings in one row.
user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
sid = to_int(d.get('id') or d.get('saleId'), 0)
ref = str(d.get('reference') or '').strip()
where = "s.Id = " + str(sid) if sid > 0 else ("s.Reference = " + q(ref) if ref else "1 = 0")
return ("SELECT (SELECT json_group_object(Key, Value) FROM settings) AS SettingsJson, "
        "(SELECT json_object('Id', s.Id, 'Reference', s.Reference, 'Status', s.Status, 'ShiftId', s.ShiftId, 'TotalCents', s.TotalCents, 'PaidCents', s.PaidCents, 'RefundedCents', s.RefundedCents, 'Currency', s.Currency, "
        "  'ItemsJson', json((SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Qty', i.Qty, 'LineTotalCents', i.LineTotalCents, 'RefundedQty', i.RefundedQty)) FROM sale_items i WHERE i.SaleId = s.Id)), "
        "  'Succeeded', json((SELECT json_object('Id', p.Id, 'ConnectPaymentId', p.ConnectPaymentId, 'AmountCents', p.AmountCents) FROM sale_payments p WHERE p.SaleId = s.Id AND p.Method = 'card' AND p.Status = 'succeeded' ORDER BY p.Id DESC LIMIT 1))) "
        " FROM sales s WHERE " + where + " LIMIT 1) AS SaleJson;")
