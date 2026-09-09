import base64
from contextlib import closing
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).parents[1] / 'cloudgate'))
import local_server
from local_media import upload, listing, delete, read_image
from test_branding import png


class MediaTests(unittest.TestCase):
    def test_folder_pagination_preserves_independent_uploads_and_legacy_files(self):
        with tempfile.TemporaryDirectory() as directory:
            content = base64.b64encode(png()).decode()
            logo = upload(directory, content, 'logo.png')
            photo = upload(directory, content, 'photo.png', 'booking/services')
            self.assertNotEqual(logo['id'], photo['id'])
            self.assertEqual(listing(directory, path='booking/services')['items'], [photo])
            self.assertEqual(listing(directory, skip=1, take=1)['total'], 2)
            self.assertEqual(len(listing(directory, skip=1, take=1)['items']), 1)
            metadata = Path(directory) / (logo['id'] + '.json')
            legacy = json.loads(metadata.read_text()); del legacy['path']
            metadata.write_text(json.dumps(legacy))
            self.assertEqual(listing(directory, path='booking/branding')['items'][0]['path'], 'booking/branding')
            for path in ['shop/products', 'booking/../shop', 'booking/..\\shop', 'booking//photos', '/booking/services']:
                with self.subTest(path=path), self.assertRaises(ValueError): upload(directory, content, 'x.png', path)

    def test_delete_guards_references_scope_and_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            item = upload(directory, base64.b64encode(png()).decode(), 'photo.png')
            for reference in [item['url'], 'http://localhost:3002' + item['url'] + '#logo']:
                with self.assertRaisesRegex(ValueError, 'in use'): delete(directory, item['id'], [reference])
            for key in ['../x', '/absolute', item['id'] + '.png', None]:
                with self.assertRaises(ValueError): delete(directory, key)
            metadata = Path(directory) / (item['id'] + '.json')
            metadata.write_text(json.dumps({**item, 'path': 'shop/products'}))
            with self.assertRaisesRegex(ValueError, 'Only Booking'): delete(directory, item['id'])
            metadata.write_text(json.dumps(item))
            self.assertEqual(delete(directory, item['id']), {'id': item['id'], 'deleted': True})
            self.assertIsNone(read_image(directory, item['url']))
            self.assertEqual(listing(directory)['total'], 0)

    def test_preview_api_requires_admin_and_rechecks_saved_usage_on_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            old_db = local_server.DB
            local_server.DB = str(Path(directory) / 'test.db')
            with closing(sqlite3.connect(local_server.DB)) as db:
                db.executescript((local_server.ROOT / 'schema.sql').read_text(encoding='utf-8'))
            server = ThreadingHTTPServer(('127.0.0.1', 0), local_server.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            def request(body, admin=True):
                headers = {'Content-Type': 'application/json', 'X-Studio-Preview': '1'}
                if admin: headers['X-Preview-Role'] = 'admin'
                req = Request(f'http://127.0.0.1:{server.server_port}/api/branding-media', data=json.dumps(body).encode(), headers=headers)
                try:
                    with urlopen(req, timeout=5) as res: return res.status, json.load(res)
                except HTTPError as error:
                    with error: return error.code, json.load(error)
            try:
                status, image = request({'op': 'upload', 'name': 'logo.png', 'content': base64.b64encode(png()).decode(), 'path': 'booking/branding'})
                self.assertEqual(status, 200)
                self.assertEqual(request({'op': 'delete', 'id': image['id']}, False)[0], 403)
                local_server.run({'op': 'admin-settings', 'settings': {'logo_url': image['url']}}, local_server.ADMIN)
                status, error = request({'op': 'delete', 'id': image['id']})
                self.assertEqual(status, 400); self.assertIn('in use', error['error'])
                self.assertEqual(request({'op': 'list'})[1]['total'], 1)
                local_server.run({'op': 'admin-settings', 'settings': {'logo_url': ''}}, local_server.ADMIN)
                self.assertTrue(request({'op': 'delete', 'id': image['id']})[1]['deleted'])
                self.assertEqual(request({'op': 'list'})[1]['total'], 0)
            finally:
                server.shutdown(); server.server_close(); thread.join(timeout=5)
                local_server.DB = old_db


if __name__ == '__main__': unittest.main()
