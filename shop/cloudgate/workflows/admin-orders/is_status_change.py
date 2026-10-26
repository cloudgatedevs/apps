d = body()
return op_of(d, 'list') == 'set-status' and bool(rows_of(value('Run')))
