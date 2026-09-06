# Contact — validate and store a message from the storefront contact form.
import re as _re
d = body()
if op_of(d, 'send') != 'send':
    fail('Unknown op.')
name = str(d.get('name') or '').strip()[:120]
email = str(d.get('email') or '').strip().lower()
subject = str(d.get('subject') or '').strip()[:200]
message = str(d.get('message') or '').strip()
order_ref = str(d.get('orderReference') or '').strip()[:40]
if not email or len(email) > 200 or not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
    fail('Please enter a valid email address.')
if len(message) < 10:
    fail('Please tell us a little more (at least 10 characters).')
if len(message) > 5000:
    fail('Messages are limited to 5000 characters.')
# Honeypot: bots fill every field; humans never see this one.
if str(d.get('website') or '').strip():
    return "SELECT 0 AS Id, " + q(email) + " AS Email, " + qs(subject) + " AS Subject, '' AS Message, '' AS Name, '' AS OrderReference, CURRENT_TIMESTAMP AS CreatedAt;"
uid = idp_user_id('''${IdpAuth}''')
return (
    "INSERT INTO contact_messages (Name, Email, Subject, Message, OrderReference, IdpUserId) VALUES (" + qs(name) + ", " + q(email) + ", " + qs(subject) + ", " + q(message) + ", " + qs(order_ref) + ", " + ('NULL' if uid <= 0 else str(uid)) + ");\n"
    "SELECT Id, Name, Email, Subject, Message, OrderReference, CreatedAt FROM contact_messages WHERE Id = last_insert_rowid();"
)
