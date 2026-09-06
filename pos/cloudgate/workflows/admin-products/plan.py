user = require_admin('''${IdpAuth}''')
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
op = op_of(d, 'list')

skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)

DETAIL = ("SELECT p.*, c.Name AS CategoryName, c.Color AS CategoryColor, s.Name AS SupplierName, "
          "(SELECT json_group_array(json_object('Id', b.Id, 'Barcode', b.Barcode, 'Label', b.Label, 'PackQty', b.PackQty)) FROM (SELECT * FROM product_barcodes WHERE ProductId = p.Id ORDER BY Id) b) AS BarcodesJson, "
          "(SELECT COALESCE(SUM(i.Qty), 0) FROM sale_items i JOIN sales x ON x.Id = i.SaleId WHERE i.ProductId = p.Id AND x.Status IN ('completed','refunded','partially_refunded') AND x.CompletedAt >= datetime('now', '-30 days')) AS Sold30d "
          "FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId LEFT JOIN suppliers s ON s.Id = p.SupplierId WHERE {where} LIMIT 1;")


def columns(src, creating):
    cols = {}
    if creating or 'name' in src:
        name = str(src.get('name') or '').strip()
        if not name:
            fail('Product name is required.')
        cols['Name'] = qs(name, 200)
    for key, col, maxlen in (('sku', 'Sku', 64), ('barcode', 'Barcode', 64), ('unit', 'Unit', 16), ('imageUrl', 'ImageUrl', 2048), ('imageFileId', 'ImageFileId', 64), ('color', 'Color', 16), ('notes', 'Notes', 2000)):
        if key in src:
            cols[col] = qs(src.get(key), maxlen, default='each' if col == 'Unit' else None)
    for key, col in (('categoryId', 'CategoryId'), ('supplierId', 'SupplierId')):
        if key in src:
            cols[col] = qi(src.get(key))
    if creating or 'priceCents' in src or 'price' in src:
        price = cents(src.get('priceCents', src.get('price')), 0 if creating else None)
        if price is not None:
            if price < 0:
                fail('Price cannot be negative.')
            cols['PriceCents'] = str(price)
    if 'costCents' in src or 'cost' in src:
        cols['CostCents'] = qi(cents(src.get('costCents', src.get('cost'))))
    if 'taxRateBp' in src:
        cols['TaxRateBp'] = qi(src.get('taxRateBp'))
    for key, col in (('taxExempt', 'TaxExempt'), ('trackInventory', 'TrackInventory'), ('isWeighed', 'IsWeighed')):
        if key in src:
            cols[col] = qb(src.get(key))
    if 'lowStockThreshold' in src:
        v = src.get('lowStockThreshold')
        cols['LowStockThreshold'] = 'NULL' if v in (None, '') else repr(float(v))
    if 'status' in src:
        st = str(src.get('status') or 'active').lower()
        if st not in ('active', 'inactive'):
            fail('Invalid status.')
        cols['Status'] = q(st)
    if creating and 'stockQty' in src:
        cols['StockQty'] = repr(qty_of(src.get('stockQty'), 0.0)) if src.get('stockQty') not in (None, '') else '0'
    return cols


if op == 'list':
    where = ["1 = 1"]
    st = str(d.get('status') or '').lower()
    if st in ('active', 'inactive'):
        where.append("p.Status = " + q(st))
    if d.get('categoryId'):
        where.append("p.CategoryId = " + qi(d.get('categoryId')))
    if d.get('supplierId'):
        where.append("p.SupplierId = " + qi(d.get('supplierId')))
    if d.get('lowStock'):
        where.append("p.TrackInventory = 1 AND p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST(Value AS REAL) FROM settings WHERE Key = 'low_stock_threshold'), 5)")
    term = str(d.get('search') or '').strip()
    if term:
        where.append("(p.Name LIKE " + like(term) + " OR p.Sku LIKE " + like(term) + " OR p.Barcode LIKE " + like(term) + " OR EXISTS (SELECT 1 FROM product_barcodes b WHERE b.ProductId = p.Id AND b.Barcode LIKE " + like(term) + "))")
    order = {'name': 'p.Name', 'price': 'p.PriceCents DESC', 'stock': 'p.StockQty', 'updated': 'p.UpdatedAt DESC', 'created': 'p.Id DESC'}.get(str(d.get('sort') or 'name'), 'p.Name')
    return ("SELECT p.Id, p.Name, p.Sku, p.Barcode, p.CategoryId, c.Name AS CategoryName, p.PriceCents, p.CostCents, p.StockQty, p.LowStockThreshold, p.TrackInventory, p.Unit, p.IsWeighed, p.ImageUrl, p.Status, p.UpdatedAt, "
            "COUNT(*) OVER() AS TotalCount FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId WHERE " + ' AND '.join(where) + " ORDER BY " + order + " LIMIT " + str(take) + " OFFSET " + str(skip) + ";")

if op == 'get':
    return DETAIL.format(where="p.Id = " + qi(d.get('id'), 0))

if op == 'create':
    cols = columns(d, True)
    parts = ["BEGIN;", "INSERT INTO products (" + ', '.join(cols) + ") VALUES (" + ', '.join(cols.values()) + ");",
             "CREATE TEMP TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v INTEGER);", "DELETE FROM _ctx;", "INSERT INTO _ctx (k, v) VALUES ('pid', last_insert_rowid());"]
    if 'StockQty' in cols and cols['StockQty'] not in ('0', '0.0'):
        parts.append("INSERT INTO inventory_movements (ProductId, Delta, Reason, Note, CreatedBy) VALUES ((SELECT v FROM _ctx WHERE k = 'pid'), " + cols['StockQty'] + ", 'receive', 'Opening stock', " + q(actor) + ");")
    parts += ["COMMIT;", DETAIL.format(where="p.Id = (SELECT v FROM _ctx WHERE k = 'pid')"), "DROP TABLE IF EXISTS _ctx;"]
    return "\n".join(parts)

if op == 'update':
    pid = qi(d.get('id'), 0)
    cols = columns(d, False)
    if not cols:
        return DETAIL.format(where="p.Id = " + pid)
    return "UPDATE products SET " + ', '.join(k + ' = ' + v for k, v in cols.items()) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + pid + ";\n" + DETAIL.format(where="p.Id = " + pid)

if op == 'set-status':
    pid = qi(d.get('id'), 0)
    st = str(d.get('status') or '').lower()
    if st not in ('active', 'inactive'):
        fail('Invalid status.')
    return "UPDATE products SET Status = " + q(st) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + pid + ";\n" + DETAIL.format(where="p.Id = " + pid)

if op == 'delete':
    pid = qi(d.get('id'), 0)
    # Sold products keep their history: they are deactivated instead of removed.
    return "\n".join([
        "UPDATE products SET Status = 'inactive', UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + pid + " AND EXISTS (SELECT 1 FROM sale_items WHERE ProductId = " + pid + ");",
        "DELETE FROM product_barcodes WHERE ProductId = " + pid + " AND NOT EXISTS (SELECT 1 FROM sale_items WHERE ProductId = " + pid + ");",
        "DELETE FROM products WHERE Id = " + pid + " AND NOT EXISTS (SELECT 1 FROM sale_items WHERE ProductId = " + pid + ");",
        "SELECT " + pid + " AS Id, (SELECT COUNT(*) FROM products WHERE Id = " + pid + ") AS StillExists;",
    ])

if op == 'add-barcode':
    pid = qi(d.get('id'), 0)
    code = str(d.get('barcode') or '').strip()
    if not code:
        fail('Enter a barcode.')
    pack = qty_of(d.get('packQty'), 1.0)
    return "\n".join([
        "INSERT INTO product_barcodes (ProductId, Barcode, Label, PackQty) SELECT " + pid + ", " + qs(code, 64) + ", " + qs(d.get('label'), 80) + ", " + repr(pack) +
        " WHERE NOT EXISTS (SELECT 1 FROM product_barcodes WHERE Barcode = " + q(code) + ") AND NOT EXISTS (SELECT 1 FROM products WHERE Barcode = " + q(code) + ");",
        DETAIL.format(where="p.Id = " + pid)])

if op == 'remove-barcode':
    pid = qi(d.get('id'), 0)
    return "DELETE FROM product_barcodes WHERE Id = " + qi(d.get('barcodeId'), 0) + " AND ProductId = " + pid + ";\n" + DETAIL.format(where="p.Id = " + pid)

if op == 'barcode-owner':
    code = str(d.get('barcode') or '').strip()
    return ("SELECT p.Id, p.Name, p.Sku, p.Barcode, p.PriceCents FROM products p LEFT JOIN product_barcodes b ON b.ProductId = p.Id AND b.Barcode = " + q(code) +
            " WHERE p.Barcode = " + q(code) + " OR b.Id IS NOT NULL LIMIT 1;")

if op == 'labels':
    ids = [to_int(x, 0) for x in (d.get('ids') or []) if to_int(x, 0) > 0]
    if not ids:
        fail('Choose products to print.')
    return ("SELECT p.Id, p.Name, p.Sku, p.Barcode, p.PriceCents, p.Unit, (SELECT Value FROM settings WHERE Key = 'currency') AS Currency, (SELECT Value FROM settings WHERE Key = 'store_name') AS StoreName "
            "FROM products p WHERE p.Id IN (" + ','.join(str(i) for i in ids) + ") ORDER BY p.Name;")

if op == 'import':
    rows = [r for r in (d.get('rows') or []) if isinstance(r, dict)]
    if not rows or len(rows) > 2000:
        fail('Provide 1 to 2000 rows.')
    parts = ["BEGIN;"]
    for r in rows:
        name = str(r.get('name') or '').strip()
        if not name:
            continue
        code = str(r.get('barcode') or '').strip()
        price = cents(r.get('price', r.get('priceCents')), 0) or 0
        cost = cents(r.get('cost', r.get('costCents')), None)
        qty = qty_of(r.get('stockQty', r.get('stock')), 0.0) if r.get('stockQty', r.get('stock')) not in (None, '') else 0.0
        cat = str(r.get('category') or '').strip()
        cat_sql = ("(SELECT Id FROM categories WHERE Name = " + q(cat) + " LIMIT 1)") if cat else 'NULL'
        if cat:
            parts.append("INSERT INTO categories (Name) SELECT " + q(cat) + " WHERE NOT EXISTS (SELECT 1 FROM categories WHERE Name = " + q(cat) + ");")
        key = ("Barcode = " + q(code)) if code else ("Sku = " + qs(r.get('sku'), 64)) if r.get('sku') else "Name = " + q(name)
        parts.append("UPDATE products SET Name = " + qs(name, 200) + ", PriceCents = " + str(price) + (", CostCents = " + str(cost) if cost is not None else '') + ", CategoryId = COALESCE(" + cat_sql + ", CategoryId), Sku = COALESCE(" + qs(r.get('sku'), 64) + ", Sku), UpdatedAt = CURRENT_TIMESTAMP WHERE " + key + ";")
        parts.append("INSERT INTO products (Name, Sku, Barcode, CategoryId, PriceCents, CostCents, StockQty) SELECT " + qs(name, 200) + ", " + qs(r.get('sku'), 64) + ", " + qs(code, 64) + ", " + cat_sql + ", " + str(price) + ", " + qi(cost) + ", " + repr(qty) +
                     " WHERE NOT EXISTS (SELECT 1 FROM products WHERE " + key + ");")
    parts.append("COMMIT;")
    parts.append("SELECT COUNT(*) AS Total FROM products;")
    return "\n".join(parts)

if op == 'image-refs':
    return "SELECT ImageFileId AS FileId, ImageUrl AS Url, NULL AS ThumbUrl FROM products WHERE ImageUrl IS NOT NULL AND ImageUrl <> '' UNION ALL SELECT NULL, Value, NULL FROM settings WHERE Key IN ('store_logo_url', 'store_icon_url') AND Value <> '';"

fail('Unknown op.')
