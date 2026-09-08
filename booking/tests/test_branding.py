import base64
import binascii
import json
from pathlib import Path
import sqlite3
import struct
import sys
import tempfile
import unittest
import zlib
sys.path.insert(0,str(Path(__file__).parents[1]/'cloudgate'))
from engine import TABLES, plan
from local_media import upload, listing, read_image
ROOT=Path(__file__).parents[1]/'cloudgate'
ADMIN={'Role':'Admin','Email':'admin@example.com','IsActive':True}

def png():
    def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x66\x44\xaa\xff'))+chunk(b'IEND',b'')

class BrandingTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
        self.db.executescript((ROOT/'schema.sql').read_text(encoding='utf-8')+(ROOT/'seed.sql').read_text(encoding='utf-8'))
    def tearDown(self): self.db.close()
    def call(self,op,identity=None,**data):
        snapshot={t:[dict(r) for r in self.db.execute('SELECT * FROM '+t)] for t in TABLES}
        sql,result=plan(snapshot,dict(op=op,**data),identity)
        self.db.executescript(sql);return result
    def test_saved_branding_is_public_and_migration_does_not_reset_custom_values(self):
        values={'app_name':'Bloom','app_short_name':'BL','logo_url':'/logo.png','icon_url':'https://cdn.example/app.png','favicon_url':'/fav.ico','logo_show_name':'0','theme_primary':'#663399','theme_accent':'#BAAACC','theme_background':'#191020'}
        self.call('admin-settings',ADMIN,settings={**values,'smtp_password':'secret'})
        self.db.executescript((ROOT/'migrations/1.2.0-branding.sql').read_text(encoding='utf-8'))
        settings=self.call('catalog')['settings']
        self.assertEqual({key:settings[key] for key in values},values)
        self.assertNotIn('smtp_password',settings)
    def test_branding_changes_require_admin_and_invalid_batch_is_atomic(self):
        with self.assertRaisesRegex(ValueError,'Admin access'): self.call('admin-settings',settings={'app_name':'Intruder'})
        for key,value in [('theme_primary','red'),('theme_accent','#fff'),('theme_background','url(x)'),('logo_url','javascript:alert(1)'),('icon_url','//example/a'),('favicon_url','https://user:pass@example/x'),('app_short_name','a'*31),('logo_show_name','yes')]:
            with self.subTest(key=key), self.assertRaises(ValueError): self.call('admin-settings',ADMIN,settings={'app_name':'Invalid batch',key:value})
        self.assertEqual(self.call('catalog')['settings']['app_name'],'')
    def test_remove_images_and_use_business_name(self):
        self.call('admin-settings',ADMIN,settings={'logo_url':'/logo.png','app_name':'Custom'})
        self.call('admin-settings',ADMIN,settings={'logo_url':'','app_name':''})
        self.assertEqual(self.call('catalog')['settings']['logo_url'],'')
    def test_settings_cannot_reset_the_concurrent_write_revision(self):
        self.call('admin-settings',ADMIN,settings={'app_name':'First update'})
        before=int(self.db.execute("SELECT value FROM settings WHERE key='_revision'").fetchone()[0])
        stale={t:[dict(r) for r in self.db.execute('SELECT * FROM '+t)] for t in TABLES}
        self.call('admin-settings',ADMIN,settings={'app_name':'Second update','_revision':str(before),'smtp_password_configured':False})
        after=int(self.db.execute("SELECT value FROM settings WHERE key='_revision'").fetchone()[0])
        self.assertEqual(after,before+1)
        self.assertNotIn('_revision',self.call('admin-data',ADMIN)['settings'])
        sql,_=plan(stale,{'op':'admin-settings','settings':{'app_name':'Stale update'}},ADMIN)
        with self.assertRaises(sqlite3.IntegrityError):self.db.executescript(sql)
        self.db.rollback()
        self.assertEqual(self.call('catalog')['settings']['app_name'],'Second update')

class LocalMediaTests(unittest.TestCase):
    def test_upload_list_retrieve_and_reject_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            data=png();item=upload(directory,base64.b64encode(data).decode(),'Test icon.png')
            self.assertEqual(read_image(directory,item['url']),data)
            self.assertEqual(listing(directory)['items'],[item])
            self.assertIsNone(read_image(directory,'/api/branding-media/../../secret'))
            self.assertIsNone(read_image(directory,'/api/branding-media/'+item['id']+'.json'))
            upload(directory,base64.b64encode(data).decode(),'Again.png')
            self.assertEqual(listing(directory)['total'],1)
    def test_rejects_non_images_truncated_images_and_appended_content(self):
        with tempfile.TemporaryDirectory() as directory:
            for data in [b'<svg onload="alert(1)"></svg>',png()[:-4],png()+b'<script>bad</script>',b'\x89PNG\r\n\x1a\n']:
                with self.subTest(data=data),self.assertRaises(ValueError):upload(directory,base64.b64encode(data).decode(),'image.png')
            self.assertEqual(listing(directory)['total'],0)

if __name__=='__main__':unittest.main()
