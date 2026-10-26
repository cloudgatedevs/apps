import ast,re,logging
from pathlib import Path
import sqlglot
from sqlglot import exp
logging.getLogger('sqlglot').setLevel(logging.CRITICAL)
ROOT=Path(__file__).resolve().parents[1]
FOR=sqlglot.parse_one('SELECT x FOR JSON PATH,INCLUDE_NULL_VALUES',read='tsql').args['for_']
def fix(sql):
    sql=re.sub(r"DATETIME\('now', '-([^']+) (days|hours|minutes)'\)",lambda m:'DATEADD('+m[2][:-1]+',-'+m[1]+',SYSUTCDATETIME())',sql,flags=re.I)
    sql=re.sub(r"DATETIME\('now', 'start of day'\)","CONVERT(date,SYSUTCDATETIME())",sql,flags=re.I)
    sql=re.sub(r"DATE\('now'\)","CONVERT(date,SYSUTCDATETIME())",sql,flags=re.I)
    sql=re.sub(r'\bDATE\(([\w.]+)\)',r'CONVERT(date,\1)',sql,flags=re.I)
    sql=re.sub(r'\b_ctx\b','#ctx',sql)
    sql=re.sub(r'\b_stale\b','#stale',sql)
    sql=sql.replace("'[Key]'","'Key'").replace("'[Value]'","'Value'")
    return sql
def convert(sql):
    original=fix(sql);formats={}
    def fmt(m):
        key='cgformat_'+str(len(formats));formats[key]=m[0];return key
    sql=re.sub(r'\{\w+\}',fmt,original)
    trees=sqlglot.parse(sql,read='tsql',error_level=sqlglot.ErrorLevel.RAISE)
    def rewrite(node):
        if isinstance(node,exp.Identifier) and node.this.lower() in ('key','value','row','percent'):node.set('quoted',True)
        if isinstance(node,exp.Select):
            if len(node.expressions)==1 and isinstance(node.expressions[0],exp.JSONArrayAgg) and isinstance(node.expressions[0].this,exp.JSONObject):
                value=node.expressions[0].this
                node.set('expressions',[exp.alias_(kv.expression,kv.this.this,quoted=True) for kv in value.expressions]);node.set('for_',FOR.copy())
            if node.args.get('group'):
                aliases={e.alias.lower():e.this for e in node.expressions if isinstance(e,exp.Alias)}
                node.args['group'].set('expressions',[aliases.get(e.name.lower(),e).copy() if isinstance(e,exp.Column) and not e.table else e for e in node.args['group'].expressions])
        if isinstance(node,exp.JSONArrayAgg):
            return sqlglot.parse_one("JSON_QUERY(CONCAT(N'[',STRING_AGG(CONVERT(nvarchar(max),"+node.this.sql(dialect='tsql')+"),N','),N']'))",read='tsql')
        return node
    output=[]
    for tree in trees:
        if tree is None:continue
        if isinstance(tree,exp.Command):raise ValueError('Cannot parse')
        for _ in range(3):tree=tree.transform(rewrite)
        out=tree.sql(dialect='tsql')
        out=re.sub(r'\bAS (cgdynamic_\d+|cgformat_\d+)',r'\1',out)
        out=re.sub(r'(cgdynamic_\d+|cgformat_\d+) <> 0',r'\1',out)
        for k,v in formats.items():out=out.replace(k,v)
        output.append(out)
    return '; '.join(output)+(';' if original.rstrip().endswith(';') else '')
class Rewrite(ast.NodeTransformer):
 def visit(self,node):
    if isinstance(node,(ast.Constant,ast.BinOp)):
        parts=[];dynamic=[]
        def flatten(n):
            if isinstance(n,ast.Constant) and isinstance(n.value,str):parts.append(n.value)
            elif isinstance(n,ast.BinOp) and isinstance(n.op,ast.Add):flatten(n.left);flatten(n.right)
            else:parts.append('cgdynamic_'+str(len(dynamic)));dynamic.append(n)
        flatten(node);sql=''.join(parts)
        if re.match(r'\s*(?:\(?SELECT\b|WITH\b)',sql,re.I):
            try:
                out=convert(sql);bits=re.split(r'(cgdynamic_\d+)',out)
                values=[dynamic[int(b.split('_')[1])] if re.fullmatch(r'cgdynamic_\d+',b) else ast.Constant(b) for b in bits if b]
                output=values[0]
                for bit in values[1:]:output=ast.BinOp(left=output,op=ast.Add(),right=bit)
                return ast.copy_location(output,node)
            except Exception:pass
        if isinstance(node,ast.Constant) and isinstance(node.value,str):
            node.value=fix(node.value)
            if node.value in ('[Key]','[Value]'):node.value=node.value[1:-1]
    return super().visit(node)
for app in ['shop','pos']:
 for p in (ROOT/app/'cloudgate/workflows').rglob('*.py'):
    if p.parent.name=='_shared':continue
    tree=Rewrite().visit(ast.parse(p.read_text(encoding='utf8')));ast.fix_missing_locations(tree);s=ast.unparse(tree)+'\n'
    # Date modifiers assembled around Python expressions are not constant SQL.
    s=re.sub(r"DATETIME\('now', '-([\"'] \+ str\(\w+\) \+ [\"']) days'\)",r'DATEADD(day,-\1,SYSUTCDATETIME())',s)
    p.write_text(s,encoding='utf8')

p=ROOT/'booking/cloudgate/engine.py';s=p.read_text(encoding='utf8');s=s.replace('"key="+q(', '"[key]="+q(').replace("'key='+q(","'[key]='+q(");p.write_text(s,encoding='utf8')
for p in (ROOT/'booking/tests').glob('test_*.py'):
 s=p.read_text(encoding='utf8').replace("WHERE key=","WHERE [key]=").replace("SET value=","SET [value]=").replace('SELECT value FROM','SELECT [value] FROM')
 s=re.sub(r"\(ROOT\s*/\s*['\"]migrations/[^'\"]+['\"]\)","(ROOT/'schema.sql')",s)
 p.write_text(s,encoding='utf8')
