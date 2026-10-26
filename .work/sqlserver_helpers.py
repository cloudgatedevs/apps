"""Native T-SQL builders, inlined into standalone workflow functions."""

def q(value):
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return '1' if value else '0'
    if isinstance(value, (int, float)):
        return str(value)
    # Unicode data never introduces SQL syntax or Cloudgate selector tokens.
    return "CONVERT(nvarchar(max),0x" + str(value).encode('utf-16le').hex() + ")"

def identifier(value):
    import re
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', value):
        raise ValueError('Invalid SQL identifier.')
    return '[' + value + ']'

def insert(table, record, ignore_key=None):
    target=identifier(table)
    columns=','.join(identifier(k) for k in record)
    values=','.join(q(v) for v in record.values())
    sql='INSERT INTO '+target+' ('+columns+') '
    if ignore_key:
        sql+='SELECT '+values+' WHERE NOT EXISTS (SELECT 1 FROM '+target+' WITH (UPDLOCK,HOLDLOCK) WHERE '+identifier(ignore_key)+'='+q(record[ignore_key])+');'
    else:
        sql+='VALUES ('+values+');'
    if 'Id' in record:
        sql='SET IDENTITY_INSERT '+target+' ON; '+sql+' SET IDENTITY_INSERT '+target+' OFF;'
    return sql

def update(table, record, where):
    return 'UPDATE '+identifier(table)+' SET '+','.join(identifier(k)+'='+q(v) for k,v in record.items())+' WHERE '+where+';'

def upsert(table, record, key, columns=None):
    changes={k:record[k] for k in (columns or record) if k!=key and k!='Id'}
    return update(table,changes,identifier(key)+'='+q(record[key]))+' IF @@ROWCOUNT=0 BEGIN '+insert(table,record)+' END;'

def transaction(statements, revision=None):
    body='\n'.join(statements)
    if revision is not None:
        body=("UPDATE [settings] WITH (UPDLOCK,HOLDLOCK) SET [value]=CONVERT(nvarchar(30),CONVERT(bigint,[value])+1) "
              "WHERE [key]=N'_revision' AND [value]="+q(str(revision))+";\n"
              "IF @@ROWCOUNT<>1 THROW 50001, 'The data changed. Refresh and try again.', 1;\n"+body)
    return ('SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;\n'+body+
            '\nCOMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;\n')

def entity_snapshot_sql(limit):
    return ("SELECT (SELECT JSON_QUERY((SELECT [key],[value] FROM [settings] FOR JSON PATH)) AS [settings], "
            "JSON_QUERY(COALESCE((SELECT N'['+STRING_AGG(CONVERT(nvarchar(max),[data]),N',')+N']' "
            "FROM (SELECT TOP ("+str(limit+1)+") [data] FROM [entities] ORDER BY [Id]) AS bounded),N'[]')) AS [entities] "
            "FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) AS [snapshot];")
