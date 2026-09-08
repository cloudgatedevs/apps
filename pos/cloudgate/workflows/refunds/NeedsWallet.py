r=rows(obj('ClaimRun',[]))
return request().get('op')!='list' and bool(r) and r[0]['Method']=='card' and r[0]['Status'] not in ('succeeded','failed')
