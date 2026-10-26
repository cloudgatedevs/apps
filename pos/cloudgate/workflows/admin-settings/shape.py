rows = [r for r in rows_of(value('Run')) if not str(r.get('Key') or '').startswith('smtp_')]
return out({'values': {r.get('Key'): r.get('Value') for r in rows}, 'items': rows})
