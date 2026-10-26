import ast,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class SessionReads(ast.NodeTransformer):
    def visit_Constant(self,node):
        if not isinstance(node.value,str):return node
        m=re.fullmatch(r'\$\{(\w+)\}',node.value)
        if m:
            code="str(_uuid.uuid4())" if m[1]=='newguid' else 'value('+repr(m[1])+')'
            return ast.copy_location(ast.parse(code,mode='eval').body,node)
        if '${newguid}' in node.value:
            parts=node.value.split('${newguid}')
            code=' + str(_uuid.uuid4()) + '.join(repr(p) for p in parts)
            return ast.copy_location(ast.parse(code,mode='eval').body,node)
        return node

for app in ['shop','pos']:
    root=ROOT/app/'cloudgate'
    (root/'schema.sql').write_text((ROOT/'.work'/app/'native-schema.sql').read_text(),encoding='utf8')
    (root/'sample-data.sql').write_text((ROOT/'.work'/app/'sample-data.sql').read_text(),encoding='utf8')
    lib=root/'workflows/_shared/lib.py';s=lib.read_text()
    s=s[s.index('import json as _json'):]
    start=s.index('def _fix_backslashes');end=s.index('def rows_of')
    s=s[:start]+'''import cloudgate
import uuid as _uuid

def value(name):
    result=cloudgate.value(name)
    return '' if result is None else result

def load_json(raw, default=None):
    if isinstance(raw,(dict,list)):return raw
    if raw is None or raw == 'No records found':return default
    try:return _json.loads(str(raw))
    except (ValueError,TypeError):return default

'''+s[end:]
    s=s.replace('SQL fragment builders (SQLite)','SQL Server fragment builders')
    start=s.index('def q(');end=s.index('def qs(')
    s=s[:start]+'''def q(v):
    if v is None:return 'NULL'
    return 'CONVERT(nvarchar(max),0x'+str(v).encode('utf-16le').hex()+')'

'''+s[end:]
    start=s.index('def like(');end=s.index('def slugify(')
    s=s[:start]+'''def like(v):
    s=str(v).replace('~','~~').replace('%','~%').replace('_','~_').replace('[','~[')
    return q('%'+s+'%')+" ESCAPE '~'"

'''+s[end:]
    lib.write_text(s,encoding='utf8')
    # Read request data through the supported CPython bridge. Only SQL nodes
    # retain selectors, which resolve to SQL produced by a trusted plan node.
    for path in (root/'workflows').rglob('*.py'):
        s=path.read_text(encoding='utf8')
        tree=SessionReads().visit(ast.parse(s));ast.fix_missing_locations(tree)
        s=ast.unparse(tree)+'\n'
        s=s.replace('ORDER BY Key','ORDER BY [Key]').replace("pos('Key')","pos('[Key]')")
        s=s.replace('SELECT [Key], Value','SELECT [Key], [Value]')
        s=s.replace('MAX(0, v.StockQty - v.ReservedQty)','GREATEST(0, v.StockQty - v.ReservedQty)')
        path.write_text(s,encoding='utf8')
    path=root/'workflows/admin-settings/plan.py';s=path.read_text()
    old="parts.append('INSERT INTO settings ([Key], [Value], UpdatedAt) VALUES (' + q(key) + ', ' + q(val) + ', SYSUTCDATETIME()) ON CONFLICT([Key]) DO UPDATE SET [Value] = excluded.[Value], UpdatedAt = SYSUTCDATETIME();')"
    new="parts.append('UPDATE settings WITH (UPDLOCK,HOLDLOCK) SET [Value]='+q(val)+',UpdatedAt=SYSUTCDATETIME() WHERE [Key]='+q(key)+'; IF @@ROWCOUNT=0 INSERT INTO settings ([Key],[Value]) VALUES ('+q(key)+','+q(val)+');')"
    assert old in s;s=s.replace(old,new);path.write_text(s)
    # Bundle native scripts without SQLite trigger splitting or tenant access.
    p=root/'bundle.py';s=p.read_text();start=s.index('    sql =',s.index('def split_schema'));end=s.index('\n\ndef export_bundle',start)
    s=s[:start]+'''    os.makedirs(OUT, exist_ok=True)
    for name in ('schema.sql','sample-data.sql'):
        with open(os.path.join(ROOT,name),encoding='utf8') as source:
            with open(os.path.join(OUT,name),'w',encoding='utf8',newline='\\n') as target:
                target.write(source.read())
'''+s[end:];p.write_text(s)
    p=root/'package_refunds.py';s=p.read_text().replace('import sqlite3\n','');start=s.index('    # The App Store updater');end=s.index('    bundle_path',start);s=s[:start]+s[end:]
    s=s.replace('routes = list(routes or REFUND_ROUTES)',"routes = list(routes or sorted(p.parent.name for p in (ROOT/'workflows').glob('*/workflow.json')))")
    s=s.replace("db['SQLScript'] = schema","db.update(Type=3,SelfHosted=False,Server='',Port=1433,Database='',Username='',Password='')\n        db.pop('Tables',None)\n        db['SQLScript'] = schema")
    p.write_text(s)

root=ROOT/'shop/cloudgate/workflows'
for route in ['admin-categories','admin-products']:
    p=root/route/'plan.py';s=p.read_text();s=s.replace("+ slug_lit + \" || '-' || lower(hex(randomblob(2))) ELSE \" + slug_lit", "+ 'CONCAT(' + slug_lit + \", '-', LEFT(REPLACE(CONVERT(varchar(36),NEWID()),'-',''),8)) ELSE \" + slug_lit")
    p.write_text(s)
p=root/'admin-customers/plan.py';s=p.read_text().replace('(SELECT o.Currency FROM orders o WHERE o.CustomerId = c.Id ORDER BY o.Id DESC LIMIT 1)','(SELECT TOP 1 o.Currency FROM orders o WHERE o.CustomerId = c.Id ORDER BY o.Id DESC)');p.write_text(s)
p=root/'admin-inventory/plan.py';s=p.read_text().replace("' LIMIT ' + str(take) + ' OFFSET ' + str(skip)","' OFFSET ' + str(skip) + ' ROWS FETCH NEXT ' + str(take) + ' ROWS ONLY'").replace('p.Name LIMIT ', 'p.Name OFFSET 0 ROWS FETCH NEXT ').replace("+ str(take) + ';'","+ str(take) + ' ROWS ONLY;'");p.write_text(s)
p=root/'catalog/plan.py';s=p.read_text().replace("\"', \" + alias + '.' + c","\"': \" + alias + '.[' + c + ']' ")
s=s.replace("+ ') ORDER BY Section, Pos;'","+ ') AS sections ORDER BY Section, Pos;'")
s=s.replace("+ ')) AS BoundsMinCents, (SELECT MaxCents FROM (' + b + ')) AS BoundsMaxCents'","+ ') AS bounds_min) AS BoundsMinCents, (SELECT MaxCents FROM (' + b + ') AS bounds_max) AS BoundsMaxCents'")
p.write_text(s)
p=root/'cart/plan.py';s=p.read_text();start=s.index("    return 'INSERT INTO cart_items",s.index('def upsert_line_sql'));end=s.index('\nif op ==',start)
s=s[:start]+'''    match='CartId='+cid+' AND VariantId='+str(variant_id)
    available='(SELECT '+AVAILABLE+' FROM product_variants v JOIN products p ON p.Id=v.ProductId WHERE v.Id='+str(variant_id)+") AND v.IsActive=1 AND p.Status='active')"
    available=available.replace(") AND v.IsActive", " AND v.IsActive")
    return ('UPDATE cart_items WITH (UPDLOCK,HOLDLOCK) SET Qty=LEAST('+new_qty+','+available+','+str(MAX_LINE_QTY)+'),UpdatedAt=SYSUTCDATETIME() WHERE '+match+'; '
        'IF @@ROWCOUNT=0 INSERT INTO cart_items(CartId,ProductId,VariantId,Qty,UnitPriceCents) SELECT '+cid+',p.Id,v.Id,LEAST('+str(qty)+','+AVAILABLE+','+str(MAX_LINE_QTY)+'),COALESCE(v.PriceCents,p.PriceCents) FROM product_variants v JOIN products p ON p.Id=v.ProductId WHERE v.Id='+str(variant_id)+" AND v.IsActive=1 AND p.Status='active' AND "+cid+' IS NOT NULL;')
'''+s[end:];p.write_text(s)
p=root/'payment-reconcile/plan.py';s=p.read_text()
s=s.replace("DATETIME('now', '-\" + str(NO_SESSION_MINUTES) + \" minutes')","DATEADD(minute,-\" + str(NO_SESSION_MINUTES) + \",SYSUTCDATETIME())")
s=s.replace("DATETIME('now', '-\" + str(SESSION_EXPIRY_HOURS) + \" hours')","DATEADD(hour,-\" + str(SESSION_EXPIRY_HOURS) + \",SYSUTCDATETIME())")
s=s.replace("DATETIME('now', '-\" + str(RECHECK_AFTER_MINUTES) + \" minutes')","DATEADD(minute,-\" + str(RECHECK_AFTER_MINUTES) + \",SYSUTCDATETIME())")
s=s.replace('INSERT OR IGNORE INTO #stale SELECT o.Id FROM orders AS o WHERE','INSERT INTO #stale SELECT o.Id FROM orders AS o WHERE NOT EXISTS(SELECT 1 FROM #stale s WHERE s.Id=o.Id) AND');p.write_text(s)

for app in ['booking','jobs','courses','events']:
    root=ROOT/app/'cloudgate';p=root/'package.py';s=p.read_text().replace('Type=0','Type=3,SelfHosted=False,Server=\'\',Port=1433').replace("'Type':0","'Type':3,'SelfHosted':False,'Server':'','Port':1433")
    if app=='booking':
        s=s.replace("schema=(ROOT/'schema.sql').read_text();seed=(ROOT/'seed.sql').read_text();split=seed.index('INSERT OR IGNORE INTO services')","schema=(ROOT/'schema.sql').read_text();sample=(ROOT/'sample-data.sql').read_text()")
        s=s.replace("schema+'\\n'+seed[:split]","schema").replace('seed[split:]','sample')
        n=root/'notifications.py';ns=n.read_text().replace("'BEGIN IMMEDIATE;\\n'+'\\n'.join(statements)+'\\nCOMMIT;\\nSELECT '","transaction(statements)+'\\nSELECT '");n.write_text(ns)
    p.write_text(s)
