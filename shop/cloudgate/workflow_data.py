import json
def value(name):
    return _inputs.get(name, '')


def obj(name, default=None):
    raw=value(name)
    return json.loads(raw) if raw and raw != 'No records found' else default
def request():
    data=obj('body',{})
    if not isinstance(data,dict): raise Exception('Expected a JSON request.')
    return data
