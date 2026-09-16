import json as _payment_json
from urllib.parse import quote as _payment_quote
rows = _payment_json.loads(payment_request_value('CreateOrder') or '[]')
o = rows[0] if rows else {}
d = _payment_json.loads(payment_request_value('body') or '{}')
configured = o.get('StoreUrl')
reference = o.get('Reference')
base = payment_return_base(configured, payment_request_value('Header_Origin'), d.get('returnBase'))
return base + '/checkout/return?ref=' + _payment_quote(str(reference or ''), safe='')
