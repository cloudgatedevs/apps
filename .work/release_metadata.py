import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
apps=['shop','pos','booking','jobs','courses','events']
catalog=json.loads((ROOT/'apps.json').read_text(encoding='utf8'))
for app in apps:
    root=ROOT/app
    for name in ['template.json','package.json','package-lock.json']:
        p=root/name;data=json.loads(p.read_text(encoding='utf8'));data['version']='3.0.0'
        if name=='package-lock.json':data['packages']['']['version']='3.0.0'
        p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    manifest=json.loads((root/'template.json').read_text(encoding='utf8'))
    catalog['apps']=[manifest if a['id']==app else a for a in catalog['apps']]
    for p in (root/'cloudgate/workflows').rglob('*.py'):
        s=p.read_text(encoding='utf8').replace('last_insert_rowid()','CONVERT(bigint,SCOPE_IDENTITY())');p.write_text(s,encoding='utf8')
    for p in (root/'cloudgate/migrations').glob('*.sql'):
        assert p.resolve().is_relative_to(ROOT.resolve())
        p.unlink()
    for p in (root/'cloudgate').glob('*.py'):
        if p.name in ['engine.py','bundle.py']:p.write_text(p.read_text(encoding='utf8').replace('SQLite','SQL Server'),encoding='utf8')
    p=root/'README.md';s=p.read_text(encoding='utf8')
    lines=s.splitlines();lines[1:1]=['','Version 3.0 uses managed Microsoft SQL Server and standard Python workflows. Fresh installation is required; see [runtime, email and development setup](../SQL-SERVER-REWRITE.md).','']
    s='\n'.join(lines)+'\n'
    s=s.replace('SQLite','SQL Server').replace('No Booking database migration or workflow changes are required for this frontend release.','The version 3.0 workflow and database rewrite requires a fresh installation.')
    s=s.replace('Domain workflows and their database schema are unchanged by this migration.','Version 3.0 replaces the workflow runtime and database schema.')
    s=s.replace('The SDK migration does not modify the workflow package or database schema.','Version 3.0 includes rewritten workflow packages and SQL Server schemas.')
    s=s.replace('This frontend migration does not change the 13 Academy workflows or the database schema. Existing curricula and enrolments remain intact.', 'Version 3.0 rewrites all 13 Academy workflows for a fresh SQL Server installation.')
    s=s.replace('This frontend migration leaves the 14 workflows, schema and deployed IDs unchanged.','Version 3.0 rewrites all 14 workflows and their schema for fresh SQL Server installations.')
    s=re.sub(r'Native scripts read request data through .*?Preserve these boundaries and the generated-workflow tests when changing business logic\.', 'Native scripts use ordinary data-bound workflow selectors and the Python standard library. Database nodes execute T-SQL; Wallet nodes handle payments. No CLR or bridge is required.',s)
    s=re.sub(r'\.local/[a-z]+\.sqlite','a dedicated SQL Server development database',s)
    s=s.replace('separate SQL Server files','separate managed SQL Server databases')
    s=s.replace("Order confirmations, shipping updates and contact forwarding use Cloudgate's tenant email pipeline. Optional shared SMTP settings are configured through the SDK.","Order confirmations, shipping updates and contact forwarding use standard Python SMTP configured through encrypted controller selectors.")
    s=s.replace('Cloudgate delivers receipt email through tenant delivery; configure optional SMTP in the SDK. App-local legacy SMTP values are not used for delivery.','Receipt email uses standard Python SMTP and encrypted controller selectors.')
    s=s.replace("Cloudgate handles outgoing email by default; optional SMTP configuration belongs to the SDK.","Outgoing email uses standard Python SMTP and encrypted controller selectors.")
    s=s.replace('Cloudgate email is the default; custom SMTP is optional.','Workflow email uses standard Python SMTP and encrypted controller selectors.')
    p.write_text(s,encoding='utf8')
    for filename in ['cloudgate/README.md','cloudgate/REFUNDS.md','cloudgate/DEPLOYMENT-NOTES.md']:
        p=root/filename
        if not p.exists():continue
        s=p.read_text(encoding='utf8').replace('SQLite','SQL Server').replace('Pythonnet','Python').replace('pythonnet','standard Python')
        s=s.replace('SQL Server SQL','T-SQL').replace('CPython via standard Python','standard CPython')
        s=re.sub(r'cloudgate/migrations/[a-z0-9.-]+\.sql','cloudgate/schema.sql',s)
        s='\n'.join(s.splitlines()[:1]+['','Version 3.0 is a fresh-install SQL Server release. See [the runtime contract](../../SQL-SERVER-REWRITE.md) for standard Python inputs, email configuration and verification.','']+s.splitlines()[1:])+'\n'
        p.write_text(s,encoding='utf8')
(ROOT/'apps.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
p=ROOT/'README.md';s=p.read_text(encoding='utf8');s=s.replace('## Updating an installed app', '## Version 3.0 installation\n\nVersion 3.0 replaces the SQLite apps with managed Microsoft SQL Server and standard Python workflows. Install fresh databases; no data migration or backward compatibility is provided. See [SQL-SERVER-REWRITE.md](SQL-SERVER-REWRITE.md) for runtime requirements, email selectors, development and tests.\n\n## Updating a version 3.0 installation')
s=s.replace('App email uses Cloudgate delivery by default. Custom SMTP is an optional tenant override in the back office, not an App Store readiness requirement. App manifests must not list '+chr(96)+'smtp'+chr(96)+' as a rollout prerequisite.','Workflow email uses standard Python SMTP with encrypted controller selectors. Configure SMTP_HOST, SMTP_PORT, SMTP_SECURITY, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL and SMTP_FROM_NAME for each environment before sending email. These are separate from SDK SMTP administration.')
s=s.replace('| [Cloudgate Booking]', '| [Cloudgate POS](./pos/) | pos/ | Registers, cash and card sales, shifts, stock and receipts. | Wallet, IdP, WebSockets |\n| [Cloudgate Booking]',1)
p.write_text(s,encoding='utf8')
p=ROOT/'booking/cloudgate/live-controller-export.json'
if p.exists():p.unlink()
for name in ['jobs/IMPLEMENTATION.md','jobs/PROGRESS.md']:
    p=ROOT/name;s=p.read_text(encoding='utf8');s=s.splitlines()[0]+'\n\nHistorical implementation notes. Version 3.0 replaces the database/runtime described below; follow [the current runtime contract](../SQL-SERVER-REWRITE.md).\n'+'\n'.join(s.splitlines()[1:])+'\n';p.write_text(s,encoding='utf8')
p=ROOT/'PAYMENT-VERIFICATION.md';s=p.read_text(encoding='utf8').replace('The SQLite and SDK tests','The SQL Server and SDK tests');p.write_text(s,encoding='utf8')
