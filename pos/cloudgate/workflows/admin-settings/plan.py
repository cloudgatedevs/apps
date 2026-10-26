user = require_admin(value('IdpAuth'))
d = body()
op = op_of(d, 'get')

def _int_nonneg(v):
    n = to_int(v, None)
    return None if n is None or n < 0 else str(n)

def _text(maxlen):
    return lambda v: str(v).strip()[:maxlen] if v is not None else None

def _bool(v):
    return qb(v)

def _currency(v):
    s = str(v or '').strip().upper()
    return s if len(s) == 3 and s.isalpha() else None

def _port(v):
    n = to_int(v, None)
    return str(n) if n is not None and 1 <= n <= 65535 else None

def _security(v):
    s = str(v or '').strip().lower()
    return s if s in ('ssl', 'starttls', 'none') else None

def _hex(v):
    s = str(v or '').strip().lower()
    return s if s == '' or (len(s) == 7 and s[0] == '#' and all((c in '0123456789abcdef' for c in s[1:]))) else None

def _email_opt(v):
    s = str(v or '').strip()[:200]
    return s if not s or ('@' in s and '.' in s.split('@')[-1]) else None
EDITABLE = {'store_name': _text(120), 'store_tagline': _text(200), 'store_address': _text(400), 'store_phone': _text(60), 'support_email': _email_opt, 'store_url': _text(2048), 'store_logo_url': _text(2048), 'store_icon_url': _text(2048), 'currency': _currency, 'tax_rate_bp': _int_nonneg, 'prices_include_tax': _bool, 'tax_number': _text(60), 'sale_reference_prefix': _text(10), 'receipt_header': _text(300), 'receipt_footer': _text(600), 'payment_cash_enabled': _bool, 'payment_card_enabled': _bool, 'allow_negative_stock': _bool, 'require_shift': _bool, 'low_stock_threshold': _int_nonneg, 'quick_cash_amounts': _text(80), 'label_size': _text(20), 'theme_primary': _hex, 'theme_secondary': _hex}
SECRET_KEYS = ('smtp_password',)
if op == 'get':
    return "SELECT [Key], [Value], UpdatedAt FROM settings WHERE [Key] NOT LIKE 'smtp_%' ORDER BY [Key];"
if op == 'set':
    values = d.get('values') if isinstance(d.get('values'), dict) else {k: v for k, v in d.items() if k != 'op'}
    parts = []
    for k, v in values.items():
        key = str(k).strip().lower()
        if key not in EDITABLE:
            fail('Setting not editable: ' + key)
        if key in SECRET_KEYS and (not str(v or '').strip()):
            continue
        val = EDITABLE[key](v)
        if val is None:
            fail('Invalid value for ' + key)
        parts.append('UPDATE settings WITH (UPDLOCK,HOLDLOCK) SET [Value]=' + q(val) + ',UpdatedAt=SYSUTCDATETIME() WHERE [Key]=' + q(key) + '; IF @@ROWCOUNT=0 INSERT INTO settings ([Key],[Value]) VALUES (' + q(key) + ',' + q(val) + ');')
    if not parts:
        fail('No settings supplied.')
    return '\n'.join(parts) + "SELECT [Key], [Value], UpdatedAt FROM settings WHERE [Key] NOT LIKE 'smtp_%' ORDER BY [Key];"
if op == 'send-test':
    to = str(d.get('to') or user.get('Email') or '').strip()
    if not to or '@' not in to:
        fail('A recipient email address is required.')
    return "SELECT [Key], [Value], UpdatedAt FROM settings WHERE [Key] NOT LIKE 'smtp_%' ORDER BY [Key];"
fail('Unknown op: ' + op)
