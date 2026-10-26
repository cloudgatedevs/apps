uid = idp_user_id(value('IdpAuth'))
d = body()
ref = str(d.get('reference') or '').strip()
token = str(d.get('token') or '').strip()
if not ref or len(ref) > 40:
    fail('An order reference is required.')
if token and (len(token) > 64 or not all((c.isalnum() or c in '-_' for c in token))):
    fail('Invalid cart token.')
owner = []
if token:
    owner.append('EXISTS (SELECT 1 FROM carts c WHERE c.Id = o.CartId AND c.Token = ' + q(token) + ')')
if uid > 0:
    owner.append('o.IdpUserId = ' + str(uid))
if not owner:
    fail('A cart token or a signed-in session is required.')
return 'SELECT TOP 1 o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.CreatedAt, o.ShippingAddressJson, p.Id AS PaymentRowId, p.ConnectPaymentId, p.Status AS PaymentRowStatus, p.PaymentUrl, (SELECT i.Title AS [Title], i.VariantTitle AS [VariantTitle], i.Sku AS [Sku], i.ImageUrl AS [ImageUrl], i.Qty AS [Qty], i.UnitPriceCents AS [UnitPriceCents], i.LineTotalCents AS [LineTotalCents] FROM (SELECT TOP 2147483647 * FROM order_items WHERE OrderId = o.Id ORDER BY Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson FROM orders AS o LEFT JOIN payments AS p ON p.Id = (SELECT TOP 1 Id FROM payments WHERE OrderId = o.Id ORDER BY Id DESC) WHERE o.Reference = ' + q(ref) + ' AND (' + ' OR '.join(owner) + ');'
