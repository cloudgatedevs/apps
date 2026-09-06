# POS Receipt / OrderEmail — compose the receipt email (text + HTML) from the sale row and settings.
rows = rows_of('''${Run}''')
if not rows:
    return ''
s = dict(rows[0])
items = load_json(s.get('ItemsJson'), []) or []
payments = load_json(s.get('PaymentsJson'), []) or []
settings = {r.get('Key'): (r.get('Value') or '') for r in rows_of('''${EmailSettings}''')}
d = body()
to = str(d.get('to') or '').strip()
if '@' not in to:
    return ''
cur = str(s.get('Currency') or 'ZAR')


def money(c):
    n = to_int(c, 0)
    return cur + ' ' + ('%d.%02d' % (abs(n) // 100, abs(n) % 100)) if n >= 0 else '-' + cur + ' ' + ('%d.%02d' % (abs(n) // 100, abs(n) % 100))


def qty(v):
    f = float(v or 0)
    return str(int(f)) if f == int(f) else ('%.3f' % f).rstrip('0').rstrip('.')


store = settings.get('store_name') or 'Receipt'
lines = [store, '']
for k in ('store_address', 'store_phone', 'tax_number'):
    if settings.get(k):
        lines.append(settings[k])
lines += ['', 'Receipt ' + str(s.get('Reference')), 'Date ' + str(s.get('CompletedAt') or s.get('CreatedAt')), 'Served by ' + str(s.get('TellerName') or ''), '']
for i in items:
    lines.append(qty(i.get('Qty')) + ' x ' + str(i.get('Name')) + '  ' + money(i.get('LineTotalCents')))
lines += ['', 'Subtotal ' + money(s.get('SubtotalCents'))]
if to_int(s.get('DiscountCents'), 0):
    lines.append('Discount -' + money(s.get('DiscountCents')))
lines += ['Tax ' + money(s.get('TaxCents')), 'TOTAL ' + money(s.get('TotalCents')), '']
for p in payments:
    if p.get('Status') == 'succeeded':
        lines.append(str(p.get('Method')).title() + ' ' + money(p.get('AmountCents')) + ((' (tendered ' + money(p.get('TenderedCents')) + ', change ' + money(p.get('ChangeCents')) + ')') if p.get('Method') == 'cash' else ''))
if settings.get('receipt_footer'):
    lines += ['', settings['receipt_footer']]
text = '\n'.join(lines)

rows_html = ''.join('<tr><td style="padding:4px 0">' + qty(i.get('Qty')) + ' &times; ' + str(i.get('Name')) + '</td><td style="padding:4px 0;text-align:right">' + money(i.get('LineTotalCents')) + '</td></tr>' for i in items)
pays_html = ''.join('<tr><td style="padding:2px 0;color:#555">' + str(p.get('Method')).title() + '</td><td style="padding:2px 0;text-align:right">' + money(p.get('AmountCents')) + '</td></tr>' for p in payments if p.get('Status') == 'succeeded')
html = (
    '<div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:0 auto;color:#111">'
    '<h2 style="margin:0 0 4px">' + store + '</h2>'
    + ''.join('<div style="color:#555;font-size:13px">' + settings[k] + '</div>' for k in ('store_address', 'store_phone', 'tax_number') if settings.get(k)) +
    '<p style="margin:16px 0 4px;font-size:13px;color:#555">Receipt <strong style="color:#111">' + str(s.get('Reference')) + '</strong> &middot; ' + str(s.get('CompletedAt') or s.get('CreatedAt')) + '<br>Served by ' + str(s.get('TellerName') or '') + '</p>'
    '<table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:12px 0">' + rows_html + '</table>'
    '<table style="width:100%;font-size:14px"><tr><td>Subtotal</td><td style="text-align:right">' + money(s.get('SubtotalCents')) + '</td></tr>'
    + ('<tr><td>Discount</td><td style="text-align:right">-' + money(s.get('DiscountCents')) + '</td></tr>' if to_int(s.get('DiscountCents'), 0) else '') +
    '<tr><td>Tax</td><td style="text-align:right">' + money(s.get('TaxCents')) + '</td></tr>'
    '<tr><td style="font-weight:700;font-size:16px;padding-top:6px">Total</td><td style="text-align:right;font-weight:700;font-size:16px;padding-top:6px">' + money(s.get('TotalCents')) + '</td></tr>' + pays_html + '</table>'
    + ('<p style="margin-top:16px;font-size:13px;color:#555">' + settings['receipt_footer'] + '</p>' if settings.get('receipt_footer') else '') +
    '</div>'
)
return out({'to': to, 'subject': 'Your receipt ' + str(s.get('Reference')) + ' from ' + store, 'text': text, 'html': html, 'reference': s.get('Reference'), 'replyTo': settings.get('support_email') or None})
