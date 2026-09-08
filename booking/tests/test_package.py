"""Check the installation boundary that separates sample and real business data."""
import json
from pathlib import Path
import sqlite3
import unittest

APP = Path(__file__).parents[1]

class PackageTests(unittest.TestCase):
    def test_install_keeps_production_catalog_empty(self):
        template = json.loads((APP / '.template/workflow-template.json').read_text())['Projects'][0]['Template']
        databases = template['Databases']
        self.assertEqual(len(databases), 2)
        self.assertEqual(len({d['Name'] for d in databases}), 2)
        ids = {d['FileId'] for d in databases}
        prod_ids = {n['FileProdId'] for n in template['Nodes'] if n.get('FileProdId') and n['FileProdId'] != n.get('FileId')}
        self.assertEqual(len(prod_ids), 1)
        for node in template['Nodes']:
            if node.get('NodeType') == 5:
                self.assertIn(node['FileId'], ids)
                self.assertIn(node['FileProdId'], ids)
                self.assertNotEqual(node['FileId'], node['FileProdId'])
        schema = (APP / '.template/schema.sql').read_text()
        samples = (APP / '.template/sample-data.sql').read_text()
        for database in databases:
            # Matches ApplyAppSchemaSql in Cloudgate's App Store importer.
            production = database['FileId'] in prod_ids
            with sqlite3.connect(':memory:') as db:
                db.executescript(schema + ('' if production else samples))
                self.assertEqual(db.execute('SELECT COUNT(*) FROM services').fetchone()[0], 0 if production else 6)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM staff').fetchone()[0], 0 if production else 3)
                db.execute("UPDATE settings SET value='My studio' WHERE key='name'")
                db.executescript(schema)
                self.assertEqual(db.execute("SELECT value FROM settings WHERE key='name'").fetchone()[0], 'My studio')

    def test_store_manifest_matches_and_assets_exist(self):
        manifest = json.loads((APP / 'template.json').read_text())
        catalog = json.loads((APP.parent / 'apps.json').read_text())
        entries = catalog if isinstance(catalog, list) else catalog['apps']
        self.assertEqual(next(a for a in entries if a['id'] == 'booking'), manifest)
        for key in ['file', 'schema', 'sampleData']:
            self.assertTrue((APP / manifest['workflows'][key]).is_file())

if __name__ == '__main__':
    unittest.main()
