import json as _payment_json
from urllib.parse import quote as _payment_quote
rows = _payment_json.loads(payment_request_value('Load') or '[]')
o = rows[0] if rows else {}
d = _payment_json.loads(payment_request_value('body') or '{}')
settings = _payment_json.loads(o.get('SettingsJson') or '{}')
sale = _payment_json.loads(o.get('SaleJson') or '{}')
configured = settings.get('store_url')
reference = sale.get('Reference')
base = payment_return_base(configured, payment_request_value('Header_Origin'), d.get('returnBase'))
return base + '/pay/cancel?ref=' + _payment_quote(str(reference or ''), safe='')
