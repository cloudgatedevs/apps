# Admin Orders / IsStatusChange — only a status change publishes an event and notifies the customer. (Condition: bool.)
d = body()
return op_of(d, 'list') == 'set-status' and bool(rows_of('''${Run}'''))
