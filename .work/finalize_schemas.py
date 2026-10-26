import json,re,sys
from pathlib import Path
import sqlglot
from sqlglot import exp

ROOT=Path(__file__).resolve().parents[1]

def tsql(sql):
    tree=sqlglot.parse_one(sql,read='sqlite')
    def change(node):
        if isinstance(node,(exp.JSONExtract,exp.JSONExtractScalar)):
            path=node.expression.sql(dialect='sqlite').strip("'")
            raw=node.this.sql(dialect='tsql')
            # Quantities and identifiers in line-item JSON are numeric SQL values.
            typ='decimal(28,9)' if any(p in path for p in ['qty','Qty']) else 'bigint'
            if path.endswith(('saleItemId','productId','qty','expectedRefundedQty')):
                return sqlglot.parse_one("TRY_CONVERT("+typ+",JSON_VALUE("+raw+",'"+path+"'))",read='tsql')
            if path.endswith('restock'):
                return sqlglot.parse_one("CASE JSON_VALUE("+raw+",'"+path+"') WHEN 'true' THEN 1 ELSE 0 END",read='tsql')
        if isinstance(node,exp.Anonymous) and node.name.lower()=='json_each':node.set('this','OPENJSON')
        if isinstance(node,exp.Anonymous) and node.name.lower()=='json_array_length':
            return sqlglot.parse_one('(SELECT COUNT(*) FROM OPENJSON('+node.expressions[0].sql(dialect='tsql')+'))',read='tsql')
        if isinstance(node,exp.DPipe):
            def parts(value):
                return parts(value.this)+parts(value.expression) if isinstance(value,exp.DPipe) else [value]
            return exp.Anonymous(this='CONCAT',expressions=parts(node))
        return node
    tree=tree.transform(change)
    return tree.sql(dialect='tsql')

def statements(text):
    quote=False;start=0;i=0
    while i<len(text):
        if text[i]=="'":
            if quote and i+1<len(text) and text[i+1]=="'":i+=2;continue
            quote=not quote
        if text[i]==';' and not quote:
            if text[start:i].strip():yield text[start:i].strip()
            start=i+1
        i+=1
    if text[start:].strip():yield text[start:].strip()

def cursor_trigger(app,name,source,metadata):
    table='refund_requests';apply=name=='refund_apply'
    columns=metadata[table]
    header=source[:source.index('BEGIN')]
    body=source[source.index('BEGIN')+5:source.rfind('END')]
    output=[]
    for stmt in statements(body):
        stmt=re.sub(r'NEW\.(\w+)',r'@\1',stmt,flags=re.I)
        match=re.fullmatch(r"SELECT CASE WHEN (.+) THEN RAISE\(ROLLBACK,'((?:[^']|'')*)'\) END",stmt,re.I|re.S)
        if match:
            cond=tsql('SELECT 1 WHERE '+match[1]).split(' WHERE ',1)[1]
            output.append("IF "+cond+" THROW 50002, N'"+match[2]+"', 1;")
        else:output.append(tsql(stmt)+';')
    # Use actual table column types for the trigger's row variables.
    schema=(ROOT/'.work'/app/'schema.sql').read_text()
    tableddl=schema[schema.index('CREATE TABLE [refund_requests]'):]
    declarations=[]
    for col in columns:
        m=re.search(r'\['+col+r'\] (INT|BIGINT|NVARCHAR\((?:MAX|\d+)\)|DATETIME2\(3\)|DECIMAL\(28,9\))',tableddl)
        declarations.append('@'+col+' '+m[1])
    selection=', '.join('i.['+c+']' for c in columns)
    where="i.[Status]='succeeded' AND d.[Applied]=0 AND d.[Status]<>'succeeded'" if apply else "i.[Status]<>'failed'"
    join=' JOIN deleted d ON d.Id=i.Id' if apply else ''
    fetch='FETCH NEXT FROM refund_rows INTO '+', '.join('@'+c for c in columns)+';'
    script=('CREATE TRIGGER ['+name+'] ON [refund_requests] AFTER '+('UPDATE' if apply else 'INSERT')+' AS\n'
            'BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;\nDECLARE '+', '.join(declarations)+';\n'
            'DECLARE refund_rows CURSOR LOCAL FAST_FORWARD FOR SELECT '+selection+' FROM inserted i'+join+' WHERE '+where+';\n'
            'OPEN refund_rows; '+fetch+'\nWHILE @@FETCH_STATUS=0 BEGIN\n'+'\n'.join(output)+'\n'+fetch+
            '\nEND; CLOSE refund_rows; DEALLOCATE refund_rows; END;')
    return "EXEC(N'"+script.replace("'","''")+"');"

for app in ['shop','pos','booking','jobs','courses','events']:
    folder=ROOT/'.work'/app
    schema=(folder/'schema.sql').read_text()
    original=json.loads((folder/'constraints.json').read_text())
    metadata=json.loads((folder/'metadata.json').read_text())
    extra=[]
    for table,sql in original['tables']:
        tree=sqlglot.parse_one(sql,read='sqlite')
        for index,check in enumerate(tree.find_all(exp.CheckColumnConstraint)):
            expression=check.this.sql(dialect='tsql',identify=True)
            expression=re.sub(r'JSON_VALID\(([^)]+)\)',r'ISJSON(\1)=1',expression,flags=re.I)
            name='ck_'+table+'_'+str(index)
            extra.append("IF OBJECT_ID(N'"+name+"',N'C') IS NULL ALTER TABLE ["+table+"] ADD CONSTRAINT ["+name+"] CHECK ("+expression+");")
    if app in ['shop','pos']:
        for name,source in original['triggers']:
            if name=='refund_key_guard':continue # checked atomically by the claim command
            extra.append(cursor_trigger(app,name,source,metadata))
    if app=='jobs':
        trigger="""CREATE TRIGGER [jobs_no_overlap] ON [allocations] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON a.[staff]=i.[staff] AND a.[Id]<>i.[Id] AND a.[starts]<i.[ends] AND a.[ends]>i.[starts])
THROW 50003, 'A team member is already assigned or unavailable at this time.', 1;
END;"""
        extra.append("EXEC(N'"+trigger.replace("'","''")+"');")
    if app=='booking':
        scripts=["""CREATE TRIGGER [allocation_no_overlap] ON [allocations] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON i.[active]=1 AND a.[active]=1 AND a.[Id]<>i.[Id] AND a.[starts]<i.[ends] AND a.[ends]>i.[starts]
AND (a.[staff_id]=i.[staff_id] OR (i.[resource_id] IS NOT NULL AND a.[resource_id]=i.[resource_id]))
JOIN [bookings] b ON b.[reference]=a.[booking_ref]
WHERE b.[status]<>'held' OR b.[expires]>DATEDIFF_BIG(SECOND,'1970-01-01',SYSUTCDATETIME()))
THROW 50003, 'That time was just booked. Please choose another slot.', 1;
IF EXISTS(SELECT 1 FROM inserted i JOIN [blocks] b WITH (UPDLOCK,HOLDLOCK)
ON i.[active]=1 AND b.[starts]<i.[ends] AND b.[ends]>i.[starts]
AND ((b.[staff_id] IS NULL AND b.[resource_id] IS NULL) OR b.[staff_id]=i.[staff_id]
OR (i.[resource_id] IS NOT NULL AND b.[resource_id]=i.[resource_id])))
THROW 50003, 'This time is blocked.', 1;
END;""", """CREATE TRIGGER [blocks_no_booking] ON [blocks] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON a.[active]=1 AND a.[starts]<i.[ends] AND a.[ends]>i.[starts]
AND ((i.[staff_id] IS NULL AND i.[resource_id] IS NULL) OR a.[staff_id]=i.[staff_id]
OR (i.[resource_id] IS NOT NULL AND a.[resource_id]=i.[resource_id]))
JOIN [bookings] b ON b.[reference]=a.[booking_ref]
WHERE b.[status]<>'held' OR b.[expires]>DATEDIFF_BIG(SECOND,'1970-01-01',SYSUTCDATETIME()))
THROW 50003, 'Move or cancel the affected appointments before blocking this time.', 1;
END;""", """CREATE TRIGGER [prevent_abandoned_booking] ON [bookings] AFTER INSERT AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [abandoned_booking_requests] a WITH (UPDLOCK,HOLDLOCK) ON a.[request_key]=i.[request_key])
THROW 50003, 'This reservation request was released. Start a new booking.', 1;
END;"""]
        extra.extend("EXEC(N'"+s.replace("'","''")+"');" for s in scripts)
    # Revision conflicts use a conditional UPDATE with range locks, not a guard table.
    schema=re.sub(r'CREATE TABLE \[write_guard\] \(.*?\);\s*','',schema,flags=re.S)
    schema=re.sub(r'CREATE TABLE \[([^]]+)\] \(.*?\);',lambda m: "IF OBJECT_ID(N'"+m[1]+"',N'U') IS NULL\n"+m[0],schema,flags=re.S)
    schema=re.sub(r'CREATE (UNIQUE )?INDEX \[([^]]+)\] ON \[([^]]+)\] ([^;]+);',lambda m:"IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'"+m[3]+"') AND name=N'"+m[2]+"')\n"+m[0],schema)
    schema=re.sub(r'INSERT INTO \[([^]]+)\] \(([^;]+?)\) VALUES \(([^;]*?)\);',lambda m:"IF NOT EXISTS(SELECT 1 FROM ["+m[1]+"] WHERE [Id]="+m[3].split(',')[0]+")\n"+m[0],schema)
    # Foreign keys are given stable names for repeat initialization of the same schema.
    schema=re.sub(r'ALTER TABLE \[([^]]+)\] ADD FOREIGN KEY \(\[([^]]+)\]\) REFERENCES ([^;]+);',lambda m:"IF OBJECT_ID(N'fk_"+m[1]+'_'+m[2]+"',N'F') IS NULL\nALTER TABLE ["+m[1]+"] ADD CONSTRAINT [fk_"+m[1]+'_'+m[2]+"] FOREIGN KEY (["+m[2]+']) REFERENCES '+m[3]+';',schema)
    extra=[s.replace('CREATE TRIGGER','CREATE OR ALTER TRIGGER') for s in extra]
    (folder/'native-schema.sql').write_text(schema+'\n'+'\n\n'.join(extra)+'\n',encoding='utf-8')
    print(app,'native constraints',len(extra))
