# Admin Settings — key/value map plus the raw rows. Secrets never leave the workflow:
# the SMTP password is replaced by a flag saying whether one is stored.
rows = rows_of('''${Run}''')
values = {r.get('Key'): r.get('Value') for r in rows}
values['smtp_password_set'] = '1' if str(values.pop('smtp_password', '') or '').strip() else '0'
items = [r for r in rows if r.get('Key') != 'smtp_password']
return out({'values': values, 'items': items})
