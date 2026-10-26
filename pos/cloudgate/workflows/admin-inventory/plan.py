user = require_admin(value('IdpAuth'))
actor = str(user.get('Email') or user.get('Id') or 'admin')
d = body()
op = op_of(d, 'levels')
skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)
LEVEL_COLS = "p.Id, p.Name, p.Sku, p.Barcode, p.CategoryId, c.Name AS CategoryName, p.PriceCents, p.CostCents, p.StockQty, p.LowStockThreshold, p.TrackInventory, p.Unit, p.IsWeighed, p.ImageUrl, p.Status, p.UpdatedAt, COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS REAL) FROM settings WHERE [Key] = 'low_stock_threshold'), 5) AS Threshold"
if op == 'levels':
    where = ['p.TrackInventory = 1']
    if d.get('lowStock'):
        where.append("p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS REAL) FROM settings WHERE [Key] = 'low_stock_threshold'), 5)")
    if d.get('categoryId'):
        where.append('p.CategoryId = ' + qi(d.get('categoryId')))
    term = str(d.get('search') or '').strip()
    if term:
        where.append('(p.Name LIKE ' + like(term) + ' OR p.Sku LIKE ' + like(term) + ' OR p.Barcode LIKE ' + like(term) + ')')
    return 'SELECT ' + LEVEL_COLS + ', COUNT_BIG(*) OVER () AS TotalCount FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE ' + ' AND '.join(where) + " ORDER BY CASE WHEN p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS FLOAT) FROM settings WHERE [Key] = 'low_stock_threshold'), 5) THEN 1 ELSE 0 END DESC, p.Name OFFSET " + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'movements':
    where = ['1 = 1']
    if d.get('productId'):
        where.append('m.ProductId = ' + qi(d.get('productId')))
    if d.get('reason'):
        where.append('m.Reason = ' + qs(d.get('reason'), 20))
    return 'SELECT m.*, p.Name AS ProductName, p.Sku, COUNT_BIG(*) OVER () AS TotalCount FROM inventory_movements AS m JOIN products AS p ON p.Id = m.ProductId WHERE ' + ' AND '.join(where) + ' ORDER BY m.Id DESC OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'adjust':
    pid = qi(d.get('productId'), 0)
    reason = str(d.get('reason') or 'adjust').lower()
    if reason not in ('adjust', 'count', 'receive', 'damage', 'void'):
        fail('Invalid reason.')
    if d.get('newQty') not in (None, ''):
        delta_sql = repr(float(d.get('newQty'))) + ' - (SELECT StockQty FROM products WHERE Id = ' + pid + ')'
    else:
        delta = float(d.get('delta') or 0)
        if delta == 0:
            fail('Enter a quantity change.')
        delta_sql = repr(delta)
    return '\n'.join(['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT ' + pid + ', ' + delta_sql + ', ' + q(reason) + ', ' + qs(d.get('reference'), 80) + ', ' + qs(d.get('note'), 300) + ', ' + q(actor) + ' WHERE EXISTS(SELECT 1 FROM products WHERE Id = ' + pid + ');', 'UPDATE products SET StockQty = (SELECT COALESCE(SUM(Delta), 0) FROM inventory_movements WHERE ProductId = ' + pid + '), UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + ';', 'COMMIT TRANSACTION;', 'SELECT ' + LEVEL_COLS + ' FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE p.Id = ' + pid + ';'])
if op == 'receive':
    items = [i for i in d.get('items') or [] if isinstance(i, dict) and to_int(i.get('productId'), 0) > 0 and (qty_of(i.get('qty'), 0) > 0)]
    if not items:
        fail('Add at least one line.')
    parts = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', 'INSERT INTO stock_receipts (Reference, SupplierId, Note, TotalCostCents, CreatedBy) VALUES (' + qs(d.get('reference'), 80, default='GRV-' + now_sql().replace('-', '').replace(':', '').replace(' ', '')) + ', ' + qi(d.get('supplierId')) + ', ' + qs(d.get('note'), 500) + ', 0, ' + q(actor) + ');', "INSERT INTO #ctx (k, v) VALUES ('rid', CONVERT(BIGINT, SCOPE_IDENTITY()));"]
    total = 0
    for i in items:
        pid = str(to_int(i.get('productId'), 0))
        qty = qty_of(i.get('qty'), 0)
        cost = cents(i.get('unitCostCents', i.get('unitCost')), 0) or 0
        total += money_round(qty * cost)
        parts.append("INSERT INTO stock_receipt_items (ReceiptId, ProductId, Qty, UnitCostCents) VALUES ((SELECT v FROM #ctx WHERE k = 'rid'), " + pid + ', ' + repr(qty) + ', ' + str(cost) + ');')
        parts.append('INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT ' + pid + ', ' + repr(qty) + ", 'receive', (SELECT Reference FROM stock_receipts WHERE Id = (SELECT v FROM #ctx WHERE k = 'rid')), 'Goods received', " + q(actor) + ';')
        parts.append('UPDATE products SET StockQty = StockQty + ' + repr(qty) + (', CostCents = ' + str(cost) if cost > 0 else '') + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + ';')
    parts.append('UPDATE stock_receipts SET TotalCostCents = ' + str(total) + " WHERE Id = (SELECT v FROM #ctx WHERE k = 'rid');")
    parts.append('COMMIT TRANSACTION;')
    parts.append("SELECT r.*, s.Name AS SupplierName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Qty AS [Qty], i.UnitCostCents AS [UnitCostCents], p.Name AS [Name], p.Sku AS [Sku] FROM stock_receipt_items AS i JOIN products AS p ON p.Id = i.ProductId WHERE i.ReceiptId = r.Id FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson FROM stock_receipts AS r LEFT JOIN suppliers AS s ON s.Id = r.SupplierId WHERE r.Id = (SELECT v FROM #ctx WHERE k = 'rid');")
    parts.append('DROP TABLE IF EXISTS #ctx;')
    return '\n'.join(parts)
if op == 'receipts':
    return 'SELECT r.*, s.Name AS SupplierName, (SELECT COUNT_BIG(*) FROM stock_receipt_items AS i WHERE i.ReceiptId = r.Id) AS LineCount, COUNT_BIG(*) OVER () AS TotalCount FROM stock_receipts AS r LEFT JOIN suppliers AS s ON s.Id = r.SupplierId ORDER BY r.Id DESC OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'receipt':
    rid = qi(d.get('id'), 0)
    return 'SELECT r.*, s.Name AS SupplierName, (SELECT i.Id AS [Id], i.ProductId AS [ProductId], i.Qty AS [Qty], i.UnitCostCents AS [UnitCostCents], p.Name AS [Name], p.Sku AS [Sku] FROM stock_receipt_items AS i JOIN products AS p ON p.Id = i.ProductId WHERE i.ReceiptId = r.Id FOR JSON PATH, INCLUDE_NULL_VALUES) AS ItemsJson FROM stock_receipts AS r LEFT JOIN suppliers AS s ON s.Id = r.SupplierId WHERE r.Id = ' + rid + ';'
if op == 'count':
    items = [i for i in d.get('items') or [] if isinstance(i, dict) and to_int(i.get('productId'), 0) > 0 and (i.get('countedQty') not in (None, ''))]
    if not items:
        fail('Enter counted quantities.')
    parts = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;']
    for i in items:
        pid = str(to_int(i.get('productId'), 0))
        counted = float(i.get('countedQty') or 0)
        parts.append('INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT ' + pid + ', ' + repr(counted) + " - StockQty, 'count', " + qs(d.get('reference'), 80, default='COUNT') + ', ' + qs(d.get('note'), 300) + ', ' + q(actor) + ' FROM products WHERE Id = ' + pid + ' AND StockQty <> ' + repr(counted) + ';')
        parts.append('UPDATE products SET StockQty = ' + repr(counted) + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + pid + ';')
    parts.append('COMMIT TRANSACTION;')
    parts.append("SELECT COUNT_BIG(*) AS Counted FROM inventory_movements WHERE Reason = 'count' AND CreatedAt >= DATEADD(minute,-1,SYSUTCDATETIME());")
    return '\n'.join(parts)
fail('Unknown op.')
