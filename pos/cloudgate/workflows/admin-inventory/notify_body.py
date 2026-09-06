d = body()
op = op_of(d, 'levels')
if op not in ('adjust', 'receive', 'count'):
    return ''
return out({'type': 'stock.adjusted', 'op': op, 'at': now_sql()})
