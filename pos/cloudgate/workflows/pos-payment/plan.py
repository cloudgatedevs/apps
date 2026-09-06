# POS Payment / Plan — load the sale, its pending/succeeded card payment and the teller's shift.
user = require_teller('''${IdpAuth}''')
uid = user_id_of(user)
d = body()
op = op_of(d, 'status')
if op not in ('start', 'status', 'cancel', 'refund', 'wallet-status'):
    fail('Unknown op.')
sid = to_int(d.get('saleId'), 0)
ref = str(d.get('reference') or '').strip()
where = "s.Id = " + str(sid) if sid > 0 else ("s.Reference = " + q(ref) if ref else "1 = 0")
return "SELECT (SELECT json_group_object(Key, Value) FROM settings) AS SettingsJson, (SELECT json_object('Id', s.Id, 'Reference', s.Reference, 'Status', s.Status, 'ShiftId', s.ShiftId, 'RegisterId', s.RegisterId, 'TellerUserId', s.TellerUserId,   'TotalCents', s.TotalCents, 'PaidCents', s.PaidCents, 'RefundedCents', s.RefundedCents, 'Currency', s.Currency, 'CustomerEmail', s.CustomerEmail,   'ItemsJson', (SELECT json_group_array(json_object('Id', i.Id, 'ProductId', i.ProductId, 'Name', i.Name, 'Qty', i.Qty, 'LineTotalCents', i.LineTotalCents, 'RefundedQty', i.RefundedQty)) FROM sale_items i WHERE i.SaleId = s.Id),   'CardAttempts', (SELECT COUNT(*) FROM sale_payments p WHERE p.SaleId = s.Id AND p.Method = 'card'),   'Pending', (SELECT json_object('Id', p.Id, 'ConnectPaymentId', p.ConnectPaymentId, 'AmountCents', p.AmountCents, 'PaymentUrl', p.PaymentUrl, 'Status', p.Status, 'IsProduction', p.IsProduction)               FROM sale_payments p WHERE p.SaleId = s.Id AND p.Method = 'card' AND p.Status = 'pending' ORDER BY p.Id DESC LIMIT 1),   'Succeeded', (SELECT json_object('Id', p.Id, 'ConnectPaymentId', p.ConnectPaymentId, 'AmountCents', p.AmountCents)               FROM sale_payments p WHERE p.SaleId = s.Id AND p.Method = 'card' AND p.Status = 'succeeded' ORDER BY p.Id DESC LIMIT 1))  FROM sales s WHERE {where} LIMIT 1) AS SaleJson, (SELECT json_object('Id', s.Id, 'RegisterId', s.RegisterId) FROM shifts s WHERE s.TellerUserId = {uid} AND s.Status = 'open' LIMIT 1) AS ShiftJson;".format(where=where, uid=uid)
