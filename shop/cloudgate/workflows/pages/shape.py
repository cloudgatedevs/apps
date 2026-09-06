# Pages — shape.
d = body()
op = op_of(d, 'nav')
rows = rows_of('''${Run}''')
if op == 'nav':
    return out({'nav': [r for r in rows if to_int(r.get('ShowInNav'), 0) == 1], 'footer': [r for r in rows if to_int(r.get('ShowInFooter'), 0) == 1]})
if not rows:
    fail('Page not found.')
return out(rows[0])
