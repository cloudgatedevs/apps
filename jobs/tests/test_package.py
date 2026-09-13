import json,sqlite3,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class PackageTests(unittest.TestCase):
 def test_manifest_matches_catalogue(self):
  manifest=json.loads((ROOT/'template.json').read_text(encoding='utf8'));catalog=json.loads((ROOT.parent/'apps.json').read_text(encoding='utf8'));self.assertEqual(manifest,next(a for a in catalog['apps'] if a['id']=='jobs'));self.assertEqual(manifest['build']['outputDir'],'dist');self.assertTrue((ROOT/'.env.example').exists())
 def test_production_empty_sandbox_seeded(self):
  bundle=json.loads((ROOT/'.template/workflow-template.json').read_text(encoding='utf8'));template=bundle['Projects'][0]['Template'];self.assertEqual(len(template['Endpoints']),17);self.assertEqual(len(template['Nodes']),121)
  for db in template['Databases']:
   c=sqlite3.connect(':memory:');c.executescript(db['SQLScriptProd']);self.assertEqual(c.execute('SELECT COUNT(*) FROM entities').fetchone()[0],0);c.executescript(db['SQLScriptProd']);c.executescript((ROOT/'.template/sample-data.sql').read_text(encoding='utf8'));self.assertGreater(c.execute('SELECT COUNT(*) FROM entities').fetchone()[0],0);c.close()
 def test_workers_scheduled_and_guarded(self):
  for route in ['automation','notifications','reconcile','refund-reconcile']:
   g=json.loads((ROOT/'cloudgate/workflows'/route/'graph.json').read_text(encoding='utf8'));self.assertTrue(g['Endpoint']['RunOnSchedule']);self.assertIn("value('route')!='Scheduled Job'",g['Nodes'][0]['MainScript'])
