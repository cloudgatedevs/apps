user = require_admin(value('IdpAuth'))
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
op = op_of(d, 'list')
STATUSES = ('draft', 'active', 'archived')

def detail_sql(where):
    """Full product for the back office: options, all variants (with stock + cost), images."""
    return "SELECT TOP 1 p.*, c.Name AS CategoryName, c.Slug AS CategorySlug, (SELECT o.Id AS [Id], o.Name AS [Name], o.Position AS [Position], JSON_QUERY((SELECT ov.Id AS [Id], ov.[Value] AS [Value], ov.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM product_option_values WHERE OptionId = o.Id ORDER BY Position, Id) AS ov FOR JSON PATH, INCLUDE_NULL_VALUES), '$') AS [Values] FROM (SELECT TOP 2147483647 * FROM product_options WHERE ProductId = p.Id ORDER BY Position, Id) AS o FOR JSON PATH, INCLUDE_NULL_VALUES) AS OptionsJson, (SELECT v.Id AS [Id], v.Sku AS [Sku], v.Barcode AS [Barcode], v.Title AS [Title], JSON_QUERY(COALESCE(v.OptionsJson, '{}'), '$') AS [Options], v.PriceCents AS [PriceCents], v.CompareAtCents AS [CompareAtCents], v.CostCents AS [CostCents], v.StockQty AS [StockQty], v.ReservedQty AS [ReservedQty], v.LowStockThreshold AS [LowStockThreshold], v.ImageId AS [ImageId], v.IsDefault AS [IsDefault], v.IsActive AS [IsActive], v.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM product_variants WHERE ProductId = p.Id ORDER BY Position, Id) AS v FOR JSON PATH, INCLUDE_NULL_VALUES) AS VariantsJson, (SELECT i.Id AS [Id], i.Url AS [Url], i.ThumbUrl AS [ThumbUrl], i.Alt AS [Alt], i.FileId AS [FileId], i.VariantId AS [VariantId], i.Position AS [Position] FROM (SELECT TOP 2147483647 * FROM product_images WHERE ProductId = p.Id ORDER BY Position, Id) AS i FOR JSON PATH, INCLUDE_NULL_VALUES) AS ImagesJson FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE " + where + ';'

def product_columns(src, creating):
    """Column assignments from the request payload. Returns dict col -> SQL literal."""
    cols = {}
    if creating or 'name' in src:
        name = str(src.get('name') or '').strip()
        if not name:
            fail('Product name is required.')
        cols['Name'] = qs(name, 200)
    if creating or 'slug' in src:
        cols['Slug'] = q(slugify(src.get('slug') or src.get('name')))
    for key, col, maxlen in (('sku', 'Sku', 64), ('brand', 'Brand', 120), ('shortDescription', 'ShortDescription', 500), ('description', 'Description', 20000), ('tags', 'Tags', 500), ('currency', 'Currency', 3)):
        if key in src:
            cols[col] = qs(src.get(key), maxlen)
    if 'categoryId' in src:
        cols['CategoryId'] = qi(src.get('categoryId'))
    if creating or 'priceCents' in src or 'price' in src:
        price = cents(src.get('priceCents', src.get('price')), 0 if creating else None)
        if price is not None:
            if price < 0:
                fail('Price cannot be negative.')
            cols['PriceCents'] = str(price)
    if 'compareAtCents' in src or 'compareAt' in src:
        cols['CompareAtCents'] = qi(cents(src.get('compareAtCents', src.get('compareAt'))))
    if 'costCents' in src or 'cost' in src:
        cols['CostCents'] = qi(cents(src.get('costCents', src.get('cost'))))
    if 'status' in src:
        st = str(src.get('status') or 'draft').lower()
        if st not in STATUSES:
            fail('Invalid status.')
        cols['Status'] = q(st)
    elif creating:
        cols['Status'] = q('draft')
    for key, col in (('trackInventory', 'TrackInventory'), ('isFeatured', 'IsFeatured')):
        if key in src:
            cols[col] = qb(src.get(key))
    if 'weightGrams' in src:
        cols['WeightGrams'] = qi(src.get('weightGrams'))
    if 'sortOrder' in src:
        cols['SortOrder'] = qi(src.get('sortOrder'), 0)
    return cols

def options_sql(pid_expr, options):
    """Replace the option axes + values for a product."""
    parts = ['DELETE FROM product_option_values WHERE OptionId IN (SELECT Id FROM product_options WHERE ProductId = ' + pid_expr + ');', 'DELETE FROM product_options WHERE ProductId = ' + pid_expr + ';']
    for pos, o in enumerate(options or []):
        oname = str((o or {}).get('name') or '').strip()
        if not oname:
            continue
        parts.append('INSERT INTO product_options (ProductId, Name, Position) VALUES (' + pid_expr + ', ' + qs(oname, 60) + ', ' + str(pos) + ');')
        oid_expr = '(SELECT Id FROM product_options WHERE ProductId = ' + pid_expr + ' AND Name = ' + qs(oname, 60) + ')'
        seen = set()
        for vpos, val in enumerate((o or {}).get('values') or []):
            v = str(val if not isinstance(val, dict) else val.get('value') or '').strip()
            if not v or v.lower() in seen:
                continue
            seen.add(v.lower())
            parts.append('INSERT INTO product_option_values (OptionId, [Value], Position) VALUES (' + oid_expr + ', ' + qs(v, 60) + ', ' + str(vpos) + ');')
    return parts

def variant_title(v):
    t = str(v.get('title') or '').strip()
    if t:
        return t
    opts = v.get('options') or {}
    if isinstance(opts, dict) and opts:
        return ' / '.join((str(x) for x in opts.values()))
    return 'Default'

def variants_sql(pid_expr, variants, creating, has_variants):
    """Upsert variants. Stock is only seeded on create; later changes go through admin-inventory."""
    parts = []
    incoming = [v for v in variants or [] if isinstance(v, dict)]
    if not incoming and creating:
        incoming = [{'title': 'Default', 'isDefault': True, 'stockQty': 0}]
    keep_ids = []
    for pos, v in enumerate(incoming):
        opts = v.get('options') if isinstance(v.get('options'), dict) else None
        cols = {'Sku': qs(v.get('sku'), 64), 'Barcode': qs(v.get('barcode'), 64), 'Title': qs(variant_title(v), 120), 'OptionsJson': q(out(opts)) if opts else 'NULL', 'PriceCents': qi(cents(v.get('priceCents', v.get('price')))), 'CompareAtCents': qi(cents(v.get('compareAtCents', v.get('compareAt')))), 'CostCents': qi(cents(v.get('costCents', v.get('cost')))), 'LowStockThreshold': qi(v.get('lowStockThreshold'), 5), 'ImageId': qi(v.get('imageId')), 'IsDefault': qb(v.get('isDefault')) if 'isDefault' in v else '1' if pos == 0 else '0', 'IsActive': qb(v.get('isActive', True)), 'Position': str(pos)}
        vid = to_int(v.get('id'), 0)
        if vid > 0 and (not creating):
            keep_ids.append(vid)
            sets = ', '.join((k + ' = ' + val for k, val in cols.items()))
            parts.append('UPDATE product_variants SET ' + sets + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(vid) + ' AND ProductId = ' + pid_expr + ';')
        else:
            stock = max(0, to_int(v.get('stockQty'), 0))
            cols['StockQty'] = str(stock)
            parts.append('INSERT INTO product_variants (ProductId, ' + ', '.join(cols.keys()) + ') VALUES (' + pid_expr + ', ' + ', '.join(cols.values()) + ');')
            if stock > 0:
                parts.append('INSERT INTO inventory_movements (VariantId, ProductId, Delta, Reason, Reference, Note, CreatedBy) VALUES (CONVERT(BIGINT, SCOPE_IDENTITY()), ' + pid_expr + ', ' + str(stock) + ", 'receive', 'INITIAL', 'Opening stock', " + q(actor) + ');')
    if not creating and variants is not None:
        keep = ', '.join((str(i) for i in keep_ids)) or '0'
        parts.append('UPDATE product_variants SET IsActive = 0, UpdatedAt = SYSUTCDATETIME() WHERE ProductId = ' + pid_expr + ' AND NOT Id IN (' + keep + ') AND Id IN (SELECT VariantId FROM order_items UNION SELECT VariantId FROM cart_items);')
        parts.append('DELETE FROM product_variants WHERE ProductId = ' + pid_expr + ' AND NOT Id IN (' + keep + ') AND NOT Id IN (SELECT VariantId FROM order_items UNION SELECT VariantId FROM cart_items);')
    parts.append('UPDATE product_variants SET IsDefault = 0 WHERE ProductId = ' + pid_expr + ' AND Id <> (SELECT TOP 1 Id FROM product_variants WHERE ProductId = ' + pid_expr + ' ORDER BY IsDefault DESC, Position, Id);')
    parts.append('UPDATE product_variants SET IsDefault = 1 WHERE Id = (SELECT TOP 1 Id FROM product_variants WHERE ProductId = ' + pid_expr + ' ORDER BY IsDefault DESC, Position, Id);')
    return parts
if op == 'list':
    where = ['1=1']
    st = str(d.get('status') or '').lower()
    if st in STATUSES:
        where.append('p.Status = ' + q(st))
    elif st != 'all' and (not st):
        where.append("p.Status <> 'archived'")
    if d.get('categoryId'):
        where.append('p.CategoryId = ' + qi(d.get('categoryId'), 0))
    term = str(d.get('search') or '').strip()
    if term:
        lk = like(term)
        where.append('(p.Name LIKE ' + lk + ' OR p.Sku LIKE ' + lk + ' OR p.Brand LIKE ' + lk + ' OR p.Tags LIKE ' + lk + ' OR EXISTS (SELECT 1 FROM product_variants v WHERE v.ProductId = p.Id AND v.Sku LIKE ' + lk + '))')
    if qb(d.get('lowStock')) == '1':
        where.append('EXISTS (SELECT 1 FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1 AND v.StockQty <= v.LowStockThreshold)')
    sorts = {'newest': 'p.CreatedAt DESC', 'name': 'p.Name ASC', 'price': 'p.PriceCents ASC', 'stock': 'StockQty ASC', 'updated': 'p.UpdatedAt DESC'}
    order = sorts.get(str(d.get('sort') or '').lower(), sorts['updated'])
    take = clamp(d.get('take'), 1, 200, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return 'SELECT p.Id, p.Name, p.Slug, p.Sku, p.Brand, p.Status, p.PriceCents, p.CompareAtCents, p.CostCents, p.Currency, p.HasVariants, p.TrackInventory, p.IsFeatured, p.CategoryId, c.Name AS CategoryName, p.CreatedAt, p.UpdatedAt, (SELECT COUNT_BIG(*) FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS VariantCount, (SELECT COALESCE(SUM(v.StockQty), 0) FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS StockQty, (SELECT COUNT_BIG(*) FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1 AND v.StockQty <= v.LowStockThreshold) AS LowStockVariants, (SELECT TOP 1 i.ThumbUrl FROM product_images AS i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id) AS ThumbUrl, (SELECT TOP 1 i.Url FROM product_images AS i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id) AS ImageUrl, COUNT_BIG(*) OVER () AS TotalCount FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE ' + ' AND '.join(where) + ' ORDER BY ' + order + ' OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'get':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    return detail_sql('p.Id = ' + str(pid))

def unique_slug(slug_lit, exclude_id=None):
    """Slug expression that appends a short random suffix when the slug is already taken."""
    cond = 'EXISTS (SELECT 1 FROM products WHERE Slug = ' + slug_lit + (' AND Id <> ' + str(exclude_id) if exclude_id else '') + ')'
    return 'CASE WHEN ' + cond + ' THEN ' + 'CONCAT(' + slug_lit + ", '-', LEFT(REPLACE(CONVERT(varchar(36),NEWID()),'-',''),8)) ELSE " + slug_lit + ' END'
CTX_SETUP = ['CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;']
CTX_TEARDOWN = ['DROP TABLE IF EXISTS #ctx;']
if op == 'create':
    cols = product_columns(d, True)
    cols['HasVariants'] = '1' if d.get('options') or len([v for v in d.get('variants') or [] if isinstance(v, dict)]) > 1 else '0'
    cols['Slug'] = unique_slug(cols['Slug'])
    pid_expr = "(SELECT v FROM #ctx WHERE k = 'pid')"
    parts = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;'] + CTX_SETUP + ['INSERT INTO products (' + ', '.join(cols.keys()) + ') VALUES (' + ', '.join(cols.values()) + ');', "INSERT INTO #ctx (k, v) VALUES ('pid', CONVERT(BIGINT, SCOPE_IDENTITY()));"]
    parts += options_sql(pid_expr, d.get('options'))
    parts += variants_sql(pid_expr, d.get('variants'), True, cols['HasVariants'] == '1')
    parts.append('COMMIT TRANSACTION;')
    parts.append(detail_sql('p.Id = ' + pid_expr))
    parts += CTX_TEARDOWN
    return '\n'.join(parts)
if op == 'update':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    cols = product_columns(d, False)
    if 'Slug' in cols:
        cols['Slug'] = unique_slug(cols['Slug'], pid)
    if 'options' in d:
        cols['HasVariants'] = '1' if d.get('options') else '1' if len([v for v in d.get('variants') or [] if isinstance(v, dict)]) > 1 else '0'
    parts = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;']
    if cols:
        parts.append('UPDATE products SET ' + ', '.join((k + ' = ' + v for k, v in cols.items())) + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(pid) + ';')
    if 'options' in d:
        parts += options_sql(str(pid), d.get('options'))
    if 'variants' in d:
        parts += variants_sql(str(pid), d.get('variants'), False, cols.get('HasVariants') == '1')
    parts.append('UPDATE products SET UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(pid) + ';')
    parts.append('COMMIT TRANSACTION;')
    parts.append(detail_sql('p.Id = ' + str(pid)))
    return '\n'.join(parts)
if op == 'set-status':
    pid = to_int(d.get('id'), 0)
    st = str(d.get('status') or '').lower()
    if pid <= 0 or st not in STATUSES:
        fail('id and a valid status are required.')
    return 'UPDATE products SET Status = ' + q(st) + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(pid) + '; ' + detail_sql('p.Id = ' + str(pid))
if op == 'delete':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    return "SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; UPDATE products SET Status = 'archived', UpdatedAt = SYSUTCDATETIME() WHERE Id = " + str(pid) + ' AND EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM cart_items WHERE ProductId = ' + str(pid) + '; DELETE FROM product_option_values WHERE OptionId IN (SELECT Id FROM product_options WHERE ProductId = ' + str(pid) + ') AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM product_options WHERE ProductId = ' + str(pid) + ' AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM inventory_movements WHERE ProductId = ' + str(pid) + ' AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM product_variants WHERE ProductId = ' + str(pid) + ' AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM product_images WHERE ProductId = ' + str(pid) + ' AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); DELETE FROM products WHERE Id = ' + str(pid) + ' AND NOT EXISTS(SELECT 1 FROM order_items AS oi WHERE oi.ProductId = ' + str(pid) + '); COMMIT TRANSACTION; SELECT ' + str(pid) + ' AS Id, (SELECT COUNT_BIG(*) FROM products WHERE Id = ' + str(pid) + ') AS StillExists;'
if op == 'image-refs':
    return "SELECT FileId, Url, ThumbUrl, 'product' AS Kind, ProductId AS OwnerId FROM product_images UNION ALL SELECT NULL, ImageUrl, NULL, 'category', Id FROM categories WHERE NOT ImageUrl IS NULL AND ImageUrl <> '' UNION ALL SELECT NULL, [Value], NULL, 'setting', NULL FROM settings WHERE [Key] IN ('store_logo_url', 'store_icon_url') AND [Value] <> '' UNION ALL SELECT NULL, BodyMarkdown, NULL, 'page', Id FROM pages WHERE BodyMarkdown LIKE '%http%';"
if op == 'add-image':
    pid = to_int(d.get('id') or d.get('productId'), 0)
    url = str(d.get('url') or '').strip()
    if pid <= 0 or not url:
        fail('productId and url are required.')
    if not (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
        fail('Image url must be absolute.')
    return 'INSERT INTO product_images (ProductId, VariantId, FileId, Url, ThumbUrl, Alt, Position) VALUES (' + str(pid) + ', ' + qi(d.get('variantId')) + ', ' + qs(d.get('fileId'), 64) + ', ' + qs(url, 2048) + ', ' + qs(d.get('thumbUrl') or url, 2048) + ', ' + qs(d.get('alt'), 200) + ', (SELECT COALESCE(MAX(Position), -1) + 1 FROM product_images WHERE ProductId = ' + str(pid) + ')); ' + detail_sql('p.Id = ' + str(pid))
if op == 'remove-image':
    pid = to_int(d.get('id') or d.get('productId'), 0)
    iid = to_int(d.get('imageId'), 0)
    if pid <= 0 or iid <= 0:
        fail('productId and imageId are required.')
    return 'DELETE FROM product_images WHERE Id = ' + str(iid) + ' AND ProductId = ' + str(pid) + '; UPDATE product_variants SET ImageId = NULL WHERE ImageId = ' + str(iid) + '; ' + detail_sql('p.Id = ' + str(pid))
if op == 'reorder-images':
    pid = to_int(d.get('id') or d.get('productId'), 0)
    ids = [to_int(x, 0) for x in d.get('imageIds') or [] if to_int(x, 0) > 0]
    if pid <= 0 or not ids:
        fail('productId and imageIds are required.')
    parts = ['UPDATE product_images SET Position = ' + str(i) + ' WHERE Id = ' + str(iid) + ' AND ProductId = ' + str(pid) + ';' for i, iid in enumerate(ids)]
    return '\n'.join(parts) + '\n' + detail_sql('p.Id = ' + str(pid))
fail('Unknown op: ' + op)
