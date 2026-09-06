# Admin Inventory — build SQL. Requires IdP admin.
user = require_admin('''${IdpAuth}''')
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
op = op_of(d, 'stock')

REASONS = ('receive', 'adjust', 'sale', 'refund', 'cancel', 'correction', 'damaged', 'returned')

STOCK_SELECT = (
    "SELECT v.Id, v.ProductId, p.Name AS ProductName, p.Slug AS ProductSlug, p.Status AS ProductStatus, p.TrackInventory, "
    "v.Sku, v.Title, v.OptionsJson, COALESCE(v.PriceCents, p.PriceCents) AS PriceCents, v.CostCents, "
    "v.StockQty, v.ReservedQty, v.StockQty - v.ReservedQty AS AvailableQty, v.LowStockThreshold, v.IsActive, v.UpdatedAt, "
    "(SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id AND (i.VariantId = v.Id OR i.VariantId IS NULL) ORDER BY i.VariantId IS NULL, i.Position, i.Id LIMIT 1) AS ThumbUrl "
)

if op == 'stock':
    where = ['v.IsActive = 1', "p.Status <> 'archived'"]
    term = str(d.get('search') or '').strip()
    if term:
        lk = like(term)
        where.append('(p.Name LIKE ' + lk + ' OR v.Sku LIKE ' + lk + ' OR v.Title LIKE ' + lk + ' OR v.Barcode LIKE ' + lk + ')')
    if d.get('productId'):
        where.append('v.ProductId = ' + qi(d.get('productId'), 0))
    if qb(d.get('lowStock')) == '1':
        where.append('v.StockQty <= v.LowStockThreshold')
    if qb(d.get('outOfStock')) == '1':
        where.append('v.StockQty - v.ReservedQty <= 0')
    sorts = {'name': 'p.Name, v.Position', 'stock': 'v.StockQty ASC, p.Name', 'updated': 'v.UpdatedAt DESC', 'sku': 'v.Sku'}
    order = sorts.get(str(d.get('sort') or '').lower(), sorts['name'])
    take = clamp(d.get('take'), 1, 500, 100)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return (STOCK_SELECT + ", COUNT(*) OVER () AS TotalCount FROM product_variants v JOIN products p ON p.Id = v.ProductId "
            "WHERE " + ' AND '.join(where) + " ORDER BY " + order + " LIMIT " + str(take) + " OFFSET " + str(skip) + ";")

if op == 'low-stock':
    take = clamp(d.get('take'), 1, 200, 20)
    return (STOCK_SELECT + ", COUNT(*) OVER () AS TotalCount FROM product_variants v JOIN products p ON p.Id = v.ProductId "
            "WHERE v.IsActive = 1 AND p.Status = 'active' AND p.TrackInventory = 1 AND v.StockQty <= v.LowStockThreshold "
            "ORDER BY (v.StockQty - v.ReservedQty) ASC, p.Name LIMIT " + str(take) + ";")

if op == 'adjust':
    vid = to_int(d.get('variantId'), 0)
    if vid <= 0:
        fail('variantId is required.')
    reason = str(d.get('reason') or 'adjust').lower()
    if reason not in REASONS:
        fail('Invalid reason.')
    note = qs(d.get('note'), 500)
    ref = qs(d.get('reference'), 120)
    if d.get('setTo') is not None and d.get('setTo') != '':
        target = to_int(d.get('setTo'), None)
        if target is None or target < 0:
            fail('setTo must be a non-negative integer.')
        delta_expr = str(target) + " - (SELECT StockQty FROM product_variants WHERE Id = " + str(vid) + ")"
    else:
        delta = to_int(d.get('delta'), None)
        if delta is None or delta == 0:
            fail('delta must be a non-zero integer (or pass setTo).')
        delta_expr = str(delta)
    return (
        "BEGIN;\n"
        "INSERT INTO inventory_movements (VariantId, ProductId, Delta, Reason, Reference, Note, CreatedBy) "
        "SELECT v.Id, v.ProductId, " + delta_expr + ", " + q(reason) + ", " + ref + ", " + note + ", " + q(actor) + " "
        "FROM product_variants v WHERE v.Id = " + str(vid) + " AND (" + delta_expr + ") <> 0;\n"
        "UPDATE product_variants SET StockQty = MAX(0, StockQty + (" + delta_expr + ")), UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(vid) + ";\n"
        "COMMIT;\n" + STOCK_SELECT + " FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.Id = " + str(vid) + ";"
    )

if op == 'set-threshold':
    vid = to_int(d.get('variantId'), 0)
    thr = to_int(d.get('lowStockThreshold'), None)
    if vid <= 0 or thr is None or thr < 0:
        fail('variantId and lowStockThreshold are required.')
    return ("UPDATE product_variants SET LowStockThreshold = " + str(thr) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(vid) + ";\n" +
            STOCK_SELECT + " FROM product_variants v JOIN products p ON p.Id = v.ProductId WHERE v.Id = " + str(vid) + ";")

if op == 'movements':
    where = ['1=1']
    if d.get('variantId'):
        where.append('m.VariantId = ' + qi(d.get('variantId'), 0))
    if d.get('productId'):
        where.append('m.ProductId = ' + qi(d.get('productId'), 0))
    if d.get('reason'):
        where.append('m.Reason = ' + qs(d.get('reason'), 30))
    if d.get('reference'):
        where.append('m.Reference = ' + qs(d.get('reference'), 120))
    take = clamp(d.get('take'), 1, 500, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return (
        "SELECT m.*, p.Name AS ProductName, v.Sku, v.Title AS VariantTitle, COUNT(*) OVER () AS TotalCount "
        "FROM inventory_movements m JOIN products p ON p.Id = m.ProductId LEFT JOIN product_variants v ON v.Id = m.VariantId "
        "WHERE " + ' AND '.join(where) + " ORDER BY m.CreatedAt DESC, m.Id DESC LIMIT " + str(take) + " OFFSET " + str(skip) + ";"
    )

fail('Unknown op: ' + op)
