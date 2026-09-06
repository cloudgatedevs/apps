# Shared / OrderEmail — compose the order confirmation. Runs on a thread branch after finalisation.
# Expects ${Run} (the reloaded order, with JustPaid = 1 only on the run that marked it paid) and
# ${EmailSettings} (settings rows). Returns '' when nothing should be sent.
import html as _html

rows = rows_of('''${Run}''')
settings = {r.get('Key'): r.get('Value') for r in rows_of('''${EmailSettings}''')}
if not rows:
    return ''
o = rows[0]
if to_int(o.get('JustPaid'), 0) != 1 or str(o.get('PaymentStatus') or '') != 'paid':
    return ''

store = str(settings.get('store_name') or 'Shop')
store_url = str(settings.get('store_url') or '').rstrip('/')
support = str(settings.get('support_email') or '')
currency = str(o.get('Currency') or 'ZAR').upper()
items = load_json(o.get('ItemsJson'), []) or []
addr = load_json(o.get('ShippingAddressJson'), None) or {}


def money(c):
    return currency + ' ' + '{:,.2f}'.format(to_int(c, 0) / 100.0)


def esc(v):
    return _html.escape(str(v if v is not None else ''))


line_rows = ''.join(
    '<tr><td style="padding:8px 0;border-bottom:1px solid #eee">' + esc(i.get('Title')) +
    ('<div style="color:#777;font-size:12px">' + esc(i.get('VariantTitle')) + '</div>' if i.get('VariantTitle') and i.get('VariantTitle') != 'Default' else '') +
    '</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">' + esc(i.get('Qty')) +
    '</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">' + esc(money(i.get('LineTotalCents'))) + '</td></tr>'
    for i in items)
address_lines = '<br>'.join(esc(x) for x in (
    ' '.join(x for x in (o.get('Name'), o.get('Surname')) if x), addr.get('line1'), addr.get('line2'),
    ', '.join(x for x in (addr.get('city'), addr.get('region')) if x), ' '.join(x for x in (addr.get('postalCode'), addr.get('country')) if x)) if x)
ref = str(o.get('Reference') or '')
order_link = (store_url + '/account/orders/' + ref) if store_url else ''

html_body = (
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
    '<h1 style="font-size:20px;margin:24px 0 8px">Thanks for your order, ' + esc(o.get('Name') or 'there') + '!</h1>'
    '<p style="margin:0 0 16px;color:#52525b">Order <strong>' + esc(ref) + '</strong> is paid and being prepared.</p>'
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + line_rows +
    '<tr><td colspan="2" style="padding:8px 0;text-align:right;color:#52525b">Subtotal</td><td style="padding:8px 0;text-align:right">' + esc(money(o.get('SubtotalCents'))) + '</td></tr>'
    '<tr><td colspan="2" style="padding:4px 0;text-align:right;color:#52525b">Shipping</td><td style="padding:4px 0;text-align:right">' + esc(money(o.get('ShippingCents'))) + '</td></tr>'
    '<tr><td colspan="2" style="padding:4px 0;text-align:right;color:#52525b">Tax (included)</td><td style="padding:4px 0;text-align:right">' + esc(money(o.get('TaxCents'))) + '</td></tr>'
    '<tr><td colspan="2" style="padding:8px 0;text-align:right;font-weight:600">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:600">' + esc(money(o.get('TotalCents'))) + '</td></tr>'
    '</table>'
    '<h2 style="font-size:14px;margin:24px 0 4px">Delivery address</h2><p style="margin:0;color:#52525b;font-size:14px">' + address_lines + '</p>'
    + ('<p style="margin:24px 0"><a href="' + esc(order_link) + '" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">View your order</a></p>' if order_link else '')
    + '<p style="margin:24px 0 0;color:#a1a1aa;font-size:12px">' + esc(store) + (' &middot; ' + esc(support) if support else '') + '</p></div>'
)
text_body = ('Thanks for your order, ' + str(o.get('Name') or 'there') + '. Order ' + ref + ' is paid and being prepared. Total ' + money(o.get('TotalCents')) + '.' +
             (' View it at ' + order_link if order_link else ''))

return out({
    'to': o.get('Email'), 'from': support or ('noreply@' + (store_url.split('//')[-1].split('/')[0] if store_url else 'example.com')),
    'fromName': store, 'subject': store + ' order ' + ref + ' confirmed', 'html': html_body, 'text': text_body, 'reference': ref,
})
