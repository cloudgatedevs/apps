r = load_json(value('SendEmail'), None)
if not isinstance(r, dict):
    return out({'sent': False, 'reason': 'No result from the mail step.'})
return out(r)
