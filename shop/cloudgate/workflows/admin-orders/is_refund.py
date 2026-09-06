# Admin Orders / IsRefund — route refund requests through the Wallet Payment node. (Condition: bool.)
d = body()
if op_of(d, 'list') != 'refund':
    return False
rows = rows_of('''${Run}''')
if not rows:
    fail('No refundable payment found on this order.')
return True
