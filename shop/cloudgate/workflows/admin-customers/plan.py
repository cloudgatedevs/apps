require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'list')
PAID = "o.PaymentStatus IN ('paid','refunded','partially_refunded')"
STATS = '(SELECT COUNT(*) FROM orders o WHERE o.CustomerId = c.Id AND ' + PAID + ') AS Orders, (SELECT COALESCE(SUM(o.TotalCents), 0) FROM orders o WHERE o.CustomerId = c.Id AND ' + PAID + ') AS SpentCents, (SELECT MAX(o.CreatedAt) FROM orders o WHERE o.CustomerId = c.Id AND ' + PAID + ') AS LastOrderAt, (SELECT TOP 1 o.Currency FROM orders o WHERE o.CustomerId = c.Id ORDER BY o.Id DESC) AS Currency '
if op == 'list':
    where = ['1=1']
    term = str(d.get('search') or '').strip()
    if term:
        lk = like(term)
        where.append('(c.Email LIKE ' + lk + ' OR c.Name LIKE ' + lk + ' OR c.Surname LIKE ' + lk + ' OR c.Phone LIKE ' + lk + ')')
    kind = str(d.get('kind') or '').lower()
    if kind == 'accounts':
        where.append('c.IdpUserId IS NOT NULL')
    elif kind == 'guests':
        where.append('c.IdpUserId IS NULL')
    sort = str(d.get('sort') or 'recent').lower()
    order = {'recent': 'LastOrderAt DESC, c.CreatedAt DESC', 'spent': 'SpentCents DESC, c.CreatedAt DESC', 'name': "lower(COALESCE(c.Surname, '')), lower(COALESCE(c.Name, '')), c.Email", 'newest': 'c.CreatedAt DESC'}.get(sort, 'LastOrderAt DESC, c.CreatedAt DESC')
    take = clamp(d.get('take'), 1, 200, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return 'SELECT c.Id, c.IdpUserId, c.Email, c.Name, c.Surname, c.Phone, c.MarketingOptIn, c.CreatedAt, ' + STATS + ', COUNT_BIG(*) OVER () AS TotalCount FROM customers AS c WHERE ' + ' AND '.join(where) + ' ORDER BY ' + order + ' OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY;'
if op == 'get':
    cid = to_int(d.get('id'), 0)
    if cid <= 0:
        fail('id is required.')
    return 'SELECT TOP 1 c.Id, c.IdpUserId, c.Email, c.Name, c.Surname, c.Phone, c.DefaultAddressJson, c.MarketingOptIn, c.CreatedAt, c.UpdatedAt, ' + STATS + ', (SELECT o.Id AS [Id], o.Reference AS [Reference], o.Currency AS [Currency], o.TotalCents AS [TotalCents], o.Status AS [Status], o.PaymentStatus AS [PaymentStatus], o.FulfillmentStatus AS [FulfillmentStatus], o.CreatedAt AS [CreatedAt], (SELECT COALESCE(SUM(i.Qty), 0) FROM order_items AS i WHERE i.OrderId = o.Id) AS [Items] FROM (SELECT TOP 100 * FROM orders WHERE CustomerId = c.Id ORDER BY CreatedAt DESC, Id DESC) AS o FOR JSON PATH, INCLUDE_NULL_VALUES) AS OrdersJson FROM customers AS c WHERE c.Id = ' + str(cid) + ';'
fail('Unknown op: ' + op)
