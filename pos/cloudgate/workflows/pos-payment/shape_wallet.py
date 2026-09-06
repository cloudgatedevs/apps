# POS Payment / ShapeWallet — can this environment take card payments?
s = load_json('''${WalletStatus}''', None) or {}
return out({'ready': bool(s.get('IsReady')), 'provider': s.get('Provider') or 'None', 'status': s.get('Status') or 'Missing', 'reason': s.get('Reason'), 'production': bool(s.get('IsProduction'))})
