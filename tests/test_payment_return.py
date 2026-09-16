"""Return address validation shared by the six independently installable apps."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
APPS=('shop','pos','booking','jobs','courses','events')


class ReturnAddressTests(unittest.TestCase):
    def functions(self):
        for app in APPS:
            spec=importlib.util.spec_from_file_location(app+'_payment_return',ROOT/app/'cloudgate/payment_return.py')
            module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            yield app,module.payment_return_base

    def test_derived_origin_and_override_precedence(self):
        for app,base in self.functions():
            with self.subTest(app=app):
                self.assertEqual(base('', 'https://EVENTS.example:443'), 'https://events.example')
                self.assertEqual(base('', 'https://custom.example', 'https://ignored.example'), 'https://custom.example')
                self.assertEqual(base('https://override.example/app/', 'https://custom.example'), 'https://override.example/app')
                self.assertEqual(base('', '', 'https://legacy-client.example'), 'https://legacy-client.example')
                self.assertEqual(base('https://server.example'), 'https://server.example')
                for origin in ('http://localhost:3007','http://127.0.0.1:3007','http://[::1]:3007','http://app.localhost:3007'):
                    self.assertEqual(base('',origin),origin)

    def test_invalid_origins_cannot_redirect_or_become_code(self):
        bad=['','null','//evil.example','javascript:alert(1)','data:text/html,test',
             'http://external.example','http://localhost.evil.example','http://127.0.0.1.evil.example',
             'https://good.example@evil.example','https://good.example:abc','https://good.example:0',
             'https://good.example:65536','https://good.example?next=evil','https://good.example#fragment',
             'https://good.example/path','https://good.example\\evil','https://good.example\nInjected',
             'https://good.example\t.evil','https://good.example/"""; raise Exception("INJECTED")',
             'https://good.example%2fevil.example']
        for app,base in self.functions():
            for origin in bad:
                with self.subTest(app=app,origin=origin):
                    with self.assertRaises(ValueError):base('',origin)
            for override in ('javascript:alert(1)','https://user:secret@host.example','https://host.example?next=bad'):
                with self.subTest(app=app,override=override):
                    with self.assertRaises(ValueError):base(override,'https://valid.example')

if __name__=='__main__':unittest.main()
