import ast
from pathlib import Path
class Rewrite(ast.NodeTransformer):
 def visit_Call(self,node):
    node=self.generic_visit(node)
    if isinstance(node.func,ast.Attribute) and node.func.attr=='format' and not node.args and len(node.keywords)==1 and node.keywords[0].arg=='where':
        return ast.copy_location(ast.Call(func=ast.Attribute(value=node.func.value,attr='replace',ctx=ast.Load()),args=[ast.Constant('{where}'),node.keywords[0].value],keywords=[]),node)
    return node
for app in ['shop','pos']:
 for p in Path(app+'/cloudgate/workflows').rglob('*.py'):
    tree=Rewrite().visit(ast.parse(p.read_text(encoding='utf8')));ast.fix_missing_locations(tree);p.write_text(ast.unparse(tree)+'\n',encoding='utf8')
 p=Path(app+'/tests/workflow_fixture.py');s=p.read_text(encoding='utf8');s=s.replace("'sessionid': '1'","'sessionid': '1', 'Header_Origin':'http://127.0.0.1:3596'")
 start=s.index("            if node.get('libraries'):");end=s.index("            source +=",start);s=s[:start]+s[end:]
 p.write_text(s,encoding='utf8')
