require_admin(value('IdpAuth'))
return op_of(body(), 'stats') == 'wallet-status'
