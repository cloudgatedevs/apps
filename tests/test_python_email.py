"""Email delivery uses the standard library, with the transport mocked locally."""
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
import workflow

ROOT=Path(__file__).resolve().parents[1]
APPS=('shop','pos','booking','jobs','courses','events')
CONFIG=dict(SMTP_HOST='smtp.example.invalid',SMTP_PORT='587',SMTP_USERNAME='mailer',SMTP_PASSWORD='test-secret',SMTP_FROM_EMAIL='sender@example.invalid',SMTP_FROM_NAME='Store',SMTP_SECURITY='starttls')

class EmailTests(unittest.TestCase):
    def test_all_apps_use_tls_html_and_reply_to(self):
        for app in APPS:
            with self.subTest(app=app):
                client=MagicMock();client.__enter__.return_value=client;client.send_message.return_value={}
                source="def value(name):return _inputs.get(name,'')\n"+(ROOT/app/'cloudgate/smtp_email.py').read_text(encoding='utf8')
                source+="\nreturn send_email('buyer@example.invalid','Receipt',text='Receipt',html='<b>Receipt</b>',reply_to='help@example.invalid')"
                with patch('smtplib.SMTP',return_value=client) as constructor:
                    self.assertTrue(workflow.run(source,CONFIG))
                constructor.assert_called_once_with('smtp.example.invalid',587,timeout=20)
                client.starttls.assert_called_once();client.login.assert_called_once_with('mailer','test-secret')
                message=client.send_message.call_args.args[0]
                self.assertEqual(message['Reply-To'],'help@example.invalid')
                self.assertEqual(message.get_body(preferencelist=('html',)).get_content().strip(),'<b>Receipt</b>')

    def test_delivery_failure_does_not_expose_credentials(self):
        for app in ('shop','pos'):
            source=(ROOT/app/'cloudgate/workflows/_shared/lib.py').read_text(encoding='utf8')+'\n'+(ROOT/app/'cloudgate/workflows/_shared/send_email.py').read_text(encoding='utf8')
            with patch('smtplib.SMTP',side_effect=RuntimeError('private SMTP password')):
                result=json.loads(workflow.run(source,dict(CONFIG,OrderEmail=json.dumps(dict(to='buyer@example.invalid',subject='Receipt')))))
            self.assertFalse(result['sent']);self.assertNotIn('private SMTP password',str(result))

    def test_header_injection_never_opens_a_connection(self):
        source="def value(name):return _inputs.get(name,'')\n"+(ROOT/'shop/cloudgate/smtp_email.py').read_text(encoding='utf8')
        source+="\nreturn send_email('buyer@example.invalid','Receipt\\nBcc:other@example.invalid')"
        with patch('smtplib.SMTP') as constructor, self.assertRaises(ValueError):workflow.run(source,CONFIG)
        constructor.assert_not_called()

    def test_empty_receipt_does_not_send(self):
        source=(ROOT/'shop/cloudgate/workflows/_shared/lib.py').read_text(encoding='utf8')+'\n'+(ROOT/'shop/cloudgate/workflows/_shared/send_email.py').read_text(encoding='utf8')
        with patch('smtplib.SMTP') as constructor:self.assertFalse(json.loads(workflow.run(source,dict(CONFIG,OrderEmail='{}')))['sent'])
        constructor.assert_not_called()

if __name__=='__main__':unittest.main()
