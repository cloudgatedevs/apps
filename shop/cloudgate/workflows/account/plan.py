# Account — build SQL scoped to the signed-in customer.
user = idp_user('''${IdpAuth}''')
if not user:
    fail('Sign in required.')
uid = to_int(user.get('Id') or user.get('id'), 0)
email = str(user.get('Email') or '').strip().lower()
if uid <= 0:
    fail('Sign in required.')
d = body()
op = op_of(d, 'orders')

# Orders placed while signed in, plus guest orders placed with this account's email
# (so a customer who registers after buying still sees their history).
MINE = "(o.IdpUserId = " + str(uid) + (" OR (o.IdpUserId IS NULL AND lower(o.Email) = " + q(email) + ")" if email else "") + ")"

if op == 'orders':
    take = clamp(d.get('take'), 1, 100, 20)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return (
        "SELECT o.Id, o.Reference, o.Currency, o.TotalCents, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.ShippedAt, o.CreatedAt, "
        "(SELECT COALESCE(SUM(i.Qty), 0) FROM order_items i WHERE i.OrderId = o.Id) AS Items, "
        "(SELECT i.ImageUrl FROM order_items i WHERE i.OrderId = o.Id ORDER BY i.Id LIMIT 1) AS ImageUrl, "
        "(SELECT i.Title FROM order_items i WHERE i.OrderId = o.Id ORDER BY i.Id LIMIT 1) AS FirstTitle, "
        "COUNT(*) OVER () AS TotalCount "
        "FROM orders o WHERE " + MINE + " AND NOT (o.Status = 'cancelled' AND o.PaymentStatus IN ('unpaid','failed')) "
        "ORDER BY o.CreatedAt DESC, o.Id DESC LIMIT " + str(take) + " OFFSET " + str(skip) + ";"
    )

if op == 'order':
    ref = str(d.get('reference') or '').strip()
    if not ref or len(ref) > 40:
        fail('reference is required.')
    return (
        "SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Phone, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, "
        "o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.ShippedAt, o.CreatedAt, o.ShippingAddressJson, o.CustomerNote, "
        "(SELECT json_group_array(json_object('Title', i.Title, 'VariantTitle', i.VariantTitle, 'Sku', i.Sku, 'ImageUrl', i.ImageUrl, "
        "   'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
        " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson, "
        "(SELECT json_group_array(json_object('Type', e.Type, 'Message', e.Message, 'CreatedAt', e.CreatedAt)) "
        " FROM (SELECT * FROM order_events WHERE OrderId = o.Id AND Type IN ('created','paid','status','shipped','refund') ORDER BY CreatedAt, Id) e) AS EventsJson "
        "FROM orders o WHERE o.Reference = " + q(ref) + " AND " + MINE + " LIMIT 1;"
    )

if op == 'me':
    return ("SELECT c.Id, c.Email, c.Name, c.Surname, c.Phone, c.DefaultAddressJson, c.CreatedAt, "
            "(SELECT COUNT(*) FROM orders o WHERE " + MINE + " AND o.PaymentStatus = 'paid') AS PaidOrders "
            "FROM customers c WHERE c.IdpUserId = " + str(uid) + " LIMIT 1;")

fail('Unknown op: ' + op)
