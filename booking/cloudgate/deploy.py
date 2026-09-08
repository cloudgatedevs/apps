"""Draft deployment helper. Defaults to validation + dry runs; never publishes.
Prefer the Cloudgate builder MCP in Codex. This CLI requires an explicit token and URL.
Run package.py first, then deploy.py; use --apply only after reviewing the dry run.
"""
import argparse
import json
import os
from pathlib import Path
import urllib.request
ROOT=Path(__file__).parent
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    url=os.environ.get('CLOUDGATE_MCP_URL');token=os.environ.get('CLOUDGATE_MCP_TOKEN')
    if not url or not token:parser.error('Set CLOUDGATE_MCP_URL and CLOUDGATE_MCP_TOKEN explicitly. No cached credentials are read.')
    def call(name,arguments):
        payload=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode()
        req=urllib.request.Request(url,data=payload,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
        with urllib.request.urlopen(req,timeout=90) as response:raw=response.read().decode()
        if raw.startswith('event:') or raw.startswith('data:'):raw=next(line[5:].strip() for line in raw.splitlines() if line.startswith('data:'))
        outer=json.loads(raw)
        if outer.get('error'):raise RuntimeError(outer['error'])
        result=outer.get('result',outer)
        if result.get('isError'):raise RuntimeError(result)
        blocks=result.get('content',[])
        return json.loads(next(c['text'] for c in blocks if c['type']=='text')) if blocks else result
    config=json.loads((ROOT/'deploy.config.json').read_text())
    current={e['Route']:e for e in call('list_endpoints',{'project_id':config['projectId']})}
    for path in sorted((ROOT/'workflows').glob('*/graph.json')):
        source=json.loads(path.read_text());route=source['Endpoint']['Route'];entry=current.get(route)
        if entry:
            live=call('get_workflow_graph',{'endpoint_id':entry['Id'],'include_scripts':True})
            if not live['editState']['canMutateWorkflow']:
                if not args.apply:print(route+': published; application would open a draft');continue
                call('begin_workflow_edit',{'endpoint_id':entry['Id']});live=call('get_workflow_graph',{'endpoint_id':entry['Id'],'include_scripts':True})
            mapping={n['Id']:next((v['Id'] for v in live['Nodes'] if v['Name']==n['Name']),n['Id']) for n in source['Nodes']}
            for node in source['Nodes']:
                node['Id']=mapping[node['Id']];node['EndpointId']=entry['Id']
                for edge in ('NodeId','PositiveNodeId','NegativeNodeId','ThreadEntryNodeId'):
                    if node.get(edge):node[edge]=mapping[node[edge]]
            source['Endpoint']['Id']=entry['Id'];source['Endpoint']['NodeId']=mapping[source['Endpoint']['NodeId']]
        source['projectId']=config['projectId'];source['Endpoint']['ProjectId']=config['projectId']
        for node in source['Nodes']:
            if node['NodeType']==5:node['FileId']=config['fileId'];node['FileProdId']=config['fileProdId']
        payload=json.dumps(source);validation=call('validate_workflow_json',{'endpoint_json':payload})
        if not validation.get('valid'):raise RuntimeError(validation)
        tool='update_endpoint' if entry else 'create_endpoint';preview=call(tool,{'endpoint_json':payload,'dry_run':True})
        if preview.get('blocked'):raise RuntimeError(preview)
        print(route+': validated; '+str(len(source['Nodes']))+' nodes; '+('update' if entry else 'create')+' draft')
        if args.apply:call(tool,{'endpoint_json':payload,'dry_run':False})
    print('Drafts applied. Nothing was published.' if args.apply else 'Dry run complete. Nothing was changed.')
if __name__=='__main__':main()
