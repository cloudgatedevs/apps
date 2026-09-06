# Checkout / PaySuccessUrl — where the provider sends the customer after paying.
# The store_url setting wins; a dev client may pass returnBase until it is configured.
import urllib.parse as _up
rows = rows_of('''${CreateOrder}''')
d = body()
o = rows[0] if rows else {}
base = str(o.get('StoreUrl') or '').strip() or str(d.get('returnBase') or '').strip()
if not base.startswith('http://') and not base.startswith('https://'):
    fail('The store URL is not configured (settings.store_url).')
return base.rstrip('/') + '/checkout/return?ref=' + _up.quote(str(o.get('Reference') or ''))
