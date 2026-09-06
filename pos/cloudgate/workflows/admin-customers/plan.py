user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')

skip = clamp(d.get('skip'), 0, 1000000, 0)
take = clamp(d.get('take'), 1, 500, 50)

DETAIL = ("SELECT c.*, (SELECT COUNT(*) FROM sales s WHERE s.CustomerId = c.Id AND s.Status IN ('completed','refunded','partially_refunded')) AS SalesCount, "
          "(SELECT COALESCE(SUM(s.TotalCents), 0) FROM sales s WHERE s.CustomerId = c.Id AND s.Status IN ('completed','refunded','partially_refunded')) AS SpentCents, "
          "(SELECT json_group_array(json_object('Id', s.Id, 'Reference', s.Reference, 'TotalCents', s.TotalCents, 'Status', s.Status, 'CompletedAt', s.CompletedAt)) FROM (SELECT * FROM sales WHERE CustomerId = c.Id AND Status IN ('completed','refunded','partially_refunded') ORDER BY Id DESC LIMIT 20) s) AS SalesJson "
          "FROM customers c WHERE {where} LIMIT 1;")
if op in ('list', 'search'):
    where = ["1 = 1"]
    term = str(d.get('search') or '').strip()
    if term:
        where.append("(c.Name LIKE " + like(term) + " OR c.Email LIKE " + like(term) + " OR c.Phone LIKE " + like(term) + ")")
    return ("SELECT c.*, (SELECT COUNT(*) FROM sales s WHERE s.CustomerId = c.Id AND s.Status IN ('completed','refunded','partially_refunded')) AS SalesCount, "
            "(SELECT COALESCE(SUM(s.TotalCents), 0) FROM sales s WHERE s.CustomerId = c.Id AND s.Status IN ('completed','refunded','partially_refunded')) AS SpentCents, COUNT(*) OVER() AS TotalCount "
            "FROM customers c WHERE " + ' AND '.join(where) + " ORDER BY c.Name LIMIT " + str(take) + " OFFSET " + str(skip) + ";")
if op == 'get':
    return DETAIL.format(where="c.Id = " + qi(d.get('id'), 0))
if op == 'create':
    name = str(d.get('name') or '').strip()
    if not name:
        fail('Customer name is required.')
    return ("INSERT INTO customers (Name, Email, Phone, Notes) VALUES (" + qs(name, 160) + ", " + qs(d.get('email'), 200) + ", " + qs(d.get('phone'), 60) + ", " + qs(d.get('notes'), 1000) + ");\n" + DETAIL.format(where="c.Id = last_insert_rowid()"))
if op == 'update':
    cid = qi(d.get('id'), 0)
    cols = [col + " = " + qs(d.get(key), n) for key, col, n in (('name', 'Name', 160), ('email', 'Email', 200), ('phone', 'Phone', 60), ('notes', 'Notes', 1000)) if key in d]
    return "UPDATE customers SET " + ', '.join(cols + ["UpdatedAt = CURRENT_TIMESTAMP"]) + " WHERE Id = " + cid + ";\n" + DETAIL.format(where="c.Id = " + cid)
if op == 'delete':
    cid = qi(d.get('id'), 0)
    return "UPDATE sales SET CustomerId = NULL WHERE CustomerId = " + cid + ";\nDELETE FROM customers WHERE Id = " + cid + ";\nSELECT " + cid + " AS Id, 0 AS StillExists;"
fail('Unknown op.')
