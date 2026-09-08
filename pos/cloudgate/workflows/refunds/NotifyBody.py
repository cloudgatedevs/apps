r=obj('Shape')['request']
e=rows(rows(obj('Load'))[0]['EntityJson'])[0]
return encode(dict(type='sale.refunded',saleId=r['BusinessId'],reference=e['Reference']))
