# ---- pos shared helpers ------------------------------------------------------------
# Prepended to every Function/Condition node script by cloudgate/deploy.py. Cloudgate runs
# each script standalone (CPython via pythonnet) inside a `def main():` wrapper, so nothing
# here can be imported — it is inlined. Keep it small and dependency-free.
#
# Cloudgate substitutes ${key} placeholders as raw text BEFORE the script runs, then doubles
# any \" it finds (PrepLambda). Consequences for these helpers:
#   * never write the two characters backslash+quote in a script; use \x22 in regexes.
#   * JSON pasted into a triple-quoted string arrives with \" intact but \\ collapsed;
#     load_json() repairs that.
import json as _json
import re as _re
import datetime as _dt

def _fix_backslashes(s):
    # Restore any backslash that is not followed by a valid JSON escape character.
    return _re.sub(r'\\(?![\x22\\/bfnrtu])', r'\\\\', s)

def load_json(raw, default=None):
    """Parse text Cloudgate substituted into the script (a request body, a prior node's output)."""
    if raw is None:
        return default
    raw = str(raw).strip()
    if not raw or raw == 'No records found':
        return default
    try:
        return _json.loads(raw, strict=False)
    except Exception:
        try:
            return _json.loads(_fix_backslashes(raw), strict=False)
        except Exception:
            return default

def rows_of(raw):
    """Database node output -> list of row dicts (empty list for 'No records found')."""
    data = load_json(raw, [])
    if isinstance(data, dict):
        return [data]
    return [r for r in (data or []) if isinstance(r, dict)]

def body():
    """The JSON request body as a dict ({} when empty or malformed)."""
    data = load_json("""${body}""", {})
    return data if isinstance(data, dict) else {}

def op_of(d, default):
    return str(d.get('op') or default).strip().lower()

def out(data):
    return _json.dumps(data, ensure_ascii=False, default=str)

def fail(message):
    # A raised exception becomes an HTTP 400 with this message as the body.
    raise Exception(message)

# ---- SQL fragment builders (SQLite). Values are quoted here; never interpolate raw input.
def q(v):
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"

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
    """'%term%' ESCAPE clause for LIKE, with wildcards in the term neutralised."""
    s = str(v).replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_').replace("'", "''")
    return "'%" + s + "%' ESCAPE '\\'"

def slugify(s):
    s = _re.sub(r'[^a-z0-9]+', '-', str(s or '').lower()).strip('-')
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

# ---- identity helpers. Pass the substituted IdP node output in from the script.
def idp_user(raw):
    """IdP Authorize (UserInfo output) -> dict or None for anonymous."""
    u = load_json(raw, None)
    if not isinstance(u, dict):
        return None
    if not (u.get('Id') or u.get('id')) and not u.get('Email'):
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


TELLER_ROLES = ('teller', 'cashier', 'manager')

def require_teller(raw):
    """POS terminal actions: a signed-in IdP user with a teller-type role. Admins run the back
    office only; managers may also use the till."""
    u = idp_user(raw)
    if not u:
        fail('Sign in required.')
    if str(u.get('Role') or '').strip().lower() not in TELLER_ROLES:
        fail('This screen is for tellers. Ask an administrator for the Teller role.')
    if u.get('IsActive') is False:
        fail('Account disabled.')
    return u

def user_id_of(u):
    return to_int(u.get('Id') or u.get('id'), 0)

def display_name(u):
    n = ' '.join(x for x in (str(u.get('Name') or '').strip(), str(u.get('Surname') or '').strip()) if x)
    return n or str(u.get('Email') or u.get('UserName') or 'teller')

def qty_of(v, default=1.0):
    try:
        n = float(v)
        return n if n > 0 else default
    except Exception:
        return default

def money_round(x):
    return int(round(x))
