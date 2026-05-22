import copy
import unittest
from unittest.mock import patch

import app as app_module
import locations
import stats


def _period_payload():
    return {
        'total_trips': 1,
        'total_days': 11,
        'countries': 2,
        'visited_locations': 4,
        'flights': 2,
        'albums': 1,
        'avg_rating': 4.5,
        'avg_trip_days': 11.0,
        'amount_by_currency': {'EUR': 1000.0},
        'cost_summary': [{
            'currency': 'EUR',
            'trip_count': 1,
            'days': 11,
            'total': 1000.0,
            'avg_trip': 1000.0,
            'median_trip': 1000.0,
            'avg_per_day': 90.91,
        }],
        'purposes': [{'name': 'Vacation', 'count': 1}],
        'participants': [{'id': 1, 'name': 'Anna', 'relation_type': 'Family', 'trips': 1, 'days': 11}],
        'top_expensive': [{
            'name': 'Helsinki',
            'amount': 1000.0,
            'currency': 'EUR',
            'start_date': '2025-07-18',
            'end_date': '2025-07-28',
            'days': 11,
        }],
        'top_countries': [{'country': 'Finland', 'visits': 1, 'days_spent': 5}],
        'top_places': [{
            'id': 10,
            'location_name': 'Helsinki',
            'country': 'Finland',
            'location_type': 'miasto',
            'lat': 60.17,
            'lon': 24.94,
            'visit_count': 1,
            'days_spent': 5,
        }],
        'by_month': [{'month': 7, 'days': 11, 'count': 1}],
        'cost_per_day': [{
            'name': 'Helsinki',
            'amount': 1000.0,
            'currency': 'EUR',
            'days': 11,
            'cost_per_day': 91,
        }],
        'progress': {'total': 1, 'described': 1, 'with_album': 1},
    }


def _data_quality_payload():
    return {
        'total': 1,
        'counts': {
            'missing_cost': 0,
            'missing_rating': 1,
            'missing_locations': 0,
            'missing_reflections': 0,
            'missing_album': 0,
            'incomplete_description': 0,
        },
        'labels': {
            'missing_cost': 'brak kosztu',
            'missing_rating': 'brak oceny',
            'missing_locations': 'brak miejsc',
            'missing_reflections': 'brak wspomnien',
            'missing_album': 'brak albumu',
            'incomplete_description': 'opis niekompletny',
        },
        'needs_attention': [{
            'id': 1,
            'name': 'Helsinki',
            'start_date': '2025-07-18',
            'missing': ['brak oceny'],
            'missing_keys': ['missing_rating'],
            'missing_count': 1,
        }],
    }


def fake_stats_query(sql, params=(), one=False):
    normalized = ' '.join(sql.split())
    if not one:
        if 'GROUP BY year ORDER BY year' in normalized:
            return [{'year': 2025, 'count': 1, 'days': 11}]
        raise AssertionError(f'Unexpected list query: {normalized}')

    if 'COUNT(*) AS cnt FROM locations' in normalized:
        return {'cnt': 4}
    if 'ORDER BY days DESC LIMIT 1' in normalized and '(end_date - start_date + 1)' in normalized:
        return {'id': 1, 'name': 'Longest trip', 'days': 11}
    if 'SELECT id, name, amount, currency' in normalized:
        return {'id': 1, 'name': 'Priciest trip', 'amount': 1000.0, 'currency': 'EUR'}
    if 'SELECT id, name, rating' in normalized:
        return {'id': 1, 'name': 'Best trip', 'rating': 4.5}
    if 'COUNT(tl.id) AS loc_count' in normalized:
        return {'id': 1, 'name': 'Most places', 'loc_count': 7}
    if 'number_of_flights' in normalized:
        return {'id': 1, 'name': 'Most flights', 'number_of_flights': 4}
    if 'country_count' in normalized:
        return {'id': 1, 'name': 'Most countries', 'country_count': 3}
    if 'GROUP BY c.name' in normalized:
        return {'name': 'Finland', 'visits': 2, 'days': 5}
    if 'gap_days' in normalized:
        return {'id': 2, 'name': 'After break', 'gap_days': 120}
    if 'SELECT MIN(day) AS start_date' in normalized:
        return {'start_date': '2025-07-18', 'end_date': '2025-07-28', 'days': 11}
    if 'EXTRACT(MONTH FROM d)::int AS month' in normalized:
        return {'year': 2025, 'month': 7, 'days': 11}
    raise AssertionError(f'Unexpected scalar query: {normalized}')


class ApiContractSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_stats_endpoint_contract(self):
        period = _period_payload()
        with (
            patch.object(stats, '_period_stats', side_effect=lambda year=None: copy.deepcopy(period)),
            patch.object(stats, '_data_quality', return_value=copy.deepcopy(_data_quality_payload())),
            patch.object(stats, '_country_milestones', return_value={
                'new': [{'id': 1, 'name': 'Finland', 'first_visit': '2025-07-18', 'trips': 1}],
                'returning': [],
            }),
            patch.object(stats, '_current_trip', return_value={
                'id': 1,
                'name': 'Helsinki',
                'start_date': '2025-07-18',
                'end_date': '2025-07-28',
                'days_in': 2,
                'days_total': 11,
            }),
            patch.object(stats, '_streak_months', return_value=3),
            patch.object(stats, '_heatmap_data', return_value=[{'year': 2025, 'month': 7, 'days': 11}]),
            patch.object(stats, 'query', side_effect=fake_stats_query),
        ):
            response = self.client.get('/api/stats?year=2025')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        expected_keys = {
            'total_trips', 'total_days', 'countries', 'visited_locations', 'flights',
            'albums', 'avg_rating', 'avg_trip_days', 'amount_by_currency', 'cost_summary',
            'purposes', 'participants', 'top_expensive', 'top_countries', 'top_places',
            'by_month', 'cost_per_day', 'progress', 'locations', 'by_year',
            'hall_of_fame', 'year', 'prev_period', 'current_trip', 'streak_months',
            'heatmap', 'data_quality', 'country_milestones',
        }
        self.assertLessEqual(expected_keys, set(data))
        self.assertEqual(data['year'], 2025)
        self.assertEqual(data['locations'], 4)
        self.assertEqual(data['prev_period']['year'], 2024)
        self.assertEqual(data['prev_period']['progress_described'], 1)
        self.assertEqual(data['by_year'][0], {'year': 2025, 'count': 1, 'days': 11})
        self.assertEqual(set(data['hall_of_fame']), {
            'longest', 'priciest', 'best_rated', 'most_places', 'most_flights',
            'most_countries', 'top_country', 'longest_gap', 'longest_streak', 'best_month',
        })
        self.assertEqual(data['hall_of_fame']['longest']['value'], 11)
        self.assertEqual(data['hall_of_fame']['top_country']['name'], 'Finland')

    def test_stats_todo_endpoint_contract(self):
        payload = _data_quality_payload()
        with patch.object(stats, '_data_quality', return_value=copy.deepcopy(payload)):
            response = self.client.get('/api/stats/todo?year=2025')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['year'], 2025)
        self.assertLessEqual({'total', 'counts', 'labels', 'needs_attention'}, set(data))
        self.assertLessEqual({'id', 'name', 'missing', 'missing_keys', 'missing_count'}, set(data['needs_attention'][0]))
        self.assertEqual(data['counts']['missing_rating'], 1)

    def test_locations_todo_endpoint_contract(self):
        rows = [
            {
                'id': 1,
                'name': 'Helsinki',
                'country_name': 'Finland',
                'location_type': 'miasto',
                'address': '',
                'notes': None,
                'latitude': None,
                'longitude': None,
                'parent_location_id': None,
                'direct_visits': 0,
                'child_visits': 0,
            },
            {
                'id': 2,
                'name': 'Tallinn',
                'country_name': 'Estonia',
                'location_type': 'miasto',
                'address': 'Old town',
                'notes': 'Nice place',
                'latitude': 59.437,
                'longitude': 24.7536,
                'parent_location_id': None,
                'direct_visits': 1,
                'child_visits': 0,
            },
        ]

        with patch.object(locations, 'query', return_value=rows):
            response = self.client.get('/api/locations/todo')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total'], 2)
        self.assertLessEqual({'counts', 'labels', 'needs_attention'}, set(data))
        self.assertEqual(data['counts']['missing_gps'], 1)
        self.assertEqual(data['counts']['missing_address'], 1)
        self.assertEqual(data['counts']['missing_notes'], 1)
        self.assertEqual(data['counts']['not_visited'], 1)
        self.assertEqual(len(data['needs_attention']), 1)
        self.assertLessEqual(
            {
                'id', 'name', 'country_name', 'location_type',
                'missing', 'missing_keys', 'missing_count', 'visit_count',
            },
            set(data['needs_attention'][0]),
        )
        self.assertEqual(data['needs_attention'][0]['visit_count'], 0)


if __name__ == '__main__':
    unittest.main()
