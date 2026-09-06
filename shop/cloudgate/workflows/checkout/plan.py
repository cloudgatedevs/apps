# Checkout / Plan — validate the request, then load the cart lines with live prices and stock.
import re as _re2

uid = idp_user_id('''${IdpAuth}''')
d = body()
op = op_of(d, 'start')
if op != 'start':
    fail('Unknown op: ' + op)

token = str(d.get('token') or '').strip()
if not token or len(token) > 64 or not all(c.isalnum() or c in '-_' for c in token):
    fail('A cart token is required.')

email = str(d.get('email') or '').strip().lower()
if not email or len(email) > 200 or not _re2.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
    fail('A valid email address is required.')

addr = d.get('shippingAddress') if isinstance(d.get('shippingAddress'), dict) else {}
for key, label in (('line1', 'Street address'), ('city', 'City'), ('postalCode', 'Postal code'), ('country', 'Country')):
    if not str(addr.get(key) or '').strip():
        fail(label + ' is required.')

# One row per cart line, with the store settings repeated on every row so Compute
# has everything it needs from a single result set.
return (
    "SELECT c.Id AS CartId, c.Token, c.Status AS CartStatus, "
    "ci.VariantId, ci.ProductId, ci.Qty, p.Name AS Title, p.Slug, v.Title AS VariantTitle, v.Sku, "
    "COALESCE(v.PriceCents, p.PriceCents) AS UnitPriceCents, p.TrackInventory, "
    "CASE WHEN v.IsActive = 1 AND p.Status = 'active' THEN 1 ELSE 0 END AS IsActive, "
    "CASE WHEN p.TrackInventory = 0 THEN 999999 ELSE MAX(0, v.StockQty - v.ReservedQty) END AS AvailableQty, "
    "COALESCE((SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id AND i.VariantId = v.Id ORDER BY i.Position, i.Id LIMIT 1), "
    "         (SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id LIMIT 1)) AS ImageUrl, "
    "(SELECT Value FROM settings WHERE Key = 'currency') AS S_Currency, "
    "(SELECT Value FROM settings WHERE Key = 'shipping_flat_cents') AS S_ShippingFlat, "
    "(SELECT Value FROM settings WHERE Key = 'free_shipping_threshold_cents') AS S_FreeFrom, "
    "(SELECT Value FROM settings WHERE Key = 'tax_rate_bp') AS S_TaxBp, "
    "(SELECT Value FROM settings WHERE Key = 'prices_include_tax') AS S_TaxIncluded, "
    "(SELECT Value FROM settings WHERE Key = 'order_reference_prefix') AS S_Prefix, "
    "(SELECT Value FROM settings WHERE Key = 'order_reference_seed') AS S_Seed, "
    "(SELECT Value FROM settings WHERE Key = 'store_url') AS S_StoreUrl "
    "FROM carts c JOIN cart_items ci ON ci.CartId = c.Id "
    "JOIN product_variants v ON v.Id = ci.VariantId JOIN products p ON p.Id = ci.ProductId "
    "WHERE c.Token = " + q(token) + " AND c.Status = 'open' ORDER BY ci.Id;"
)
