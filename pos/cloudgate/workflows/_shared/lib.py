import json as _json
import re as _re
import datetime as _dt
import uuid as _uuid

def value(name):
    return _inputs.get(name, '')

def load_json(raw, default=None):
    if isinstance(raw, (dict, list)):
        return raw
    if raw is None or raw == 'No records found':
        return default
    try:
        return _json.loads(str(raw))
    except (ValueError, TypeError):
        return default

def rows_of(raw):
    """Database node output -> list of row dicts (empty list for 'No records found')."""
    data = load_json(raw, [])
    if isinstance(data, dict):
        return [data]
    return [r for r in data or [] if isinstance(r, dict)]

def body():
    """The JSON request body as a dict ({} when empty or malformed)."""
    data = load_json(value('body'), {})
    return data if isinstance(data, dict) else {}

def op_of(d, default):
    return str(d.get('op') or default).strip().lower()

def out(data):
    return _json.dumps(data, ensure_ascii=False, default=str)

def fail(message):
    raise Exception(message)

def q(v):
    if v is None:
        return 'NULL'
    return 'CONVERT(nvarchar(max),0x' + str(v).encode('utf-16le').hex() + ')'

def qs(v, max_len=None, default=None):
    """Quoted trimmed string, NULL when empty."""
    if v is None:
        return 'NULL' if default is None else q(default)
    s = str(v).strip()
    if not s:
        return 'NULL' if default is None else q(default)
    if max_len:
        s = s[:max_len]
    return q(s)

def qi(v, default=None):
    """Integer literal or NULL (or default)."""
    try:
        if v is None or v == '':
            return 'NULL' if default is None else str(int(default))
        return str(int(v))
    except Exception:
        return 'NULL' if default is None else str(int(default))

def qb(v):
    return '1' if v in (True, 1, '1', 'true', 'True', 'yes', 'on') else '0'

def to_int(v, default=0):
    try:
        if v is None or v == '':
            return default
        return int(v)
    except Exception:
        return default

def clamp(v, lo, hi, default):
    n = to_int(v, default)
    return max(lo, min(hi, n))

def like(v):
    s = str(v).replace('~', '~~').replace('%', '~%').replace('_', '~_').replace('[', '~[')
    return q('%' + s + '%') + " ESCAPE '~'"

def slugify(s):
    s = _re.sub('[^a-z0-9]+', '-', str(s or '').lower()).strip('-')
    return s[:120] or 'item'

def now_sql():
    return _dt.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

def cents(v, default=None):
    """Money input -> integer cents. Accepts ints (cents) or strings like '349.00' (major units)."""
    if v is None or v == '':
        return default
    try:
        if isinstance(v, bool):
            return default
        if isinstance(v, int):
            return v
        s = str(v).strip()
        if '.' in s or ',' in s:
            return int(round(float(s.replace(',', '')) * 100))
        return int(s)
    except Exception:
        return default

def idp_user(raw):
    """IdP Authorize (UserInfo output) -> dict or None for anonymous."""
    u = load_json(raw, None)
    if not isinstance(u, dict):
        return None
    if not (u.get('Id') or u.get('id')) and (not u.get('Email')):
        return None
    return u

def idp_user_id(raw):
    try:
        return int(str(raw).strip() or 0)
    except Exception:
        return 0

def require_admin(raw):
    u = idp_user(raw)
    if not u:
        fail('Sign in required.')
    if str(u.get('Role') or '').strip().lower() not in ('admin', 'administrator', 'owner'):
        fail('Admin role required.')
    if u.get('IsActive') is False:
        fail('Account disabled.')
    return u

def require_teller(raw):
    """POS till actions: any signed-in IdP user, whatever their role (the default 'User' role is
    enough). Only the back office is restricted, by require_admin()."""
    u = idp_user(raw)
    if not u:
        fail('Sign in required.')
    if u.get('IsActive') is False:
        fail('Account disabled.')
    return u

def user_id_of(u):
    return to_int(u.get('Id') or u.get('id'), 0)

def display_name(u):
    first = str(u.get('Name') or '').strip()
    last = str(u.get('Surname') or '').strip()
    n = first if last and first.lower().endswith(last.lower()) else ' '.join((x for x in (first, last) if x))
    return n or str(u.get('Email') or u.get('UserName') or 'teller')

def qty_of(v, default=1.0):
    try:
        n = float(v)
        return n if n > 0 else default
    except Exception:
        return default

def money_round(x):
    return int(round(x))
