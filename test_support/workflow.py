"""Test standard Python scripts using data-bound workflow selectors, with no bridge."""
import ast
import re
import textwrap
import uuid

def run(source,values):
    names={'body','Snapshot','Run','IdpAuth'}
    names.update(re.findall(r"(?:value|obj|snapshot|payment_request_value)\(\s*['\"]([A-Za-z_][A-Za-z_0-9]*)['\"]",source))
    if not source.startswith('_inputs ='):
        source='_inputs = {'+', '.join(repr(n)+': '+repr('${'+n+'}') for n in sorted(names))+'}\n'+source
    class Bind(ast.NodeTransformer):
        def visit_Constant(self,node):
            if isinstance(node.value,str):
                node.value=re.sub(r'\$\{([^}]+)\}',lambda m:str(uuid.uuid4()) if m[1]=='newguid' else str(values.get(m[1],'')),node.value)
            return node
    tree=ast.parse('def invoke():\n'+textwrap.indent(source,'    '))
    for node in ast.walk(tree):
        if isinstance(node,ast.Import):
            assert all(n.name.split('.')[0] not in ('clr','cloudgate','System','Web') for n in node.names),'Unsupported runtime import'
        if isinstance(node,ast.ImportFrom):assert (node.module or '').split('.')[0] not in ('clr','cloudgate','System','Web'),'Unsupported runtime import'
    namespace={}
    exec(compile(ast.fix_missing_locations(Bind().visit(tree)),'<workflow>','exec'),namespace)
    return namespace['invoke']()
