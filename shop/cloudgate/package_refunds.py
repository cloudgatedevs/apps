"""Refresh App Store workflow graphs offline; never contact/publish a tenant.

Existing graphs are edited from the checked-in export. New node shapes are copied
from a live MCP export in refund-node-prototypes.json. Run after editing refunds
(default route set), or name the routes to repackage:

    python -B -X utf8 cloudgate/package_refunds.py                     # refund routes
    python -B -X utf8 cloudgate/package_refunds.py catalog pages       # just these
"""
import copy
import json
import sqlite3
import sys
import uuid
from pathlib import Path
import deploy
from bundle import split_schema

ROOT = Path(__file__).parent
APP = ROOT.parent


REFUND_ROUTES = ['refunds', 'admin-orders', 'payment-status', 'payment-reconcile'] if APP.name == 'shop' else ['refunds', 'admin-sales', 'pos-payment', 'pos-sale']


def main(routes=None):
    split_schema()
    # The App Store updater splits at a semicolon followed by a newline. Keep
    # each trigger on one physical line so an update executes its whole body.
    schema_path = APP / '.template/schema.sql'
    parts, trigger = [], ''
    for line in schema_path.read_text(encoding='utf-8').splitlines():
        if trigger or line.startswith('CREATE TRIGGER'):
            trigger += line + '\n'
            if sqlite3.complete_statement(trigger):
                parts.append(' '.join(trigger.splitlines()))
                trigger = ''
        else:
            parts.append(line)
    if trigger:
        raise ValueError('Incomplete schema trigger')
    schema_path.write_text('\n'.join(parts) + '\n', encoding='utf-8')
    bundle_path = APP / '.template/workflow-template.json'
    bundle = json.loads(bundle_path.read_text(encoding='utf-8'))
    template = bundle['Projects'][0]['Template']
    config = json.loads((ROOT / 'deploy.config.json').read_text(encoding='utf-8'))
    prototypes = json.loads((ROOT / 'refund-node-prototypes.json').read_text(encoding='utf-8'))
    types = {'function': 1, 'condition': 4, 'database': 5, 'idp': 9, 'walletpayment': 11, 'websocket': 8}
    by_type = {n['NodeType']: n for n in prototypes['Nodes']}
    by_type[8] = next(n for n in template['Nodes'] if n['NodeType'] == 8)
    routes = list(routes or REFUND_ROUTES)
    unknown = [r for r in routes if not (ROOT / 'workflows' / r / 'workflow.json').exists()]
    if unknown:
        raise SystemExit('Unknown workflow folder(s): ' + ', '.join(unknown))
    graphs = []
    for route in routes:
        folder = ROOT / 'workflows' / route
        spec = json.loads((folder / 'workflow.json').read_text(encoding='utf-8'))
        existing = next((e for e in template['Endpoints'] if e['Route'] == route), None)
        eid = existing['Id'] if existing else str(uuid.uuid5(uuid.NAMESPACE_URL, 'cloudgate-' + APP.name + '/' + route))
        old_nodes = {n['Name']: n for n in template['Nodes'] if n['EndpointId'] == eid}
        # Compile source scripts/parameters, retaining the native export's schema.
        _, compiled = deploy.compile_workflow(str(folder), config, eid)
        compiled_nodes = {n['Name']: n for n in compiled['Nodes']}
        nodes = []
        for entry in spec['nodes']:
            old = old_nodes.get(entry['name'])
            base = old or by_type[types[entry['type']]]
            node = copy.deepcopy(base)
            node.update(Id=old['Id'] if old else str(uuid.uuid5(uuid.NAMESPACE_URL, 'cloudgate-' + APP.name + '/' + route + '/' + entry['name'])),
                        Name=entry['name'], EndpointId=eid, NodeId=None, PositiveNodeId=None, NegativeNodeId=None, ThreadEntryNodeId=None)
            compiled_node = compiled_nodes[entry['name']]
            for field in ['MainScript', 'FileId', 'FileProdId', 'IdpOuputType', 'IdpAuthorizeAllowAnonymous'] + ['Param' + str(i) for i in range(1, 11)]:
                node[field] = compiled_node[field]
            if entry['type'] == 'idp':
                node['IdpAuthorizeRole'] = compiled_node['IdpAuthorizeRole']
                node['IdpAuthorizePermission'] = compiled_node['IdpAuthorizePermission']
            if entry['type'] == 'websocket':
                for field in ['WebSocketId', 'WebSocketName', 'Body']:
                    node[field] = compiled_node[field]
            if route == 'refunds':
                node.update(X=float(len(nodes) * 300), Y=0.0)
            nodes.append(node)
        named = {n['Name']: n for n in nodes}
        for entry in spec['nodes']:
            for edge, field in [('next', 'NodeId'), ('positive', 'PositiveNodeId'), ('negative', 'NegativeNodeId'), ('thread', 'ThreadEntryNodeId')]:
                if entry.get(edge):
                    named[entry['name']][field] = named[entry[edge]]['Id']
        endpoint = copy.deepcopy(existing or prototypes['Endpoint'])
        endpoint.update(Id=eid, ProjectId=config['projectId'], Name=spec['name'], Route=route, NodeId=named[spec['entry']]['Id'],
                        RequestType=deploy.REQUEST_TYPE[spec.get('method', 'POST').upper()],
                        AllowAnonymous=bool(spec.get('allowAnonymous', False)), EnableLogging=bool(spec.get('enableLogging', True)))
        if route == 'refunds':
            endpoint.update(AllowAnonymous=False, EnableLogging=False, MaskData=True)
        template['Endpoints'] = [e for e in template['Endpoints'] if e['Id'] != eid] + [endpoint]
        template['Nodes'] = [n for n in template['Nodes'] if n['EndpointId'] != eid] + nodes
        graphs.append(dict(Endpoint=endpoint, Nodes=nodes))
    schema = (APP / '.template/schema.sql').read_text(encoding='utf-8')
    for db in template['Databases']:
        db['SQLScript'] = schema
        db['SQLScriptProd'] = schema
    bundle_path.write_text(json.dumps(bundle, indent=2) + '\n', encoding='utf-8')
    print('Packaged ' + ', '.join(routes) + '; schema updated for sandbox and production.')
    return graphs


if __name__ == '__main__':
    main([a for a in sys.argv[1:] if not a.startswith('-')])
