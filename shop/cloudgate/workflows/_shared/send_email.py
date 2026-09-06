# Shared / SendEmail — deliver the message composed by the previous node (OrderEmail) over SMTP.
# The shop admin configures the mail server under Back office -> Settings -> Email; the values arrive
# here through ${EmailSettings} (settings rows). Nothing is sent, and nothing fails, until that is done:
# the customer-facing flow never depends on email. Returns {sent, reason?, to?, reference?}.
import smtplib as _smtp
import ssl as _ssl
from email.message import EmailMessage as _EmailMessage
from email.utils import formataddr as _formataddr, make_msgid as _make_msgid

msg = load_json('''${OrderEmail}''', None)
if not isinstance(msg, dict) or not msg.get('to'):
    return out({'sent': False, 'reason': 'nothing to send'})

settings = {r.get('Key'): (r.get('Value') or '') for r in rows_of('''${EmailSettings}''')}
host = str(settings.get('smtp_host') or '').strip()
port = to_int(settings.get('smtp_port'), 0)
security = str(settings.get('smtp_security') or 'starttls').strip().lower()
username = str(settings.get('smtp_user') or '').strip()
password = str(settings.get('smtp_password') or '')
from_email = str(settings.get('smtp_from_email') or settings.get('support_email') or msg.get('from') or '').strip()
from_name = str(settings.get('smtp_from_name') or msg.get('fromName') or settings.get('store_name') or '').strip()

if not host:
    return out({'sent': False, 'reason': 'Email is not set up yet. Add your SMTP server under Settings > Email.', 'to': msg.get('to'), 'reference': msg.get('reference')})
if not from_email:
    return out({'sent': False, 'reason': 'No sender address: set a From email under Settings > Email (or a support email).', 'to': msg.get('to'), 'reference': msg.get('reference')})
if port <= 0:
    port = 465 if security == 'ssl' else 587

mail = _EmailMessage()
mail['Subject'] = str(msg.get('subject') or '(no subject)')
mail['From'] = _formataddr((from_name, from_email)) if from_name else from_email
mail['To'] = str(msg.get('to'))
mail['Message-ID'] = _make_msgid(domain=from_email.split('@')[-1] or None)
if msg.get('replyTo'):
    mail['Reply-To'] = str(msg.get('replyTo'))
mail.set_content(str(msg.get('text') or ''))
if msg.get('html'):
    mail.add_alternative(str(msg.get('html')), subtype='html')

try:
    context = _ssl.create_default_context()
    if security == 'ssl':
        server = _smtp.SMTP_SSL(host, port, timeout=20, context=context)
    else:
        server = _smtp.SMTP(host, port, timeout=20)
    with server:
        server.ehlo()
        if security == 'starttls':
            server.starttls(context=context)
            server.ehlo()
        if username:
            server.login(username, password)
        server.send_message(mail)
    return out({'sent': True, 'to': msg.get('to'), 'reference': msg.get('reference'), 'via': host + ':' + str(port)})
except _smtp.SMTPAuthenticationError as ex:
    return out({'sent': False, 'reason': 'The mail server rejected the username or password (' + str(ex.smtp_code) + ').', 'to': msg.get('to'), 'reference': msg.get('reference')})
except _smtp.SMTPRecipientsRefused:
    return out({'sent': False, 'reason': 'The mail server refused the recipient address ' + str(msg.get('to')) + '.', 'to': msg.get('to'), 'reference': msg.get('reference')})
except Exception as ex:
    return out({'sent': False, 'reason': ('Could not send through ' + host + ':' + str(port) + ' - ' + str(ex))[:300], 'to': msg.get('to'), 'reference': msg.get('reference')})
