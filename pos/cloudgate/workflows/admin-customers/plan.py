user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'list')
skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)
DETAIL = "SELECT TOP 1 c.*, (SELECT COUNT_BIG(*) FROM sales AS s WHERE s.CustomerId = c.Id AND s.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(s.TotalCents), 0) FROM sales AS s WHERE s.CustomerId = c.Id AND s.Status IN ('completed', 'refunded', 'partially_refunded')) AS SpentCents, (SELECT s.Id AS [Id], s.Reference AS [Reference], s.TotalCents AS [TotalCents], s.Status AS [Status], s.CompletedAt AS [CompletedAt] FROM (SELECT TOP 20 * FROM sales WHERE CustomerId = c.Id AND Status IN ('completed', 'refunded', 'partially_refunded') ORDER BY Id DESC) AS s FOR JSON PATH, INCLUDE_NULL_VALUES) AS SalesJson FROM customers AS c WHERE {where};"
if op in ('list', 'search'):
    where = ['1 = 1']
    term = str(d.get('search') or '').strip()
    if term:
        where.append('(c.Name LIKE ' + like(term) + ' OR c.Email LIKE ' + like(term) + ' OR c.Phone LIKE ' + like(term) + ')')
    return "SELECT c.*, (SELECT COUNT_BIG(*) FROM sales AS s WHERE s.CustomerId = c.Id AND s.Status IN ('completed', 'refunded', 'partially_refunded')) AS SalesCount, (SELECT COALESCE(SUM(s.TotalCents), 0) FROM sales AS s WHERE s.CustomerId = c.Id AND s.Status IN ('completed', 'refunded', 'partially_refunded')) AS SpentCents, COUNT_BIG(*) OVER () AS TotalCount FROM customers AS c WHERE " + ' AND '.join(where) + ' ORDER BY c.Name OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'get':
    return DETAIL.replace('{where}', 'c.Id = ' + qi(d.get('id'), 0))
if op == 'create':
    name = str(d.get('name') or '').strip()
    if not name:
        fail('Customer name is required.')
    return 'INSERT INTO customers (Name, Email, Phone, Notes) VALUES (' + qs(name, 160) + ', ' + qs(d.get('email'), 200) + ', ' + qs(d.get('phone'), 60) + ', ' + qs(d.get('notes'), 1000) + '); ' + DETAIL.replace('{where}', 'c.Id = CONVERT(bigint,SCOPE_IDENTITY())')
if op == 'update':
    cid = qi(d.get('id'), 0)
    cols = [col + ' = ' + qs(d.get(key), n) for key, col, n in (('name', 'Name', 160), ('email', 'Email', 200), ('phone', 'Phone', 60), ('notes', 'Notes', 1000)) if key in d]
    return 'UPDATE customers SET ' + ', '.join(cols + ['UpdatedAt = CURRENT_TIMESTAMP']) + ' WHERE Id = ' + cid + '; ' + DETAIL.replace('{where}', 'c.Id = ' + cid)
if op == 'delete':
    cid = qi(d.get('id'), 0)
    return 'UPDATE sales SET CustomerId = NULL WHERE CustomerId = ' + cid + '; DELETE FROM customers WHERE Id = ' + cid + '; SELECT ' + cid + ' AS Id, 0 AS StillExists;'
fail('Unknown op.')
