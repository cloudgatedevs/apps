# Cart — build SQL. Anonymous allowed; the cart token is the only credential.
#
# Cloudgate substitutes ${newguid} with a fresh GUID before this script runs, which is how a
# brand-new cart gets its token without a round trip.
uid = idp_user_id('''${IdpAuth}''')
d = body()
op = op_of(d, 'get')

MAX_LINE_QTY = 99
NEW_TOKEN = '${newguid}'

token = str(d.get('token') or '').strip()
if token and (len(token) > 64 or not all(c.isalnum() or c in '-_' for c in token)):
    fail('Invalid cart token.')

# Available quantity for a variant; untracked products are effectively unlimited.
AVAILABLE = "CASE WHEN p.TrackInventory = 0 THEN 999999 ELSE MAX(0, v.StockQty - v.ReservedQty) END"


def cart_id_expr(tok):
    return "(SELECT Id FROM carts WHERE Token = " + q(tok) + " AND Status = 'open')"


def select_cart_sql(tok):
    """The cart with live line data. Returns no rows when the token is unknown."""
    cid = cart_id_expr(tok)
    return (
        "SELECT c.Id, c.Token, c.IdpUserId, c.Status, c.Currency, c.CreatedAt, c.UpdatedAt, "
        "(SELECT json_group_array(json_object("
        "   'VariantId', ci.VariantId, 'ProductId', ci.ProductId, 'Qty', ci.Qty, 'AddedPriceCents', ci.UnitPriceCents, "
        "   'Slug', p.Slug, 'Title', p.Name, 'VariantTitle', v.Title, 'Sku', v.Sku, "
        "   'UnitPriceCents', COALESCE(v.PriceCents, p.PriceCents), "
        "   'AvailableQty', " + AVAILABLE + ", "
        "   'IsActive', CASE WHEN v.IsActive = 1 AND p.Status = 'active' THEN 1 ELSE 0 END, "
        "   'ImageUrl', COALESCE((SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id AND i.VariantId = v.Id ORDER BY i.Position, i.Id LIMIT 1), "
        "                        (SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id LIMIT 1)))) "
        " FROM cart_items ci JOIN product_variants v ON v.Id = ci.VariantId JOIN products p ON p.Id = ci.ProductId "
        " WHERE ci.CartId = c.Id ORDER BY ci.Id) AS ItemsJson "
        "FROM carts c WHERE c.Id = " + cid + " LIMIT 1;"
    )


def attach_user_sql(tok):
    if uid <= 0:
        return []
    return ["UPDATE carts SET IdpUserId = " + str(uid) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Token = " + q(tok) + " AND IdpUserId IS NULL;"]


def touch_sql(tok):
    return ["UPDATE carts SET UpdatedAt = CURRENT_TIMESTAMP WHERE Token = " + q(tok) + ";"]


def upsert_line_sql(tok, variant_id, qty, replace):
    """Insert or update one line, validated and clamped against the live catalogue."""
    cid = cart_id_expr(tok)
    new_qty = str(qty) if replace else "cart_items.Qty + " + str(qty)
    return (
        "INSERT INTO cart_items (CartId, ProductId, VariantId, Qty, UnitPriceCents) "
        "SELECT " + cid + ", p.Id, v.Id, MIN(" + str(qty) + ", " + AVAILABLE + ", " + str(MAX_LINE_QTY) + "), COALESCE(v.PriceCents, p.PriceCents) "
        "FROM product_variants v JOIN products p ON p.Id = v.ProductId "
        "WHERE v.Id = " + str(variant_id) + " AND v.IsActive = 1 AND p.Status = 'active' AND " + cid + " IS NOT NULL "
        "ON CONFLICT(CartId, VariantId) DO UPDATE SET "
        "  Qty = MIN(" + new_qty + ", (SELECT " + AVAILABLE + " FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.Id = " + str(variant_id) + "), " + str(MAX_LINE_QTY) + "), "
        "  UpdatedAt = CURRENT_TIMESTAMP;"
    )


if op == 'get':
    if not token:
        return "SELECT NULL AS Id WHERE 0;"
    return '\n'.join(attach_user_sql(token) + [select_cart_sql(token)])

if op == 'add':
    variant_id = to_int(d.get('variantId'), 0)
    qty = clamp(d.get('qty'), 1, MAX_LINE_QTY, 1)
    if variant_id <= 0:
        fail('variantId is required.')
    parts = ["BEGIN;"]
    if not token:
        token = NEW_TOKEN
        parts.append("INSERT INTO carts (Token, IdpUserId, Currency) VALUES (" + q(token) + ", " + (str(uid) if uid > 0 else 'NULL') + ", "
                     "COALESCE((SELECT Value FROM settings WHERE Key = 'currency'), 'ZAR'));")
    else:
        # An unknown or converted token silently starts a fresh cart with the same token.
        parts.append("INSERT INTO carts (Token, IdpUserId, Currency) SELECT " + q(token) + ", " + (str(uid) if uid > 0 else 'NULL') + ", "
                     "COALESCE((SELECT Value FROM settings WHERE Key = 'currency'), 'ZAR') WHERE NOT EXISTS (SELECT 1 FROM carts WHERE Token = " + q(token) + " AND Status = 'open');")
    parts.append(upsert_line_sql(token, variant_id, qty, replace=False))
    parts += attach_user_sql(token) + touch_sql(token)
    parts.append("COMMIT;")
    parts.append(select_cart_sql(token))
    return '\n'.join(parts)

if op in ('update', 'remove'):
    variant_id = to_int(d.get('variantId'), 0)
    if not token or variant_id <= 0:
        fail('token and variantId are required.')
    qty = 0 if op == 'remove' else clamp(d.get('qty'), 0, MAX_LINE_QTY, 0)
    cid = cart_id_expr(token)
    parts = ["BEGIN;"]
    if qty <= 0:
        parts.append("DELETE FROM cart_items WHERE CartId = " + cid + " AND VariantId = " + str(variant_id) + ";")
    else:
        parts.append(upsert_line_sql(token, variant_id, qty, replace=True))
    parts += touch_sql(token)
    parts.append("COMMIT;")
    parts.append(select_cart_sql(token))
    return '\n'.join(parts)

if op == 'clear':
    if not token:
        fail('token is required.')
    return '\n'.join([
        "DELETE FROM cart_items WHERE CartId = " + cart_id_expr(token) + ";",
    ] + touch_sql(token) + [select_cart_sql(token)])

fail('Unknown op: ' + op)
