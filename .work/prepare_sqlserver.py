"""One-time authoring aid. This is not shipped or used by any workflow."""
import json, re, sqlite3
from pathlib import Path

APPS = ['shop','pos','booking','jobs','courses','events']
ROOT = Path(__file__).resolve().parents[1]

def quoted(name): return '[' + name.replace(']', ']]') + ']'
def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, (int,float)): return str(value)
    return "N'" + str(value).replace("'", "''") + "'"

for app in APPS:
    folder=ROOT/app
    original=(folder/'.template/schema.sql').read_text(encoding='utf-8-sig')
    sample=(folder/'.template/sample-data.sql').read_text(encoding='utf-8-sig')
    db=sqlite3.connect(':memory:')
    db.executescript(original)
    tables=[row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    base={t:list(db.execute('SELECT * FROM '+quoted(t))) for t in tables}
    db.executescript(sample)
    seeded={t:[r for r in db.execute('SELECT * FROM '+quoted(t)) if r not in base[t]] for t in tables}
    ddl=['-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.', 'SET NOCOUNT ON; SET XACT_ABORT ON;']
    indexes=[];foreign=[]; metadata={}
    for table in tables:
        cols=list(db.execute('PRAGMA table_info('+quoted(table)+')'))
        table_indexes=[];indexed=set()
        for ix in db.execute('PRAGMA index_list('+quoted(table)+')').fetchall():
            name,unique=ix[1],bool(ix[2]); names=[r[2] for r in db.execute('PRAGMA index_info('+quoted(name)+')')]
            if names == ['Id']: continue
            indexed.update(names)
            raw=db.execute('SELECT sql FROM sqlite_master WHERE name=?',(name,)).fetchone()[0]
            where=re.search(r'\bWHERE\s+(.+)',raw or '',re.I)
            table_indexes.append((name,unique,names,where[1] if where else ''))
        for fk in db.execute('PRAGMA foreign_key_list('+quoted(table)+')'):
            foreign.append((table,fk[3],fk[2],fk[4])); indexed.add(fk[3])
        definitions=[]
        for _,name,kind,notnull,default,primary in cols:
            if name=='Id': definition=quoted(name)+' INT IDENTITY(1,1) NOT NULL PRIMARY KEY'
            else:
                if kind.upper()=='INTEGER': typ='BIGINT'
                elif kind.upper() in ('REAL','NUMERIC','DECIMAL'): typ='DECIMAL(28,9)'
                elif kind.upper()=='DATETIME' or name.endswith('At'): typ='DATETIME2(3)'
                else: typ='NVARCHAR(254)' if name in indexed else 'NVARCHAR(MAX)'
                # FK text fields must have the same type as their unique target.
                if name.lower() in ('reference','ref','request_key','external_id','booking_ref','user_id','staff','visit','owner','kind','job'): typ='NVARCHAR(254)'
                definition=quoted(name)+' '+typ+(' NOT NULL' if notnull else ' NULL')
                if default is not None:
                    default=re.sub(r'CURRENT_TIMESTAMP','SYSUTCDATETIME()',default,flags=re.I)
                    definition+=' DEFAULT ('+default+')'
            definitions.append(definition)
        ddl.append('CREATE TABLE '+quoted(table)+' (\n    '+',\n    '.join(definitions)+'\n);')
        metadata[table]=[c[1] for c in cols]
        for ixnum,(name,unique,names,where) in enumerate(table_indexes):
            if name.startswith('sqlite_autoindex'): name='ux_'+table+'_'+str(ixnum)
            where=re.sub(r"(\w+) NOT IN \('succeeded','failed'\)",r"\1 <> 'succeeded' AND \1 <> 'failed'",where,flags=re.I)
            nullable=[n for n in names if not next(c for c in cols if c[1]==n)[3]]
            if unique and nullable and not where: where=' AND '.join(quoted(n)+' IS NOT NULL' for n in nullable)
            indexes.append('CREATE '+('UNIQUE ' if unique else '')+'INDEX '+quoted(name)+' ON '+quoted(table)+' ('+', '.join(map(quoted,names))+')'+(' WHERE '+where if where else '')+';')
    # The authoring schemas use INT identity references. Match FK integer types.
    for table,col,target,targetcol in foreign:
        if targetcol=='Id':
            ddl=[s.replace(quoted(col)+' BIGINT',quoted(col)+' INT') if s.startswith('CREATE TABLE '+quoted(table)+' ') else s for s in ddl]
    for table,col,target,targetcol in foreign:
        foreign_sql='ALTER TABLE '+quoted(table)+' ADD FOREIGN KEY ('+quoted(col)+') REFERENCES '+quoted(target)+' ('+quoted(targetcol)+');'
        indexes.append(foreign_sql)
    ddl+=indexes
    def inserts(data):
        result=[]
        for table,rows in data.items():
            if not rows:continue
            result.append('SET IDENTITY_INSERT '+quoted(table)+' ON;')
            for row in rows:
                result.append('INSERT INTO '+quoted(table)+' ('+', '.join(map(quoted,metadata[table]))+') VALUES ('+', '.join(map(literal,row))+');')
            result.append('SET IDENTITY_INSERT '+quoted(table)+' OFF;')
        return '\n'.join(result)+'\n'
    # Write drafts first; constraints and native triggers are reviewed separately.
    out=ROOT/'.work'/app;out.mkdir(exist_ok=True)
    (out/'schema.sql').write_text('\n\n'.join(ddl)+'\n'+inserts(base),encoding='utf-8')
    (out/'sample-data.sql').write_text(inserts(seeded),encoding='utf-8')
    (out/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    triggers=list(db.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger'"))
    (out/'constraints.json').write_text(json.dumps({'triggers':triggers,'tables':list(db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))},indent=2),encoding='utf-8')
    print(app,len(tables),'tables',len(triggers),'triggers')
