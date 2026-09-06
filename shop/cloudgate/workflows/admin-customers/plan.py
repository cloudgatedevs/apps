# Admin Customers — build SQL. Requires IdP admin.
require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')

# Paid orders count towards lifetime value; a guest who later registers with the same
# email is one customer row (checkout matches on IdP user first, then email).
PAID = "o.PaymentStatus IN ('paid','refunded','partially_refunded')"
STATS = (
    "(SELECT COUNT(*) FROM orders o WHERE o.CustomerId = c.Id AND " + PAID + ") AS Orders, "
    "(SELECT COALESCE(SUM(o.TotalCents), 0) FROM orders o WHERE o.CustomerId = c.Id AND " + PAID + ") AS SpentCents, "
    "(SELECT MAX(o.CreatedAt) FROM orders o WHERE o.CustomerId = c.Id AND " + PAID + ") AS LastOrderAt, "
    "(SELECT o.Currency FROM orders o WHERE o.CustomerId = c.Id ORDER BY o.Id DESC LIMIT 1) AS Currency "
)

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
    order = {
        'recent': 'LastOrderAt DESC NULLS LAST, c.CreatedAt DESC',
        'spent': 'SpentCents DESC, c.CreatedAt DESC',
        'name': "lower(COALESCE(c.Surname, '')), lower(COALESCE(c.Name, '')), c.Email",
        'newest': 'c.CreatedAt DESC',
    }.get(sort, 'LastOrderAt DESC NULLS LAST, c.CreatedAt DESC')
    take = clamp(d.get('take'), 1, 200, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return (
        "SELECT c.Id, c.IdpUserId, c.Email, c.Name, c.Surname, c.Phone, c.MarketingOptIn, c.CreatedAt, " + STATS + ", "
        "COUNT(*) OVER () AS TotalCount FROM customers c WHERE " + ' AND '.join(where) +
        " ORDER BY " + order + " LIMIT " + str(take) + " OFFSET " + str(skip) + ";"
    )

if op == 'get':
    cid = to_int(d.get('id'), 0)
    if cid <= 0:
        fail('id is required.')
    return (
        "SELECT c.Id, c.IdpUserId, c.Email, c.Name, c.Surname, c.Phone, c.DefaultAddressJson, c.MarketingOptIn, c.CreatedAt, c.UpdatedAt, " + STATS + ", "
        "(SELECT json_group_array(json_object('Id', o.Id, 'Reference', o.Reference, 'Currency', o.Currency, 'TotalCents', o.TotalCents, "
        "   'Status', o.Status, 'PaymentStatus', o.PaymentStatus, 'FulfillmentStatus', o.FulfillmentStatus, 'CreatedAt', o.CreatedAt, "
        "   'Items', (SELECT COALESCE(SUM(i.Qty), 0) FROM order_items i WHERE i.OrderId = o.Id))) "
        " FROM (SELECT * FROM orders WHERE CustomerId = c.Id ORDER BY CreatedAt DESC, Id DESC LIMIT 100) o) AS OrdersJson "
        "FROM customers c WHERE c.Id = " + str(cid) + " LIMIT 1;"
    )

fail('Unknown op: ' + op)
