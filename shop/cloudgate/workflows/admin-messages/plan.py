# Admin Messages — build SQL. Requires IdP admin.
require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
STATUSES = ('new', 'read', 'replied', 'archived')
COLS = "Id, Name, Email, Subject, Message, OrderReference, Status, IdpUserId, CreatedAt, UpdatedAt"

if op == 'list':
    where = ['1=1']
    st = str(d.get('status') or '').lower()
    if st in STATUSES:
        where.append('Status = ' + q(st))
    elif st == 'open':
        where.append("Status IN ('new','read')")
    term = str(d.get('search') or '').strip()
    if term:
        lk = like(term)
        where.append('(Name LIKE ' + lk + ' OR Email LIKE ' + lk + ' OR Subject LIKE ' + lk + ' OR Message LIKE ' + lk + ' OR OrderReference LIKE ' + lk + ')')
    take = clamp(d.get('take'), 1, 200, 50)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    return ("SELECT " + COLS + ", COUNT(*) OVER () AS TotalCount, (SELECT COUNT(*) FROM contact_messages WHERE Status = 'new') AS NewCount "
            "FROM contact_messages WHERE " + ' AND '.join(where) + " ORDER BY CASE Status WHEN 'new' THEN 0 ELSE 1 END, CreatedAt DESC LIMIT " + str(take) + " OFFSET " + str(skip) + ";")

if op == 'get':
    mid = to_int(d.get('id'), 0)
    if mid <= 0:
        fail('id is required.')
    return ("UPDATE contact_messages SET Status = 'read', UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(mid) + " AND Status = 'new';\n"
            "SELECT " + COLS + " FROM contact_messages WHERE Id = " + str(mid) + " LIMIT 1;")

if op == 'set-status':
    mid = to_int(d.get('id'), 0)
    st = str(d.get('status') or '').lower()
    if mid <= 0 or st not in STATUSES:
        fail('id and a valid status are required.')
    return ("UPDATE contact_messages SET Status = " + q(st) + ", UpdatedAt = CURRENT_TIMESTAMP WHERE Id = " + str(mid) + ";\n"
            "SELECT " + COLS + " FROM contact_messages WHERE Id = " + str(mid) + " LIMIT 1;")

if op == 'delete':
    mid = to_int(d.get('id'), 0)
    if mid <= 0:
        fail('id is required.')
    return "DELETE FROM contact_messages WHERE Id = " + str(mid) + "; SELECT " + str(mid) + " AS Id;"

fail('Unknown op: ' + op)
