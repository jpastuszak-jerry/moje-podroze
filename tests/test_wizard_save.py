import unittest
from unittest.mock import patch

import app as app_module
import travels


def wizard_payload(**overrides):
    payload = {
        'travel': {
            'name': 'Wizard trip',
            'start_date': '2025-07-10',
            'end_date': '2025-07-12',
            'purpose': 'Test',
            'amount': 100,
            'currency': 'PLN',
            'number_of_flights': 2,
            'rating': 4.5,
            'has_photo_album': True,
            'is_description_complete': False,
            'notes': 'Created from wizard',
            'reflections': None,
        },
        'locations': [{
            'location_id': 10,
            'arrival_date': '2025-07-10',
            'departure_date': '2025-07-12',
            'notes': 'Stay',
            'force_outside_range': True,
        }],
        'participants': [{'person_id': 3}],
    }
    payload.update(overrides)
    return payload


class RecordingCursor:
    def __init__(self, db):
        self.db = db
        self.next_row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=()):
        normalized = ' '.join(sql.split())
        self.db.statements.append((normalized, params))
        if self.db.fail_on and self.db.fail_on in normalized:
            raise self.db.fail_error
        if normalized.startswith('INSERT INTO travels '):
            self.next_row = (self.db.travel_id,)

    def fetchone(self):
        return self.next_row


class RecordingDb:
    def __init__(self, fail_on=None, fail_error=None):
        self.fail_on = fail_on
        self.fail_error = fail_error or RuntimeError('forced insert failure')
        self.travel_id = 123
        self.statements = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return RecordingCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class WizardSaveEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        with self.client.session_transaction() as sess:
            sess[app_module.AUTH_SESSION_KEY] = True

    def test_wizard_save_commits_travel_locations_and_participants(self):
        db = RecordingDb()

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.post('/api/travels/wizard', json=wizard_payload())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()['id'], 123)
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.rollbacks, 0)
        statements = [sql for sql, _ in db.statements]
        self.assertTrue(any(sql.startswith('INSERT INTO travels ') for sql in statements))
        self.assertTrue(any(sql.startswith('INSERT INTO travel_locations ') for sql in statements))
        self.assertTrue(any(sql.startswith('INSERT INTO travel_participants ') for sql in statements))

    def test_wizard_save_rolls_back_when_attachment_fails(self):
        db = RecordingDb(fail_on='INSERT INTO travel_participants')

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.post('/api/travels/wizard', json=wizard_payload())

        self.assertEqual(response.status_code, 500)
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)
        statements = [sql for sql, _ in db.statements]
        self.assertTrue(any(sql.startswith('INSERT INTO travels ') for sql in statements))
        self.assertTrue(any(sql.startswith('INSERT INTO travel_locations ') for sql in statements))
        self.assertTrue(any(sql.startswith('INSERT INTO travel_participants ') for sql in statements))

    def test_wizard_save_reports_missing_related_records_clearly(self):
        db = RecordingDb(
            fail_on='INSERT INTO travel_locations',
            fail_error=RuntimeError('violates foreign key constraint'),
        )

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.post('/api/travels/wizard', json=wizard_payload())

        self.assertEqual(response.status_code, 409)
        self.assertIn('miejsce lub uczestnik', response.get_json()['error'])
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)

    def test_wizard_save_rejects_out_of_range_visit_before_db_write(self):
        payload = wizard_payload(locations=[{
            'location_id': 10,
            'arrival_date': '2025-07-20',
            'departure_date': '2025-07-21',
            'notes': None,
        }])

        with patch.object(travels, 'get_db') as get_db:
            response = self.client.post('/api/travels/wizard', json=payload)

        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.get_json()['out_of_range'])
        get_db.assert_not_called()


if __name__ == '__main__':
    unittest.main()
