# Payments / Shape — the public view of the wallet status: ready or not, and why (no account details).
s = load_json('''${WalletStatus}''', None) or {}
return out({
    'ready': bool(s.get('IsReady')),
    'provider': s.get('Provider') or 'None',
    'status': s.get('Status') or 'Missing',
    'currency': s.get('Currency'),
    'production': bool(s.get('IsProduction')),
    'reason': None if s.get('IsReady') else 'This store is not accepting card payments yet.',
})
