user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'list')
LIST_SQL = "SELECT c.*, (SELECT COUNT_BIG(*) FROM products AS p WHERE p.CategoryId = c.Id AND p.Status <> 'archived') AS ProductCount, (SELECT COUNT_BIG(*) FROM categories AS x WHERE x.ParentId = c.Id) AS ChildCount FROM categories AS c ORDER BY CASE WHEN c.ParentId IS NULL THEN 0 ELSE 1 END, c.SortOrder, c.Name;"

def unique_slug(slug_lit, exclude_id=None):
    cond = 'EXISTS (SELECT 1 FROM categories WHERE Slug = ' + slug_lit + (' AND Id <> ' + str(exclude_id) if exclude_id else '') + ')'
    return 'CASE WHEN ' + cond + ' THEN ' + 'CONCAT(' + slug_lit + ", '-', LEFT(REPLACE(CONVERT(varchar(36),NEWID()),'-',''),8)) ELSE " + slug_lit + ' END'

def columns(src, creating):
    cols = {}
    if creating or 'name' in src:
        name = str(src.get('name') or '').strip()
        if not name:
            fail('Category name is required.')
        cols['Name'] = qs(name, 120)
    if creating or 'slug' in src:
        cols['Slug'] = q(slugify(src.get('slug') or src.get('name')))
    if 'description' in src:
        cols['Description'] = qs(src.get('description'), 2000)
    if 'parentId' in src:
        cols['ParentId'] = qi(src.get('parentId'))
    if 'imageUrl' in src:
        cols['ImageUrl'] = qs(src.get('imageUrl'), 2048)
    if 'sortOrder' in src:
        cols['SortOrder'] = qi(src.get('sortOrder'), 0)
    if 'isActive' in src:
        cols['IsActive'] = qb(src.get('isActive'))
    return cols
if op == 'list':
    return LIST_SQL
if op == 'create':
    cols = columns(d, True)
    cols['Slug'] = unique_slug(cols['Slug'])
    return 'INSERT INTO categories (' + ', '.join(cols.keys()) + ') VALUES (' + ', '.join(cols.values()) + '); ' + LIST_SQL
if op == 'update':
    cid = to_int(d.get('id'), 0)
    if cid <= 0:
        fail('id is required.')
    cols = columns(d, False)
    if 'Slug' in cols:
        cols['Slug'] = unique_slug(cols['Slug'], cid)
    if 'ParentId' in cols and cols['ParentId'] == str(cid):
        fail('A category cannot be its own parent.')
    if not cols:
        return LIST_SQL
    return 'UPDATE categories SET ' + ', '.join((k + ' = ' + v for k, v in cols.items())) + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(cid) + '; ' + LIST_SQL
if op == 'reorder':
    ids = [to_int(x, 0) for x in d.get('ids') or [] if to_int(x, 0) > 0]
    if not ids:
        fail('ids are required.')
    return '\n'.join(('UPDATE categories SET SortOrder = ' + str(i) + ' WHERE Id = ' + str(cid) + ';' for i, cid in enumerate(ids))) + '\n' + LIST_SQL
if op == 'delete':
    cid = to_int(d.get('id'), 0)
    if cid <= 0:
        fail('id is required.')
    return 'UPDATE products SET CategoryId = NULL WHERE CategoryId = ' + str(cid) + '; UPDATE categories SET ParentId = (SELECT ParentId FROM categories WHERE Id = ' + str(cid) + ') WHERE ParentId = ' + str(cid) + '; DELETE FROM categories WHERE Id = ' + str(cid) + '; ' + LIST_SQL
fail('Unknown op: ' + op)
