#!/usr/bin/env python3
"""Copy native SQL schema/sample files; optionally export a hosted controller.
Use package_refunds.py to rebuild all local workflows without network access.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deploy import Mcp  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(ROOT)
OUT = os.path.join(APP, '.template')


def split_schema():
    os.makedirs(OUT, exist_ok=True)
    for name in ('schema.sql','sample-data.sql'):
        with open(os.path.join(ROOT,name),encoding='utf8') as source:
            with open(os.path.join(OUT,name),'w',encoding='utf8',newline='\n') as target:
                target.write(source.read())


def export_bundle():
    config = json.load(open(os.path.join(ROOT, 'deploy.config.json'), encoding='utf-8'))
    mcp = Mcp.from_env()
    res = mcp.call('export_controller_bundle', {'project_id': config['projectId']})
    text = res if isinstance(res, str) else json.dumps(res)
    bundle = json.loads(text) if isinstance(text, str) else text
    if isinstance(bundle, str):
        bundle = json.loads(bundle)
    projects = bundle.get('Projects') or bundle.get('projects') or []
    if not projects:
        raise SystemExit('export returned no projects: ' + text[:300])
    # Keep the bundle free of tenant-specific secrets: channel passwords are rotated on import,
    # and the App Store creates its own API key. Strip static keys' values defensively.
    for project in projects:
        template = project.get('Template') or project.get('template') or {}
        for endpoint in template.get('Endpoints') or []:
            endpoint.update(EnableLogging=True, MaskData=False)
        for ws in template.get('WebSockets') or []:
            ws['Password'] = ''
        for key in template.get('Keys') or []:
            if key.get('Type') in (2,):  # StaticEncrypted
                key['Value'] = ''
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'workflow-template.json')
    open(path, 'w', encoding='utf-8', newline='\n').write(json.dumps(bundle, indent=2) + '\n')
    endpoints = sum(len((p.get('Template') or {}).get('Endpoints') or []) for p in projects)
    databases = sum(len((p.get('Template') or {}).get('Databases') or []) for p in projects)
    print(f'wrote .template/workflow-template.json: {len(projects)} project(s), {endpoints} endpoints, {databases} databases')


if __name__ == '__main__':
    split_schema()
    if '--sql-only' not in sys.argv:
        export_bundle()
