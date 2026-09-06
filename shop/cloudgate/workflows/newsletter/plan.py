# Newsletter — opt a customer in or out of marketing email by address.
#
# Matching rules: a signed-in customer owns one row (customers.IdpUserId is unique), so their row
# is updated whatever email they typed; a guest is matched by email; a brand-new address gets a
# guest row. The email typed is stored on a new row only, never overwriting an existing address.
import re as _re
d = body()
op = op_of(d, 'subscribe')
email = str(d.get('email') or '').strip().lower()
if not email or len(email) > 200 or not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
    fail('Please enter a valid email address.')
uid = idp_user_id('''${IdpAuth}''')
match = "(lower(Email) = " + q(email) + (" OR IdpUserId = " + str(uid) if uid > 0 else "") + ")"
flag = '1' if op == 'subscribe' else '0'
if op not in ('subscribe', 'unsubscribe'):
    fail('Unknown op: ' + op)
parts = ["UPDATE customers SET MarketingOptIn = " + flag + ", UpdatedAt = CURRENT_TIMESTAMP WHERE " + match + ";"]
if op == 'subscribe':
    parts.append(
        "INSERT INTO customers (IdpUserId, Email, MarketingOptIn) SELECT " + ('NULL' if uid <= 0 else str(uid)) + ", " + q(email) + ", 1 "
        "WHERE NOT EXISTS (SELECT 1 FROM customers WHERE " + match + ");"
    )
parts.append("SELECT " + flag + " AS Subscribed, " + q(email) + " AS Email;")
return ' '.join(parts)
