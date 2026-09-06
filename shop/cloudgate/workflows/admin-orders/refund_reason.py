# Admin Orders / RefundReason — short reason for the provider dashboard.
d = body()
rows = rows_of('''${Run}''')
ref = str(rows[0].get('Reference') if rows else '')
reason = str(d.get('reason') or '').strip()[:120]
return (ref + (' - ' + reason if reason else '')).strip() or 'refund'
