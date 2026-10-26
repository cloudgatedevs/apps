import re as _re
d = body()
op = op_of(d, 'subscribe')
email = str(d.get('email') or '').strip().lower()
if not email or len(email) > 200 or (not _re.match('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', email)):
    fail('Please enter a valid email address.')
uid = idp_user_id(value('IdpAuth'))
match = '(lower(Email) = ' + q(email) + (' OR IdpUserId = ' + str(uid) if uid > 0 else '') + ')'
flag = '1' if op == 'subscribe' else '0'
if op not in ('subscribe', 'unsubscribe'):
    fail('Unknown op: ' + op)
parts = ['UPDATE customers SET MarketingOptIn = ' + flag + ', UpdatedAt = SYSUTCDATETIME() WHERE ' + match + ';']
if op == 'subscribe':
    parts.append('INSERT INTO customers (IdpUserId, Email, MarketingOptIn) SELECT ' + ('NULL' if uid <= 0 else str(uid)) + ', ' + q(email) + ', 1 WHERE NOT EXISTS(SELECT 1 FROM customers WHERE ' + match + ');')
parts.append('SELECT ' + flag + ' AS Subscribed, ' + q(email) + ' AS Email;')
return ' '.join(parts)
