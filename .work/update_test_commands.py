import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for app in ['shop','pos','booking','jobs','courses','events']:
    root=ROOT/app;p=root/'package.json';package=json.loads(p.read_text(encoding='utf8'))
    for key,value in package['scripts'].items():
        if key.startswith('test') or key=='cloudgate:test-local':
            package['scripts'][key]=value.replace('python -B -X utf8 ','python ../test_support/run.py ').replace('python -B ','python ../test_support/run.py ')
    p.write_text(json.dumps(package,indent=2)+'\n',encoding='utf8')
    p=root/'tests/sdk.browser.mjs';s=p.read_text(encoding='utf8').replace("{ spawn } from", "{ spawn, spawnSync } from").replace('SQLite','SQL Server')
    s=re.sub(r"'cloudgate/local_server.py', '--db', path.join\(directory, '[^']+'\)","'../test_support/ui_server.py', '"+app+"', '--record', path.join(directory, 'sql-server.json'), '--data-dir', directory",s)
    s=re.sub(r"'tests/workflow_fixture.py', '--db', path.join\(directory, '[^']+'\)","'../test_support/ui_server.py', '"+app+"', '--record', path.join(directory, 'sql-server.json'), '--data-dir', directory",s)
    before="  if (path.dirname(directory) === os.tmpdir()"
    cleanup="  const cleanup = spawnSync('python', ['-X','utf8','../test_support/ui_server.py','"+app+"','--record',path.join(directory,'sql-server.json'),'--cleanup'], {cwd:root,windowsHide:true,encoding:'utf8'});\n  if (cleanup.status !== 0) throw new Error('SQL Server fixture cleanup failed: '+cleanup.stderr);\n"
    assert before in s;s=s.replace(before,cleanup+before);p.write_text(s,encoding='utf8')
    if app in ['shop','pos']:
        p=root/'tests/workflow_fixture.py';s=p.read_text(encoding='utf8').replace("    parser.add_argument('--db', required=True)\n",'')
        s=s.replace("    if Path(args.db).exists():\n        parser.error('The fixture requires a new database')\n",'')
        p.write_text(s,encoding='utf8')
