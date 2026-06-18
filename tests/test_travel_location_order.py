from datetime import date
import unittest
from unittest.mock import patch

import app as app_module
import travels


class OrderCursor:
    def __init__(self, db):
        self.db = db
        self.rows = []
        self.rowcount = -1

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=()):
        normalized = ' '.join(sql.split())
        self.db.statements.append((normalized, params))
        if normalized.startswith('SELECT tl.id, tl.arrival_date'):
            self.rows = list(self.db.selected_rows)
            self.rowcount = len(self.rows)
        elif normalized.startswith('SELECT tl.id FROM travel_locations'):
            self.rows = [(visit_id,) for visit_id in self.db.day_ids]
            self.rowcount = len(self.rows)
        elif normalized.startswith('UPDATE travel_locations tl'):
            self.rows = []
            self.rowcount = self.db.updated_rows

    def fetchall(self):
        return self.rows


class OrderDb:
    def __init__(self, selected_rows, day_ids, updated_rows=None):
        self.selected_rows = selected_rows
        self.day_ids = day_ids
        self.updated_rows = updated_rows if updated_rows is not None else len(day_ids)
        self.statements = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return OrderCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class TravelLocationOrderTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        with self.client.session_transaction() as sess:
            sess[app_module.AUTH_SESSION_KEY] = True

    def test_reorder_saves_full_order_for_one_day(self):
        visit_day = date(2025, 7, 18)
        db = OrderDb(
            selected_rows=[(11, visit_day), (12, visit_day), (13, visit_day)],
            day_ids=[11, 12, 13],
        )

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.put(
                '/api/travels/7/locations/order',
                json={'visit_ids': [12, 11, 13]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['visit_ids'], [12, 11, 13])
        self.assertEqual(response.get_json()['arrival_date'], '2025-07-18')
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.rollbacks, 0)
        update_sql, update_params = db.statements[-1]
        self.assertIn('FROM unnest(%s::int[], %s::int[])', update_sql)
        self.assertEqual(update_params, ([12, 11, 13], [1, 2, 3], 7))

    def test_new_visit_is_appended_to_its_day(self):
        with (
            patch.object(travels, '_visit_out_of_travel_range', return_value=None),
            patch.object(travels, 'execute', return_value=55) as execute,
        ):
            response = self.client.post('/api/travels/7/locations', json={
                'location_id': 9,
                'arrival_date': '2025-07-18',
                'departure_date': '2025-07-18',
                'notes': 'New stop',
            })

        self.assertEqual(response.status_code, 201)
        sql, params = execute.call_args.args
        self.assertIn('COALESCE(MAX(visit_order), 0) + 1', sql)
        self.assertIn('arrival_date IS NOT DISTINCT FROM %s', sql)
        self.assertEqual(
            params,
            (7, 9, date(2025, 7, 18), date(2025, 7, 18), 'New stop', 7, date(2025, 7, 18)),
        )

    def test_changing_visit_day_moves_it_to_the_end_of_the_new_day(self):
        with (
            patch.object(travels, '_visit_out_of_travel_range', return_value=None),
            patch.object(travels, 'execute', return_value=4) as execute,
        ):
            response = self.client.put('/api/travels/7/locations/11', json={
                'arrival_date': '2025-07-19',
                'departure_date': '2025-07-19',
                'notes': 'Moved stop',
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['visit_order'], 4)
        sql, params = execute.call_args.args
        self.assertIn('WHEN tl.arrival_date IS DISTINCT FROM %s', sql)
        self.assertIn('COALESCE(MAX(other.visit_order), 0) + 1', sql)
        self.assertIn('RETURNING visit_order', sql)
        self.assertEqual(params[-2:], (11, 7))

    def test_reorder_rejects_visits_from_different_days(self):
        db = OrderDb(
            selected_rows=[
                (11, date(2025, 7, 18)),
                (12, date(2025, 7, 19)),
            ],
            day_ids=[11, 12],
        )

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.put(
                '/api/travels/7/locations/order',
                json={'visit_ids': [12, 11]},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn('jednego dnia', response.get_json()['error'])
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)

    def test_reorder_requires_every_visit_from_the_day(self):
        visit_day = date(2025, 7, 18)
        db = OrderDb(
            selected_rows=[(11, visit_day), (12, visit_day)],
            day_ids=[11, 12, 13],
        )

        with patch.object(travels, 'get_db', return_value=db):
            response = self.client.put(
                '/api/travels/7/locations/order',
                json={'visit_ids': [12, 11]},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn('pełną kolejność', response.get_json()['error'])
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)

    def test_reorder_rejects_duplicate_ids_before_database_access(self):
        with patch.object(travels, 'get_db') as get_db:
            response = self.client.put(
                '/api/travels/7/locations/order',
                json={'visit_ids': [11, 11]},
            )

        self.assertEqual(response.status_code, 400)
        get_db.assert_not_called()


if __name__ == '__main__':
    unittest.main()
