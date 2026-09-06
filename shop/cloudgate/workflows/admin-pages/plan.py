# Admin Pages — build SQL. Requires IdP admin.
require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
COLS = "Id, Slug, Title, Summary, BodyMarkdown, Status, ShowInNav, ShowInFooter, ShowContact, Position, IsSystem, CreatedAt, UpdatedAt"


def page_sql(where):
    return "SELECT " + COLS + " FROM pages WHERE " + where + " LIMIT 1;"


def fields(src, creating):
    cols = {}
    if 'title' in src or creating:
        t = str(src.get('title') or '').strip()
        if not t:
            fail('A title is required.')
        cols['Title'] = qs(t, 120)
    if 'slug' in src or creating:
        s = slugify(str(src.get('slug') or src.get('title') or ''))
        if not s:
            fail('A slug is required.')
        if s in ('shop', 'cart', 'checkout', 'account', 'contact', 'p', 'admin'):
            fail('That slug is reserved.')
        cols['Slug'] = qs(s, 80)
    if 'summary' in src:
        cols['Summary'] = qs(src.get('summary'), 300)
    if 'bodyMarkdown' in src:
        cols['BodyMarkdown'] = qs(src.get('bodyMarkdown'), 200000)
    if 'status' in src:
        st = str(src.get('status') or 'published').lower()
        if st not in ('draft', 'published'):
            fail('status must be draft or published.')
        cols['Status'] = q(st)
    if 'showInNav' in src:
        cols['ShowInNav'] = qb(src.get('showInNav'))
    if 'showInFooter' in src:
        cols['ShowInFooter'] = qb(src.get('showInFooter'))
    if 'showContact' in src:
        cols['ShowContact'] = qb(src.get('showContact'))
    if 'position' in src:
        cols['Position'] = str(to_int(src.get('position'), 0))
    return cols


if op == 'list':
    return "SELECT " + COLS.replace('BodyMarkdown, ', '') + ", length(BodyMarkdown) AS BodyLength FROM pages ORDER BY Position, Title;"

if op == 'get':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    return page_sql('Id = ' + str(pid))

if op == 'create':
    cols = fields(d, True)
    cols.setdefault('Status', "'published'")
    cols.setdefault('ShowInFooter', '1')
    cols.setdefault('ShowInNav', '0')
    cols.setdefault('Position', '(SELECT COALESCE(MAX(Position), 0) + 10 FROM pages)')
    return ("INSERT INTO pages (" + ', '.join(cols.keys()) + ") VALUES (" + ', '.join(cols.values()) + ");\n" + page_sql('Id = last_insert_rowid()'))

if op == 'update':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    cols = fields(d, False)
    if not cols:
        fail('Nothing to update.')
    return ("UPDATE pages SET " + ', '.join(k + ' = ' + v for k, v in cols.items()) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(pid) + ";\n" + page_sql('Id = ' + str(pid)))

if op == 'delete':
    pid = to_int(d.get('id'), 0)
    if pid <= 0:
        fail('id is required.')
    return ("DELETE FROM pages WHERE Id = " + str(pid) + " AND IsSystem = 0;\n"
            "SELECT " + str(pid) + " AS Id, (SELECT COUNT(*) FROM pages WHERE Id = " + str(pid) + ") AS StillExists;")

if op == 'reorder':
    ids = [to_int(x, 0) for x in (d.get('ids') or []) if to_int(x, 0) > 0]
    if not ids:
        fail('ids are required.')
    return '\n'.join("UPDATE pages SET Position = " + str((i + 1) * 10) + " WHERE Id = " + str(pid) + ";" for i, pid in enumerate(ids)) + "\nSELECT " + COLS.replace('BodyMarkdown, ', '') + ", length(BodyMarkdown) AS BodyLength FROM pages ORDER BY Position, Title;"

fail('Unknown op: ' + op)
