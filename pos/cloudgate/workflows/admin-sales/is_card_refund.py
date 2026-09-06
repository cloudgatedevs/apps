d = body()
return op_of(d, 'list') == 'refund' and str(d.get('method') or 'cash').lower() == 'card'
