import ast,json,re,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
APPS=('shop','pos','booking','jobs','courses','events')

class MarketplaceContractTests(unittest.TestCase):
    def test_all_python_nodes_use_only_standard_python(self):
        for app in APPS:
            template=json.loads((ROOT/app/'.template/workflow-template.json').read_text(encoding='utf8'))['Projects'][0]['Template']
            for node in template['Nodes']:
                if node['NodeType'] not in (1,4):continue
                with self.subTest(app=app,node=node['Name']):
                    source=node['MainScript']
                    tree=ast.parse('def main():\n'+''.join('    '+line+'\n' for line in source.splitlines()))
                    for item in ast.walk(tree):
                        modules=[n.name for n in item.names] if isinstance(item,ast.Import) else [item.module] if isinstance(item,ast.ImportFrom) else []
                        for module in modules:self.assertIn(module.split('.')[0],sys.stdlib_module_names)
                    self.assertNotRegex(source,r'\b(?:cloudgate|clr)\.')

    def test_database_and_manifest_contracts(self):
        catalog=json.loads((ROOT/'apps.json').read_text(encoding='utf8'))['apps']
        for app in APPS:
            with self.subTest(app=app):
                manifest=json.loads((ROOT/app/'template.json').read_text(encoding='utf8'))
                self.assertEqual(next(a for a in catalog if a['id']==app),manifest)
                self.assertEqual(json.loads((ROOT/app/'package.json').read_text())['version'],manifest['version'])
                template=json.loads((ROOT/app/'.template/workflow-template.json').read_text(encoding='utf8'))['Projects'][0]['Template']
                self.assertEqual(len(template['Databases']),2)
                references={d['FileId'] for d in template['Databases']}
                for database in template['Databases']:
                    self.assertEqual(database['Type'],3);self.assertFalse(database['SelfHosted'])
                    self.assertNotIn('Tables',database)
                    self.assertNotRegex(database['SQLScript'],r'(?i)\b(?:PRAGMA|AUTOINCREMENT|json_group_array|BEGIN IMMEDIATE)\b')
                for node in template['Nodes']:
                    if node['NodeType']==5:
                        self.assertIn(node['FileId'],references);self.assertIn(node['FileProdId'],references)
                        self.assertNotEqual(node['FileId'],node['FileProdId'])
                self.assertEqual({k['Name'] for k in template['Keys'] if k['Type']==2},{'SMTP_HOST','SMTP_PORT','SMTP_USERNAME','SMTP_PASSWORD','SMTP_FROM_EMAIL','SMTP_FROM_NAME','SMTP_SECURITY'})

if __name__=='__main__':unittest.main()
