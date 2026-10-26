rows = rows_of(value('LoadOrder'))
return bool(rows and to_int(rows[0].get('ConnectPaymentId'), 0) > 0)
