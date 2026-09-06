user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
LIST = "SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.SupplierId = s.Id) AS ProductCount, (SELECT COUNT(*) FROM stock_receipts r WHERE r.SupplierId = s.Id) AS ReceiptCount FROM suppliers s ORDER BY s.Name;"
if op == 'list':
    return LIST
if op == 'create':
    name = str(d.get('name') or '').strip()
    if not name:
        fail('Supplier name is required.')
    return ("INSERT INTO suppliers (Name, ContactName, Email, Phone, Notes) VALUES (" + qs(name, 160) + ", " + qs(d.get('contactName'), 120) + ", " + qs(d.get('email'), 200) + ", " + qs(d.get('phone'), 60) + ", " + qs(d.get('notes'), 1000) + ");\n" + LIST)
if op == 'update':
    sid = qi(d.get('id'), 0)
    cols = []
    for key, col, n in (('name', 'Name', 160), ('contactName', 'ContactName', 120), ('email', 'Email', 200), ('phone', 'Phone', 60), ('notes', 'Notes', 1000)):
        if key in d:
            cols.append(col + " = " + qs(d.get(key), n))
    if 'isActive' in d:
        cols.append("IsActive = " + qb(d.get('isActive')))
    return "UPDATE suppliers SET " + ', '.join(cols + ["UpdatedAt = CURRENT_TIMESTAMP"]) + " WHERE Id = " + sid + ";\n" + LIST
if op == 'delete':
    sid = qi(d.get('id'), 0)
    return "UPDATE products SET SupplierId = NULL WHERE SupplierId = " + sid + ";\nDELETE FROM suppliers WHERE Id = " + sid + ";\n" + LIST
fail('Unknown op.')
