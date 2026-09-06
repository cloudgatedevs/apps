# POS Catalog / Plan — read-only lookups for the till.
user = require_teller('''${IdpAuth}''')
d = body()
op = op_of(d, 'products')

PRODUCT_COLS = ("p.Id, p.Name, p.Sku, p.Barcode, p.CategoryId, p.PriceCents, p.TaxRateBp, p.TaxExempt, p.TrackInventory, "
                "p.StockQty, p.LowStockThreshold, p.Unit, p.IsWeighed, p.ImageUrl, p.Color, c.Name AS CategoryName, c.Color AS CategoryColor")

if op == 'settings':
    return "SELECT Key, Value FROM settings WHERE Key IN ('store_name','store_tagline','store_address','store_phone','support_email','store_url','store_logo_url','store_icon_url','currency','tax_rate_bp','prices_include_tax','tax_number','receipt_header','receipt_footer','payment_cash_enabled','payment_card_enabled','allow_negative_stock','require_shift','quick_cash_amounts','theme_primary','theme_secondary') ORDER BY Key;"

if op == 'categories':
    return ("SELECT c.Id, c.Name, c.Color, c.SortOrder, (SELECT COUNT(*) FROM products p WHERE p.CategoryId = c.Id AND p.Status = 'active') AS ProductCount "
            "FROM categories c WHERE c.IsActive = 1 ORDER BY c.SortOrder, c.Name;")

if op == 'lookup':
    code = str(d.get('code') or '').strip()
    if not code or len(code) > 64:
        fail('Scan or enter a barcode.')
    return ("SELECT " + PRODUCT_COLS + ", COALESCE(b.PackQty, 1) AS PackQty, b.Label AS PackLabel "
            "FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId "
            "LEFT JOIN product_barcodes b ON b.ProductId = p.Id AND b.Barcode = " + q(code) + " "
            "WHERE p.Status = 'active' AND (p.Barcode = " + q(code) + " OR b.Id IS NOT NULL OR p.Sku = " + q(code) + ") "
            "ORDER BY CASE WHEN p.Barcode = " + q(code) + " THEN 0 WHEN b.Id IS NOT NULL THEN 1 ELSE 2 END LIMIT 1;")

if op == 'products':
    where = ["p.Status = 'active'"]
    if d.get('categoryId'):
        where.append("p.CategoryId = " + qi(d.get('categoryId')))
    term = str(d.get('search') or '').strip()
    if term:
        where.append("(p.Name LIKE " + like(term) + " OR p.Sku LIKE " + like(term) + " OR p.Barcode LIKE " + like(term) + ")")
    skip = clamp(d.get('skip'), 0, 100000, 0)
    take = clamp(d.get('take'), 1, 500, 200)
    return ("SELECT " + PRODUCT_COLS + " FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId WHERE " + ' AND '.join(where) +
            " ORDER BY p.Name LIMIT " + str(take) + " OFFSET " + str(skip) + ";")

fail('Unknown op.')
