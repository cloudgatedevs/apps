_inputs = {'IdpAuth': '${IdpAuth}', 'Prepare': '${Prepare}', 'Run': '${Run}', 'Snapshot': '${Snapshot}', 'body': '${body}'}
import json
def value(name):
    return _inputs.get(name, '')


def obj(name, default=None):
    raw=value(name)
    return json.loads(raw) if raw and raw != 'No records found' else default
def snapshot(name='Snapshot'):
    rows=obj(name, [])
    if isinstance(rows,dict): rows=[rows]
    if not rows: raise Exception('The booking database could not be loaded.')
    raw=rows[0]['snapshot']
    return json.loads(raw) if isinstance(raw,str) else raw
def request():
    data=obj('body',{})
    if not isinstance(data,dict): raise Exception('Expected a JSON request.')
    return data

return str(obj('Prepare')['refund_amount'])