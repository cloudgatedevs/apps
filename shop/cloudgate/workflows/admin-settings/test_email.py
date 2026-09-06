# Admin Settings / OrderEmail (test) — a small message so the admin can confirm the SMTP settings work.
import html as _html

d = body()
to = str(d.get('to') or '').strip()
settings = {r.get('Key'): (r.get('Value') or '') for r in rows_of('''${EmailSettings}''')}
store = str(settings.get('store_name') or 'Shop')
store_url = str(settings.get('store_url') or '')
subject = store + ': test email from the back office'
text = ('This is a test message from ' + store + '. If you are reading it, order confirmations and shipping notices '
        'will reach your customers.' + (' Store: ' + store_url if store_url else ''))
html_body = ('<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
             '<h1 style="font-size:20px;margin:24px 0 8px">Email is working</h1>'
             '<p style="margin:0 0 16px;color:#52525b">This is a test message from <strong>' + _html.escape(store) + '</strong>. '
             'If you are reading it, order confirmations and shipping notices will reach your customers.</p>'
             + ('<p style="margin:0;color:#a1a1aa;font-size:12px">' + _html.escape(store_url) + '</p>' if store_url else '') + '</div>')
return out({'to': to, 'subject': subject, 'text': text, 'html': html_body, 'reference': 'test'})
