# Payment Status / Plan — locate the order the caller may see and its latest payment.
uid = idp_user_id('''${IdpAuth}''')
d = body()
ref = str(d.get('reference') or '').strip()
token = str(d.get('token') or '').strip()
if not ref or len(ref) > 40:
    fail('An order reference is required.')
if token and (len(token) > 64 or not all(c.isalnum() or c in '-_' for c in token)):
    fail('Invalid cart token.')

# Ownership: the cart token that placed the order, or the signed-in customer who owns it.
owner = []
if token:
    owner.append("EXISTS (SELECT 1 FROM carts c WHERE c.Id = o.CartId AND c.Token = " + q(token) + ")")
if uid > 0:
    owner.append("o.IdpUserId = " + str(uid))
if not owner:
    fail('A cart token or a signed-in session is required.')

return (
    "SELECT o.Id, o.Reference, o.Email, o.Name, o.Surname, o.Currency, o.SubtotalCents, o.ShippingCents, o.TaxCents, o.TotalCents, "
    "o.Status, o.PaymentStatus, o.FulfillmentStatus, o.PaidAt, o.CreatedAt, o.ShippingAddressJson, "
    "p.Id AS PaymentRowId, p.ConnectPaymentId, p.Status AS PaymentRowStatus, p.PaymentUrl, "
    "(SELECT json_group_array(json_object('Title', i.Title, 'VariantTitle', i.VariantTitle, 'Sku', i.Sku, 'ImageUrl', i.ImageUrl, "
    "   'Qty', i.Qty, 'UnitPriceCents', i.UnitPriceCents, 'LineTotalCents', i.LineTotalCents)) "
    " FROM (SELECT * FROM order_items WHERE OrderId = o.Id ORDER BY Id) i) AS ItemsJson "
    "FROM orders o LEFT JOIN payments p ON p.Id = (SELECT Id FROM payments WHERE OrderId = o.Id ORDER BY Id DESC LIMIT 1) "
    "WHERE o.Reference = " + q(ref) + " AND (" + ' OR '.join(owner) + ") LIMIT 1;"
)
