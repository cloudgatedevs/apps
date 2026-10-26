"""One-time source conversion; emits native T-SQL, never a runtime translator."""
import ast,json,re,logging,subprocess
from pathlib import Path
import sqlglot
from sqlglot import exp
logging.getLogger('sqlglot').setLevel(logging.ERROR)
ROOT=Path(__file__).resolve().parents[1]
JSON_FOR=sqlglot.parse_one('SELECT x FOR JSON PATH,INCLUDE_NULL_VALUES',read='tsql').args['for_']
REVIEW=[]

def sqlserver(sql):
    formats={}
    def fmt(m):
        marker='cgformat_'+str(len(formats));formats[marker]=m[0];return marker
    sql=re.sub(r'\{[A-Za-z_]\w*\}',fmt,sql)
    trees=sqlglot.parse(sql,read='sqlite',error_level=sqlglot.ErrorLevel.RAISE)
    def rewrite(node):
        if isinstance(node,exp.Select) and len(node.expressions)==1 and isinstance(node.expressions[0],exp.JSONArrayAgg):
            value=node.expressions[0].this
            if isinstance(value,exp.JSONObject):
                node.set('expressions',[exp.alias_(kv.expression,kv.this.this,quoted=True) for kv in value.expressions])
                node.set('for_',JSON_FOR.copy())
        if isinstance(node,exp.JSONObjectAgg):
            k,v=[e.sql(dialect='tsql') for e in node.expressions]
            return sqlglot.parse_one("JSON_QUERY(CONCAT(N'{',STRING_AGG(CONVERT(nvarchar(max),CONCAT(N'\"',STRING_ESCAPE("+k+",'json'),N'\":',CASE WHEN "+v+" IS NULL THEN N'null' ELSE CONCAT(N'\"',STRING_ESCAPE("+v+",'json'),N'\"') END)),N','),N'}'))",read='tsql')
        if isinstance(node,exp.JSONArrayAgg):
            value=node.this.sql(dialect='tsql')
            return sqlglot.parse_one("JSON_QUERY(CONCAT(N'[',STRING_AGG(CONVERT(nvarchar(max),"+value+"),N','),N']'))",read='tsql')
        if isinstance(node,exp.ParseJSON):
            return exp.Anonymous(this='JSON_QUERY',expressions=[node.this])
        if isinstance(node,exp.Anonymous):
            name=node.name.lower()
            if name=='json':return exp.Anonymous(this='JSON_QUERY',expressions=node.expressions)
            if name=='last_insert_rowid':return sqlglot.parse_one('CONVERT(bigint,SCOPE_IDENTITY())',read='tsql')
            if name=='changes':return sqlglot.parse_one('@@ROWCOUNT',read='tsql')
            if name=='json_valid':return sqlglot.parse_one('ISJSON('+node.expressions[0].sql(dialect='tsql')+')=1',read='tsql')
        if isinstance(node,exp.Identifier):
            if node.this.lower() in ('key','value','percent','row'):node.set('quoted',True)
            if node.this in ('_ctx','_stale'):node.set('this','#'+node.this[1:]);node.set('quoted',False)
        if isinstance(node,exp.DPipe):
            def flatten(v):return flatten(v.this)+flatten(v.expression) if isinstance(v,exp.DPipe) else [v]
            return exp.Anonymous(this='CONCAT',expressions=flatten(node))
        # SQL Server requires TOP/OFFSET for a sorted derived table.
        if isinstance(node,exp.Select) and node.parent and isinstance(node.parent,exp.Subquery) and node.args.get('order') and not node.args.get('limit') and not node.args.get('for_'):
            node.set('limit',exp.Limit(expression=exp.Literal.number(2147483647)))
        return node
    result=[]
    for tree in trees:
        if tree is None:continue
        if isinstance(tree,exp.Command):raise ValueError('Unparsed command')
        tree=tree.transform(rewrite)
        out=tree.sql(dialect='tsql')
        out=re.sub(r'(cgdynamic_\d+|cgformat_\d+) <> 0',r'\1',out)
        out=out.replace('GETDATE()','SYSUTCDATETIME()')
        out=out.replace('BEGIN TRANSACTION','SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION')
        out=re.sub(r'CREATE TABLE IF NOT EXISTS (#(?:ctx|stale))',r'CREATE TABLE \1',out,flags=re.I)
        if out.startswith('CREATE TABLE #ctx'):
            out='CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint)'
        if out.startswith('CREATE TABLE #stale'):
            out='CREATE TABLE #stale (Id int PRIMARY KEY)'
        if isinstance(tree,exp.Create) and '#ctx' in out:
            out='CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint)'
        if isinstance(tree,exp.Create) and '#stale' in out:
            out='CREATE TABLE #stale (Id int PRIMARY KEY)'
        for marker,value in formats.items():out=out.replace(marker,value)
        result.append(out)
    return '; '.join(result)+(';' if sql.rstrip().endswith(';') else '')

class Rewrite(ast.NodeTransformer):
    def __init__(self,path):self.path=path;self.count=0
    def visit(self,node):
        if isinstance(node,(ast.Constant,ast.BinOp)):
            pieces=[];dynamic=[]
            def flatten(n):
                if isinstance(n,ast.Constant) and isinstance(n.value,str):pieces.append(n.value)
                elif isinstance(n,ast.BinOp) and isinstance(n.op,ast.Add):flatten(n.left);flatten(n.right)
                else:
                    marker='cgdynamic_'+str(len(dynamic));dynamic.append(n);pieces.append(marker)
            flatten(node);template=''.join(pieces)
            if re.match(r'\s*(?:\(?SELECT\b|WITH\b|INSERT\b|UPDATE\b|DELETE\b|CREATE\b|DROP\b|BEGIN\b|COMMIT\b)',template,re.I):
                try:
                    converted=sqlserver(template)
                    parts=re.split(r'(cgdynamic_\d+)',converted)
                    values=[dynamic[int(part.split('_')[1])] if re.fullmatch(r'cgdynamic_\d+',part) else ast.Constant(part) for part in parts if part]
                    output=values[0]
                    for part in values[1:]:output=ast.BinOp(left=output,op=ast.Add(),right=part)
                    self.count+=1
                    return ast.copy_location(output,node)
                except Exception as e:
                    REVIEW.append({'file':str(self.path.relative_to(ROOT)),'line':getattr(node,'lineno',0),'sql':template,'error':str(e)[:250]})
        return super().visit(node)

if __name__=='__main__':
    total=0
    for app in ['shop','pos']:
        for path in (ROOT/app/'cloudgate/workflows').rglob('*.py'):
            if path.parent.name=='_shared':continue
            source=subprocess.check_output(['git','show','HEAD:'+path.relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8')
            transform=Rewrite(path);tree=transform.visit(ast.parse(source));ast.fix_missing_locations(tree)
            if transform.count:
                path.write_text(ast.unparse(tree)+'\n',encoding='utf-8');total+=transform.count
        for path in (ROOT/app/'cloudgate/workflows').rglob('*.sql'):
            source=subprocess.check_output(['git','show','HEAD:'+path.relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8')
            if re.fullmatch(r'\s*\$\{\w+\}\s*',source):continue
            try:path.write_text(sqlserver(source)+'\n',encoding='utf-8')
            except Exception as error:REVIEW.append({'file':str(path.relative_to(ROOT)),'sql':source,'error':str(error)[:250]})
    (ROOT/'.work/commerce-review.json').write_text(json.dumps(REVIEW,indent=2),encoding='utf-8')
    print('Converted',total,'expressions;',len(REVIEW),'partial expressions require review.')
