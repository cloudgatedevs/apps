import json
import clr
clr.AddReference('Web.Core.Shared')
from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
session_keys = list(WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}')))
def value(name):
    matches=[str(k.Value) for k in session_keys if str(k.Key).lower()==name.lower()]
    return matches[-1] if matches else ''
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

return str(obj('Prepare')['reference'])