# Admin Dashboard / IsWalletStatus — route the wallet check through the Wallet Payment node. (Condition: bool.)
require_admin('''${IdpAuth}''')
return op_of(body(), 'stats') == 'wallet-status'
