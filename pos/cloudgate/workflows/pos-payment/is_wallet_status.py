# Condition: ask whether the tenant wallet can take payments?
return op_of(body(), 'status') == 'wallet-status'
