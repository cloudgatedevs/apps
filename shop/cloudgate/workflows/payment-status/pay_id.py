rows = rows_of(value('LoadOrder'))
return str(to_int(rows[0].get('ConnectPaymentId'), 0) if rows else 0)
