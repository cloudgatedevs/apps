s = load_json('''${WalletStatus}''', None) or {}
return out({'ready': bool(s.get('IsReady')), 'provider': s.get('Provider') or 'None', 'status': s.get('Status') or 'Missing', 'chargesEnabled': bool(s.get('ChargesEnabled')), 'payoutsEnabled': bool(s.get('PayoutsEnabled')), 'currency': s.get('Currency'), 'production': bool(s.get('IsProduction')), 'reason': s.get('Reason')})
