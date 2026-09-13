import json,sys,types,unittest,textwrap
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
class Result:
 def GetAwaiter(self):return self
 def GetResult(self):return None
class Sender:
 def __init__(self,fail=False):self.calls=[];self.fail=fail
 def SendHtmlAsync(self,*args):
  self.calls.append(args)
  if self.fail:raise RuntimeError('sensitive-provider-detail')
  return Result()
 def SendAsync(self,*args):return self.SendHtmlAsync(*args)
class Resolver:
 def __init__(self,sender):self.sender=sender
 def __getitem__(self,key):return lambda:self.sender
class EmailTests(unittest.TestCase):
 def execute(self,app,msg,fail=False):
  sender=Sender(fail);releases=[]
  modules={name:types.ModuleType(name) for name in ['clr','Web','Web.Core','Web.Core.Shared','Web.Core.Shared.Services','Web.Core.Shared.Services.Endpoints','Web.Core.Shared.Services.Endpoints.Engine','Abp','Abp.Dependency','Zero','Zero.IdentityProvider','Zero.IdentityProvider.Emailing']}
  modules['clr'].AddReference=lambda name:None
  modules['Web.Core.Shared.Services.Endpoints.Engine'].WorkflowSessionKeyExecutionContext=types.SimpleNamespace(GetKeys=lambda session:[types.SimpleNamespace(Key='OrderEmail',Value=json.dumps(msg))])
  modules['Abp.Dependency'].IocManager=types.SimpleNamespace(Instance=types.SimpleNamespace(Resolve=Resolver(sender),Release=releases.append))
  modules['Zero.IdentityProvider.Emailing'].WorkflowAppEmailSender=Sender
  code=(ROOT/app/'cloudgate/workflows/_shared/send_email.py').read_text().replace('${sessionid}','123')
  scope={'load_json':lambda raw,default:json.loads(raw) if raw else default,'out':lambda value:value}
  with patch.dict(sys.modules,modules):
   exec('def run():\n'+textwrap.indent(code,' '),scope);result=scope['run']()
  return result,sender,releases
 def test_default_delivery_needs_no_app_smtp_settings_and_keeps_html_reply_to(self):
  for app in ['shop','pos']:
   with self.subTest(app=app):
    msg={'to':'test@example.invalid','subject':'Receipt','html':'<b>Receipt</b>','replyTo':'support@example.invalid','reference':'test'}
    result,sender,releases=self.execute(app,msg)
    self.assertTrue(result['sent']);self.assertEqual(sender.calls,[(msg['to'],msg['subject'],msg['html'],msg['replyTo'])]);self.assertEqual(releases,[sender])
 def test_provider_failure_is_reported_without_leaking_details(self):
  for app in ['shop','pos']:
   result,sender,releases=self.execute(app,{'to':'test@example.invalid','html':'body'},True)
   self.assertFalse(result['sent']);self.assertNotIn('sensitive-provider-detail',str(result));self.assertEqual(releases,[sender])
 def test_empty_message_does_not_send(self):
  for app in ['shop','pos']:
   result,sender,releases=self.execute(app,{})
   self.assertFalse(result['sent']);self.assertEqual(sender.calls,[])
 def test_versions_and_rollout_requirements_agree(self):
  catalog=json.loads((ROOT/'apps.json').read_text())['apps']
  for app in ['shop','pos','booking','jobs']:
   manifest=json.loads((ROOT/app/'template.json').read_text());entry=next(x for x in catalog if x['id']==app)
   self.assertEqual(manifest['version'],entry['version']);self.assertNotIn('smtp',manifest['requirements']);self.assertNotIn('smtp',entry['requirements'])
   for file in ['package.json','package-lock.json']:
    package=json.loads((ROOT/app/file).read_text());self.assertEqual(package['version'],manifest['version'])
   bundle=json.loads((ROOT/app/'.template/workflow-template.json').read_text())
   scripts='\n'.join(n.get('MainScript') or '' for project in bundle['Projects'] for n in project['Template']['Nodes'])
   self.assertFalse('import smtplib' in scripts, app+' still has direct SMTP code');self.assertTrue('WorkflowAppEmailSender' in scripts, app+' lacks shared email sender')
if __name__=='__main__':unittest.main()
