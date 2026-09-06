user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
LIST = "SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.CategoryId = c.Id AND p.Status = 'active') AS ProductCount FROM categories c ORDER BY c.SortOrder, c.Name;"
if op == 'list':
    return LIST
if op == 'create':
    name = str(d.get('name') or '').strip()
    if not name:
        fail('Category name is required.')
    return ("INSERT INTO categories (Name, Color, SortOrder, IsActive) VALUES (" + qs(name, 120) + ", " + qs(d.get('color'), 16) + ", (SELECT COALESCE(MAX(SortOrder), 0) + 1 FROM categories), " + qb(d.get('isActive', True)) + ");\n" + LIST)
if op == 'update':
    cid = qi(d.get('id'), 0)
    cols = []
    if 'name' in d:
        cols.append("Name = " + qs(d.get('name'), 120))
    if 'color' in d:
        cols.append("Color = " + qs(d.get('color'), 16))
    if 'isActive' in d:
        cols.append("IsActive = " + qb(d.get('isActive')))
    return ("UPDATE categories SET " + ', '.join(cols + ["UpdatedAt = CURRENT_TIMESTAMP"]) + " WHERE Id = " + cid + ";\n" + LIST)
if op == 'delete':
    cid = qi(d.get('id'), 0)
    return "UPDATE products SET CategoryId = NULL WHERE CategoryId = " + cid + ";\nDELETE FROM categories WHERE Id = " + cid + ";\n" + LIST
if op == 'reorder':
    ids = [to_int(x, 0) for x in (d.get('ids') or [])]
    return "\n".join("UPDATE categories SET SortOrder = " + str(i + 1) + " WHERE Id = " + str(cid) + ";" for i, cid in enumerate(ids) if cid > 0) + "\n" + LIST
fail('Unknown op.')
