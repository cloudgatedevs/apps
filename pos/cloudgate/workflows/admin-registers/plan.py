user = require_admin('''${IdpAuth}''')
d = body()
op = op_of(d, 'list')
LIST = ("SELECT r.*, (SELECT s.Id FROM shifts s WHERE s.RegisterId = r.Id AND s.Status = 'open' LIMIT 1) AS OpenShiftId, "
        "(SELECT s.TellerName FROM shifts s WHERE s.RegisterId = r.Id AND s.Status = 'open' LIMIT 1) AS OpenShiftTeller FROM registers r ORDER BY r.Name;")
if op == 'list':
    return LIST
if op == 'create':
    name = str(d.get('name') or '').strip()
    if not name:
        fail('Register name is required.')
    return "INSERT INTO registers (Name, Location) VALUES (" + qs(name, 80) + ", " + qs(d.get('location'), 120) + ");\n" + LIST
if op == 'update':
    rid = qi(d.get('id'), 0)
    cols = []
    if 'name' in d:
        cols.append("Name = " + qs(d.get('name'), 80))
    if 'location' in d:
        cols.append("Location = " + qs(d.get('location'), 120))
    if 'isActive' in d:
        cols.append("IsActive = " + qb(d.get('isActive')))
    if not cols:
        return LIST
    return "UPDATE registers SET " + ', '.join(cols) + " WHERE Id = " + rid + ";\n" + LIST
if op == 'delete':
    rid = qi(d.get('id'), 0)
    return "UPDATE registers SET IsActive = 0 WHERE Id = " + rid + " AND EXISTS (SELECT 1 FROM shifts WHERE RegisterId = " + rid + ");\nDELETE FROM registers WHERE Id = " + rid + " AND NOT EXISTS (SELECT 1 FROM shifts WHERE RegisterId = " + rid + ");\n" + LIST
fail('Unknown op.')
