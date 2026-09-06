# Shared / OrderEmail (status) — tell the customer their order shipped, was delivered or was cancelled.
# Runs on a thread branch off admin-orders set-status. Expects ${Run} (reloaded order with ItemsJson),
# ${EmailSettings} (settings rows) and the request body (status, tracking, notifyCustomer).
# Returns '' when nothing should be sent, so SendEmail exits cleanly.
import html as _html

d = body()
if op_of(d, 'list') != 'set-status' or d.get('notifyCustomer') in (False, 0, '0', 'false', 'no'):
    return ''
status = str(d.get('status') or '').lower()
if status not in ('shipped', 'delivered', 'cancelled'):
    return ''
rows = rows_of('''${Run}''')
settings = {r.get('Key'): r.get('Value') for r in rows_of('''${EmailSettings}''')}
if not rows:
    return ''
o = rows[0]
if str(o.get('Status') or '').lower() != status or not o.get('Email'):
    return ''

store = str(settings.get('store_name') or 'Shop')
store_url = str(settings.get('store_url') or '').rstrip('/')
support = str(settings.get('support_email') or '')
currency = str(o.get('Currency') or 'ZAR').upper()
items = load_json(o.get('ItemsJson'), []) or []
ref = str(o.get('Reference') or '')
first = str(o.get('Name') or 'there')
carrier = str(d.get('carrier') or '').strip()[:60]
tracking = str(d.get('trackingNumber') or '').strip()[:80]
tracking_url = str(d.get('trackingUrl') or '').strip()[:500]
note = str(d.get('note') or '').strip()[:500]
order_link = (store_url + '/account/orders/' + ref) if store_url else ''


def esc(v):
    return _html.escape(str(v if v is not None else ''))


def money(c):
    return currency + ' ' + '{:,.2f}'.format(to_int(c, 0) / 100.0)


if status == 'shipped':
    subject = store + ' order ' + ref + ' is on its way'
    heading = 'Your order is on its way, ' + first + '!'
    lead = 'Order <strong>' + esc(ref) + '</strong> has shipped' + (' with ' + esc(carrier) if carrier else '') + '.'
    lead_text = 'Order ' + ref + ' has shipped' + (' with ' + carrier if carrier else '') + '.'
elif status == 'delivered':
    subject = store + ' order ' + ref + ' was delivered'
    heading = 'Your order has arrived, ' + first + '.'
    lead = 'Order <strong>' + esc(ref) + '</strong> is marked as delivered. We hope you love it.'
    lead_text = 'Order ' + ref + ' is marked as delivered.'
else:
    paid = str(o.get('PaymentStatus') or '') in ('paid', 'refunded', 'partially_refunded')
    subject = store + ' order ' + ref + ' was cancelled'
    heading = 'Your order was cancelled, ' + first + '.'
    lead = 'Order <strong>' + esc(ref) + '</strong> has been cancelled.' + (' Any payment taken is refunded to the original card.' if paid else '')
    lead_text = 'Order ' + ref + ' has been cancelled.'

tracking_html = ''
tracking_text = ''
if tracking or tracking_url:
    shown = esc(tracking or tracking_url)
    tracking_html = '<p style="margin:0 0 16px;color:#52525b">Tracking: ' + (('<a href="' + esc(tracking_url) + '">' + shown + '</a>') if tracking_url else shown) + '</p>'
    tracking_text = ' Tracking: ' + (tracking + ' ' if tracking else '') + (tracking_url or '')
note_html = ('<p style="margin:0 0 16px;color:#52525b">' + esc(note) + '</p>') if note else ''

line_rows = ''.join(
    '<tr><td style="padding:6px 0;border-bottom:1px solid #eee">' + esc(i.get('Title')) +
    ('<div style="color:#777;font-size:12px">' + esc(i.get('VariantTitle')) + '</div>' if i.get('VariantTitle') and i.get('VariantTitle') != 'Default' else '') +
    '</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center">' + esc(i.get('Qty')) +
    '</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">' + esc(money(i.get('LineTotalCents'))) + '</td></tr>'
    for i in items)

html_body = (
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
    '<h1 style="font-size:20px;margin:24px 0 8px">' + esc(heading) + '</h1>'
    '<p style="margin:0 0 16px;color:#52525b">' + lead + '</p>' + tracking_html + note_html +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + line_rows + '</table>'
    + ('<p style="margin:24px 0"><a href="' + esc(order_link) + '" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">View your order</a></p>' if order_link else '')
    + '<p style="margin:24px 0 0;color:#a1a1aa;font-size:12px">' + esc(store) + (' &middot; ' + esc(support) if support else '') + '</p></div>'
)
text_body = heading + ' ' + lead_text + tracking_text + (' ' + note if note else '') + (' View it at ' + order_link if order_link else '')

return out({
    'to': o.get('Email'), 'from': support or ('noreply@' + (store_url.split('//')[-1].split('/')[0] if store_url else 'example.com')),
    'fromName': store, 'subject': subject, 'html': html_body, 'text': text_body, 'reference': ref,
})
