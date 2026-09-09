import json
from pathlib import Path
import sqlite3
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'cloudgate'))
from engine import TABLES, plan
ROOT = Path(__file__).parents[1] / 'cloudgate'
ADMIN = {'Id': 12, 'IsActive': True, 'Role': 'Admin', 'Email': 'admin@example.com'}


class TeamPhotoTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:'); self.db.row_factory = sqlite3.Row
        self.db.executescript((ROOT / 'schema.sql').read_text(encoding='utf-8') + (ROOT / 'seed.sql').read_text(encoding='utf-8'))
    def tearDown(self): self.db.close()
    def call(self, data, identity=ADMIN):
        snapshot = {table: [dict(row) for row in self.db.execute('SELECT * FROM ' + table)] for table in TABLES}
        sql, result = plan(snapshot, data, identity)
        self.db.executescript(sql); return result
    def save(self, record, identity=ADMIN): return self.call({'op': 'admin-save', 'entity': 'staff', 'record': record}, identity)

    def test_new_team_member_photo_is_in_public_and_admin_profiles(self):
        self.save({'name': 'Consultant', 'title': 'Advisor', 'bio': 'Appointments', 'color': '#aabbcc', 'service_ids': [1], 'hours': {'0': [['09:00', '17:00']]}, 'active': 1, 'image_url': 'https://cdn.example/consultant.png'})
        admin = self.call({'op': 'admin-data'})
        member = next(person for person in admin['staff'] if person['name'] == 'Consultant')
        self.assertEqual(member['image_url'], 'https://cdn.example/consultant.png')
        self.assertNotIn('staff_metadata', admin)
        public = self.call({'op': 'catalog'}, None)
        self.assertEqual(next(p for p in public['staff'] if p['Id'] == member['Id'])['image_url'], member['image_url'])
        self.assertEqual(next(p for p in public['staff'] if p['Id'] == member['Id'])['service_ids'], [1])

    def test_replace_remove_and_omitted_photo_preserve_working_hours(self):
        before = self.call({'op': 'admin-data'})['staff'][0]
        self.save({'Id': before['Id'], 'image_url': '/images/team.png'})
        self.save({'Id': before['Id'], 'title': 'Updated role'})
        after = self.call({'op': 'admin-data'})['staff'][0]
        self.assertEqual(after['image_url'], '/images/team.png')
        self.assertEqual(after['hours'], before['hours']); self.assertEqual(after['service_ids'], before['service_ids'])
        self.save({'Id': before['Id'], 'image_url': ''})
        self.assertEqual(self.call({'op': 'admin-data'})['staff'][0]['image_url'], '')

    def test_validation_and_authorization_reject_changes_atomically(self):
        before = self.call({'op': 'admin-data'})['staff'][0]
        for identity in [None, {'Id': 13, 'IsActive': True, 'Role': 'User'}]:
            with self.assertRaisesRegex(ValueError, 'Admin'): self.save({'Id': 1, 'image_url': '/photo.png'}, identity)
        for url in ['javascript:alert(1)', '//other.example/x', 'https://user:password@example.com/x', 'https://example.com/' + 'a' * 2048]:
            with self.subTest(url=url), self.assertRaises(ValueError): self.save({'Id': 1, 'name': 'Unwanted change', 'image_url': url})
        self.assertEqual(self.call({'op': 'admin-data'})['staff'][0], before)
        with self.assertRaisesRegex(ValueError, 'Record not found'): self.save({'Id': 999, 'image_url': '/photo.png'})

    def test_inactive_staff_keeps_photo_and_migration_is_idempotent(self):
        self.save({'Id': 1, 'active': 0, 'image_url': '/photo.png'})
        migration = (ROOT / 'migrations/1.6.0-team-photos.sql').read_text()
        self.db.executescript(migration + migration)
        self.assertEqual(self.call({'op': 'admin-data'})['staff'][0]['image_url'], '/photo.png')
        self.assertFalse(any(p['Id'] == 1 for p in self.call({'op': 'catalog'}, None)['staff']))


if __name__ == '__main__': unittest.main()
