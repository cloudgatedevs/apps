user = idp_user(value('IdpAuth'))
if not user:
    fail('Sign in required.')
uid = to_int(user.get('Id') or user.get('id'), 0)
email = str(user.get('Email') or '').strip().lower()
if uid <= 0:
    fail('Sign in required.')
d = body()
op = op_of(d, 'orders')
MINE = '(o.IdpUserId = ' + str(uid) + (' OR (o.IdpUserId IS NULL AND lower(o.Email) = ' + q(email) + ')' if email else '') + ')'
if op == 'orders':
    take = clamp(d.get('take'), 1, 100, 20)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return 'SELECT o.Id, o.Reference, o.Currency, o.TotalCents, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.ShippedAt, o.CreatedAt, (SELECT COALESCE(SUM(i.Qty), 0) FROM order_items AS i WHERE i.OrderId = o.Id) AS Items, (SELECT TOP 1 i.ImageUrl FROM order_items AS i WHERE i.OrderId = o.Id ORDER BY i.Id) AS ImageUrl, (SELECT TOP 1 i.Title FROM order_items AS i WHERE i.OrderId = o.Id ORDER BY i.Id) AS FirstTitle, COUNT_BIG(*) OVER () AS TotalCount FROM orders AS o WHERE ' + MINE + " AND NOT (o.Status = 'cancelled' AND o.PaymentStatus IN ('unpaid', 'failed')) ORDER BY o.CreatedAt DESC, o.Id DESC OFFSET " + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'order':
    ref = str(d.get('reference') or '').strip()
    if not ref or len(ref) > 40:
        fail('reference is required.')
    return "SELECT TOP 1 o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Phone, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.ShippedAt, o.CreatedAt, o.ShippingAddressJson, o.CustomerNote, (SELECT i.Title AS [Title], i.VariantTitle AS [VariantTitle], i.Sku AS [Sku], i.ImageUrl AS [ImageUrl], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.LineTotalCents AS [LineTotalCents] FROM (SELECT TOP 2147483647 * FROM order_items WHERE OrderId = o.Id ORDER BY Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson, (SELECT e.Type AS [Type], e.Message AS [Message], e.CreatedAt AS [CreatedAt] FROM (SELECT TOP 2147483647 * FROM order_events WHERE OrderId = o.Id AND Type IN ('created', 'paid', 'status', 'shipped', 'refund') ORDER BY CreatedAt, Id) AS e FOR JSON PATH, INCLUDE_NULL_VALUES) AS EventsJson FROM orders AS o WHERE o.Reference = " + q(ref) + ' AND ' + MINE + ';'
if op == 'me':
    return 'SELECT TOP 1 c.Id, c.Email, c.Name, c.Surname, c.Phone, c.DefaultAddressJson, c.CreatedAt, (SELECT COUNT_BIG(*) FROM orders AS o WHERE ' + MINE + " AND o.PaymentStatus = 'paid') AS PaidOrders FROM customers AS c WHERE c.IdpUserId = " + str(uid) + ';'
fail('Unknown op: ' + op)
