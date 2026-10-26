import ast,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'shop/cloudgate/refunds.py';s=p.read_text()
s=s.replace('SQLite triggers','SQL Server triggers')
s=s.replace('return "\'" + str(value).replace("\'", "\'\'") + "\'"',"return 'CONVERT(nvarchar(max),0x'+str(value).encode('utf-16le').hex()+')'")
start=s.index('    def array(');end=s.index("    return result + ';'",start)
s=s[:start]+'''    def array(table, columns, where):
        return "COALESCE((SELECT "+','.join('['+c+']' for c in columns)+' FROM '+table+' WHERE '+where+" FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')"

    result = 'SELECT ' + array(entity, columns, 'Id=' + str(bid)) + ' AS EntityJson,'
    result += array(items, item_columns, fk + '=' + str(bid)) + ' AS ItemsJson,'
    result += array(payments, payment_columns, fk + '=' + str(bid)) + ' AS PaymentsJson,'
    result += array('refund_requests',REQUEST_COLUMNS,'BusinessId='+str(bid))+' AS RequestsJson'
    if app == 'pos':
        result += ",COALESCE((SELECT [Value] FROM settings WHERE [Key]='require_shift'),'1') AS RequireShift"
        result += ',' + array('shifts', ['Id', 'Status'], "Status='open' AND TellerUserId=" + str(integer(user['Id']))) + ' AS ShiftsJson'
        result += ',' + array('refunds', ['AmountCents', 'Method', 'ConnectRefundId'], 'SaleId=' + str(bid) + " AND Status='completed'") + ' AS LegacyJson'
'''+s[end:]
s=s.replace("settings = json.loads(snapshot.get('SettingsJson') or '{}')","settings = {'require_shift':snapshot.get('RequireShift','1')}")
start=s.index('        return ("BEGIN IMMEDIATE');end=s.index("    require(op == 'refund'",start)
s=s[:start]+'''        fields=dict(RequestKey=key,BusinessId=bid,Method=spec['method'],AmountCents=0,Currency=str(entity['Currency']).upper(),IntentJson=encode(spec),SnapshotRefunded=0,Status='failed',CreatedBy=str(user['Id']))
        return transaction(claim_insert(fields,check_intent=False))+request_select(bid,key)
'''+s[end:]
start=s.index("    sql = 'BEGIN IMMEDIATE;");end=s.index('\n\ndef apply_sql',start)
s=s[:start]+'''    sql = claim_insert(fields)
    if spec['method'] == 'cash':
        sql += "UPDATE refund_requests SET Status='succeeded' WHERE RequestKey=" + quote(key) + " AND Status='submitting';\\n"
    return transaction(sql) + request_select(bid, key)
'''+s[end:]
start=s.index("    return ('BEGIN IMMEDIATE;");end=s.index('\n\ndef response',start)
s=s[:start]+'''    return transaction('UPDATE refund_requests SET Status=' + quote(status) + ',ProviderRefundId=COALESCE(' + quote(rid) + ',ProviderRefundId),RawJson=' + quote(encode(provider)) +
            ',UpdatedAt=SYSUTCDATETIME() WHERE RequestKey=' + quote(r['RequestKey']) + " AND Status NOT IN ('succeeded','failed');") + request_select(r['BusinessId'], r['RequestKey'])


def transaction(sql):
    return ('SET NOCOUNT ON;SET XACT_ABORT ON;BEGIN TRY BEGIN TRANSACTION;\\n'+sql+
            '\\nCOMMIT;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;\\n')


def claim_insert(fields,check_intent=True):
    predicate='RequestKey='+quote(fields['RequestKey'])
    sql=''
    if check_intent:
        sql=("IF EXISTS(SELECT 1 FROM refund_requests WITH(UPDLOCK,HOLDLOCK) WHERE "+predicate+
             ' AND (BusinessId<>'+str(fields['BusinessId'])+' OR IntentJson<>'+quote(fields['IntentJson'])+
             ")) THROW 50001,'This refund key is already bound to a different request.',1;\\n")
    return sql+'INSERT INTO refund_requests ('+','.join('['+k+']' for k in fields)+') SELECT '+','.join(quote(v) for v in fields.values())+' WHERE NOT EXISTS(SELECT 1 FROM refund_requests WITH(UPDLOCK,HOLDLOCK) WHERE '+predicate+');\\n'
'''+s[end:]
for app in ['shop','pos']:(ROOT/app/'cloudgate/refunds.py').write_text(s,encoding='utf8')
