# Contact / OrderEmail — forward the message to the store's support address (thread branch).
import html as _html
rows = rows_of('''${Run}''')
settings = {r.get('Key'): (r.get('Value') or '') for r in rows_of('''${EmailSettings}''')}
if not rows or to_int(rows[0].get('Id'), 0) <= 0:
    return ''
m = rows[0]
support = str(settings.get('support_email') or settings.get('smtp_from_email') or '').strip()
if not support:
    return ''
store = str(settings.get('store_name') or 'Shop')
store_url = str(settings.get('store_url') or '').rstrip('/')
subject = '[' + store + '] ' + (str(m.get('Subject') or 'New message from the contact form'))


def esc(v):
    return _html.escape(str(v if v is not None else ''))


html_body = (
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#18181b">'
    '<h1 style="font-size:18px;margin:24px 0 8px">New message from ' + esc(m.get('Name') or m.get('Email')) + '</h1>'
    '<p style="margin:0 0 4px;color:#52525b">From: ' + esc(m.get('Email')) + (' · Order ' + esc(m.get('OrderReference')) if m.get('OrderReference') else '') + '</p>'
    '<p style="margin:0 0 16px;color:#52525b">Received: ' + esc(m.get('CreatedAt')) + ' UTC</p>'
    '<div style="white-space:pre-wrap;border:1px solid #e4e4e7;border-radius:12px;padding:16px;font-size:14px">' + esc(m.get('Message')) + '</div>'
    + ('<p style="margin:16px 0 0"><a href="' + esc(store_url + '/admin/messages') + '" style="color:#4f46e5">Open in the back office</a></p>' if store_url else '')
    + '</div>'
)
text_body = 'New message from ' + str(m.get('Name') or m.get('Email')) + ' <' + str(m.get('Email')) + '>' + (' about order ' + str(m.get('OrderReference')) if m.get('OrderReference') else '') + ':' + chr(10) + chr(10) + str(m.get('Message'))
return out({'to': support, 'replyTo': m.get('Email'), 'subject': subject, 'html': html_body, 'text': text_body, 'reference': 'contact-' + str(m.get('Id'))})
