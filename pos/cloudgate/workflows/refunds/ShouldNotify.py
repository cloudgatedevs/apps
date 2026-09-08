r=obj('Shape',{}).get('request')
return bool(r) and r['Status']=='succeeded'
