# Condition: start a card payment?
return op_of(body(), 'status') == 'start'
