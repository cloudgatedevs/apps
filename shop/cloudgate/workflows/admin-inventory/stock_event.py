# Admin Inventory / StockEvent — "stock.adjusted" for the live channel (thread branch after an adjustment).
d = body()
if op_of(d, 'stock') not in ('adjust', 'set-threshold'):
    return ''
rows = rows_of('''${Run}''')
if not rows:
    return ''
r = rows[0]
return out({
    'type': 'stock.adjusted',
    'variantId': r.get('Id'),
    'productId': r.get('ProductId'),
    'sku': r.get('Sku'),
    'stockQty': to_int(r.get('StockQty'), 0),
    'availableQty': to_int(r.get('AvailableQty'), 0),
    'lowStock': to_int(r.get('StockQty'), 0) <= to_int(r.get('LowStockThreshold'), 0),
    'at': now_sql(),
})
