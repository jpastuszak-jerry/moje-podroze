import copy
from datetime import date, datetime, timezone
import unittest
from unittest.mock import patch

import app as app_module
import locations
import stats
import stats_hall_of_fame
import travels
from werkzeug.security import generate_password_hash


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


def _country_history_payload():
    return {
        'summary': {
            'countries': 2,
            'active_countries': 2,
            'returning_countries': 1,
            'single_visit_countries': 1,
            'avg_days_per_country': 8.0,
        },
        'countries': [
            {
                'id': 1,
                'name': 'Finland',
                'first_visit': '2022-07-01',
                'last_visit': '2025-07-28',
                'trips': 2,
                'days_spent': 11,
                'years_visited': 2,
                'period_trips': 1,
                'period_days': 5,
                'days_since_last_visit': 300,
                'longest_gap_days': 1100,
                'longest_gap_from': '2022-07-03',
                'longest_gap_to': '2025-07-18',
            },
            {
                'id': 2,
                'name': 'Estonia',
                'first_visit': '2025-07-22',
                'last_visit': '2025-07-28',
                'trips': 1,
                'days_spent': 5,
                'years_visited': 1,
                'period_trips': 1,
                'period_days': 5,
                'days_since_last_visit': 300,
                'longest_gap_days': 0,
                'longest_gap_from': None,
                'longest_gap_to': None,
            },
        ],
        'top_returns': [],
        'only_once': [],
        'longest_absences': [],
        'most_regular': [],
        'longest_gaps': [],
    }


def _hall_of_fame_payload():
    return {
        'longest': {'id': 1, 'name': 'Longest trip', 'value': 11},
        'priciest': {'id': 1, 'name': 'Priciest trip', 'value': 1000.0, 'currency': 'EUR'},
        'best_rated': {'id': 1, 'name': 'Best trip', 'value': 4.5},
        'most_places': {'id': 1, 'name': 'Most places', 'value': 7},
        'most_flights': {'id': 1, 'name': 'Most flights', 'value': 4},
        'most_countries': {'id': 1, 'name': 'Most countries', 'value': 3},
        'top_country': {'name': 'Finland', 'visits': 2, 'days': 5},
        'longest_gap': {'id': 2, 'name': 'After break', 'value': 120},
        'longest_streak': {'start_date': '2025-07-18', 'end_date': '2025-07-28', 'value': 11},
        'best_month': {'year': 2025, 'month': 7, 'value': 11},
    }


def _yearbook_payload():
    return [{
        'year': 2025,
        'trips': 1,
        'days': 11,
        'countries': 2,
        'top_month': {'month': 7, 'days': 11},
        'new_countries': [{'id': 1, 'name': 'Finland', 'first_visit': '2025-07-18', 'trips': 1}],
        'returning_countries': [],
        'highlights': {
            'longest': {'id': 1, 'name': 'Helsinki', 'days': 11},
            'best_rated': {'id': 1, 'name': 'Helsinki', 'rating': 4.5},
        },
        'trips_list': [{
            'id': 1,
            'name': 'Helsinki',
            'start_date': '2025-07-18',
            'end_date': '2025-07-28',
            'days': 11,
        }],
    }]


def fake_stats_query(sql, params=(), one=False):
    normalized = ' '.join(sql.split())
    if not one:
        if 'SELECT id, name, start_date, end_date, amount, currency, rating, number_of_flights' in normalized:
            return [
                {
                    'id': 1,
                    'name': 'Longest trip',
                    'start_date': date(2025, 7, 18),
                    'end_date': date(2025, 7, 28),
                    'amount': 1000.0,
                    'currency': 'EUR',
                    'rating': 4.5,
                    'number_of_flights': 4,
                },
                {
                    'id': 2,
                    'name': 'After break',
                    'start_date': date(2025, 11, 26),
                    'end_date': date(2025, 11, 28),
                    'amount': 200.0,
                    'currency': 'PLN',
                    'rating': 4.0,
                    'number_of_flights': 0,
                },
            ]
        if 'COUNT(DISTINCT tl.location_id) AS loc_count' in normalized:
            return [
                {'travel_id': 1, 'loc_count': 7, 'country_count': 3},
                {'travel_id': 2, 'loc_count': 1, 'country_count': 1},
            ]
        if 'SELECT c.name, tl.travel_id, tl.arrival_date, tl.departure_date' in normalized:
            return [
                {
                    'name': 'Finland',
                    'travel_id': 1,
                    'arrival_date': date(2025, 7, 18),
                    'departure_date': date(2025, 7, 22),
                },
                {
                    'name': 'Finland',
                    'travel_id': 2,
                    'arrival_date': date(2025, 11, 26),
                    'departure_date': date(2025, 11, 26),
                },
            ]
        if 'GROUP BY year ORDER BY year' in normalized:
            return [{'year': 2025, 'count': 1, 'days': 11}]
        raise AssertionError(f'Unexpected list query: {normalized}')

    if 'COUNT(*) AS cnt FROM locations' in normalized:
        return {'cnt': 4}
    if 'ORDER BY days DESC' in normalized and '(end_date - start_date + 1)' in normalized:
        return {'id': 1, 'name': 'Longest trip', 'days': 11}
    if 'SELECT id, name, amount, currency' in normalized:
        return {'id': 1, 'name': 'Priciest trip', 'amount': 1000.0, 'currency': 'EUR'}
    if 'SELECT id, name, rating' in normalized:
        return {'id': 1, 'name': 'Best trip', 'rating': 4.5}
    if 'COUNT(DISTINCT tl.location_id) AS loc_count' in normalized:
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


def fake_export_query(sql, params=(), one=False):
    if one:
        raise AssertionError('Export should not use scalar query')
    normalized = ' '.join(sql.split())
    rows = {
        'countries': [{'id': 1, 'name': 'Finland'}],
        'travels': [{'id': 7, 'name': 'Helsinki', 'amount': 1000, 'currency': 'EUR'}],
        'travel_participants': [{'travel_id': 7, 'person_id': 2}],
    }
    for table in app_module.EXPORT_TABLE_ORDERS:
        if f'FROM {table} ' in normalized:
            return rows.get(table, [])
    raise AssertionError(f'Unexpected export query: {normalized}')


def authenticate_client(client):
    with client.session_transaction() as sess:
        sess[app_module.AUTH_SESSION_KEY] = True


class AdminAuthSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        app_module._auth_failures.clear()

    def tearDown(self):
        app_module._auth_failures.clear()

    def test_private_api_requires_admin_session(self):
        response = self.client.get('/api/travels')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(response.get_json()['error'], 'unauthorized')

    def test_admin_login_status_and_logout_flow(self):
        with (
            patch.object(app_module, 'ADMIN_PASSWORD_HASH', generate_password_hash('secret')),
            patch.object(app_module, 'ADMIN_PASSWORD', None),
        ):
            wrong = self.client.post('/api/auth/login', json={'password': 'bad'})
            self.assertEqual(wrong.status_code, 401)

            login = self.client.post('/api/auth/login', json={'password': 'secret'})
            self.assertEqual(login.status_code, 200)
            self.assertEqual(login.get_json()['role'], 'admin')

            status = self.client.get('/api/auth/status')
            self.assertEqual(status.get_json()['authenticated'], True)
            self.assertEqual(status.get_json()['role'], 'admin')

            logout = self.client.post('/api/auth/logout')
            self.assertEqual(logout.status_code, 200)

            status_after_logout = self.client.get('/api/auth/status')
            self.assertEqual(status_after_logout.get_json()['authenticated'], False)

    def test_admin_login_rate_limit_blocks_repeated_bad_passwords(self):
        with (
            patch.object(app_module, 'ADMIN_PASSWORD_HASH', generate_password_hash('secret')),
            patch.object(app_module, 'ADMIN_PASSWORD', None),
            patch.object(app_module, 'AUTH_MAX_FAILED_ATTEMPTS', 2),
            patch.object(app_module, 'AUTH_LOCKOUT_SECONDS', 120),
        ):
            first_wrong = self.client.post('/api/auth/login', json={'password': 'bad'})
            self.assertEqual(first_wrong.status_code, 401)

            second_wrong = self.client.post('/api/auth/login', json={'password': 'still-bad'})
            self.assertEqual(second_wrong.status_code, 429)
            self.assertEqual(second_wrong.headers['Retry-After'], '120')
            self.assertEqual(second_wrong.get_json()['retry_after_seconds'], 120)

            correct_while_locked = self.client.post('/api/auth/login', json={'password': 'secret'})
            self.assertEqual(correct_while_locked.status_code, 429)

    def test_successful_admin_login_clears_previous_failures(self):
        with (
            patch.object(app_module, 'ADMIN_PASSWORD_HASH', generate_password_hash('secret')),
            patch.object(app_module, 'ADMIN_PASSWORD', None),
            patch.object(app_module, 'AUTH_MAX_FAILED_ATTEMPTS', 2),
            patch.object(app_module, 'AUTH_LOCKOUT_SECONDS', 120),
        ):
            first_wrong = self.client.post('/api/auth/login', json={'password': 'bad'})
            self.assertEqual(first_wrong.status_code, 401)

            login = self.client.post('/api/auth/login', json={'password': 'secret'})
            self.assertEqual(login.status_code, 200)

            logout = self.client.post('/api/auth/logout')
            self.assertEqual(logout.status_code, 200)

            wrong_after_success = self.client.post('/api/auth/login', json={'password': 'bad'})
            self.assertEqual(wrong_after_success.status_code, 401)

    def test_index_renders_login_until_session_is_authenticated(self):
        login_page = self.client.get('/')
        self.assertEqual(login_page.status_code, 200)
        self.assertIn('Logowanie administratora', login_page.get_data(as_text=True))

        authenticate_client(self.client)
        app_page = self.client.get('/')
        html = app_page.get_data(as_text=True)
        self.assertIn('id="tabs"', html)
        self.assertIn('id="app-menu"', html)
        self.assertIn('logoutAdmin()', html)


class ApiContractSmokeTests(unittest.TestCase):
    def setUp(self):
        stats.clear_stats_cache()
        self.client = app_module.app.test_client()
        authenticate_client(self.client)

    def test_export_contract_has_metadata_filename_and_no_store(self):
        now = datetime(2026, 5, 23, 7, 30, tzinfo=timezone.utc)
        with patch.object(app_module, 'query', side_effect=fake_export_query):
            payload = app_module.build_backup_payload(now)

        self.assertEqual(payload['schema_version'], app_module.BACKUP_SCHEMA_VERSION)
        self.assertEqual(payload['metadata']['exported_at'], '2026-05-23T07:30:00Z')
        self.assertEqual(payload['metadata']['export_date'], '2026-05-23')
        self.assertEqual(payload['metadata']['table_counts']['countries'], 1)
        self.assertEqual(payload['metadata']['table_counts']['travels'], 1)
        self.assertEqual(payload['metadata']['table_counts']['travel_participants'], 1)
        self.assertEqual(payload['metadata']['total_records'], 3)
        self.assertEqual(payload['tables']['travels'][0]['currency'], 'EUR')

        with patch.object(app_module, 'query', side_effect=fake_export_query):
            response = self.client.get('/api/export')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertIn('moje-podroze-backup-', response.headers['Content-Disposition'])
        data = response.get_json()
        self.assertLessEqual({'metadata', 'schema_version', 'tables'}, set(data))
        self.assertEqual(data['metadata']['total_records'], 3)

    def test_sensitive_endpoints_are_marked_no_store(self):
        with patch.object(travels, 'query', return_value=[]):
            travels_response = self.client.get('/api/travels')
        self.assertEqual(travels_response.headers['Cache-Control'], 'no-store')

        with patch.object(stats, '_data_quality', return_value=copy.deepcopy(_data_quality_payload())):
            todo_response = self.client.get('/api/stats/todo')
        self.assertEqual(todo_response.headers['Cache-Control'], 'no-store')

    def test_service_worker_receives_no_store_policy_from_backend(self):
        response = self.client.get('/sw.js')

        self.assertEqual(response.status_code, 200)
        source = response.get_data(as_text=True)
        self.assertIn('new Set(["/api/export", "/api/locations/todo", "/api/trash"])', source)
        self.assertIn('const NO_STORE_API_PREFIXES = ["/api/auth", "/api/stats", "/api/travels"]', source)
        self.assertNotIn('__NO_STORE_API_EXACT_PATHS__', source)
        self.assertNotIn('__NO_STORE_API_PREFIXES__', source)

    def test_stats_endpoint_contract(self):
        period = _period_payload()
        with (
            patch.object(stats, '_period_stats', side_effect=lambda year=None: copy.deepcopy(period)),
            patch.object(stats, '_period_overview', side_effect=lambda year=None: copy.deepcopy(period)),
            patch.object(stats, '_data_quality', return_value=copy.deepcopy(_data_quality_payload())),
            patch.object(stats, '_country_history', return_value=copy.deepcopy(_country_history_payload())),
            patch.object(stats, '_country_milestones', return_value={
                'new': [{'id': 1, 'name': 'Finland', 'first_visit': '2025-07-18', 'trips': 1}],
                'returning': [],
            }),
            patch.object(stats, '_hall_of_fame', return_value=copy.deepcopy(_hall_of_fame_payload())),
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
            patch.object(stats, '_yearbook', return_value=copy.deepcopy(_yearbook_payload())),
            patch.object(stats, 'query', side_effect=fake_stats_query),
        ):
            response = self.client.get('/api/stats?year=2025')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        data = response.get_json()
        expected_keys = {
            'total_trips', 'total_days', 'countries', 'visited_locations', 'flights',
            'albums', 'avg_rating', 'avg_trip_days', 'amount_by_currency', 'cost_summary',
            'purposes', 'participants', 'top_expensive', 'top_countries', 'top_places',
            'by_month', 'cost_per_day', 'progress', 'locations', 'by_year',
            'hall_of_fame', 'year', 'prev_period', 'current_trip', 'streak_months',
            'heatmap', 'data_quality', 'country_milestones', 'country_history', 'yearbook',
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
        self.assertEqual(data['yearbook'][0]['year'], 2025)
        self.assertLessEqual(
            {
                'year', 'trips', 'days', 'countries', 'top_month',
                'new_countries', 'returning_countries', 'highlights', 'trips_list',
            },
            set(data['yearbook'][0]),
        )
        self.assertLessEqual(
            {'currency', 'trip_count', 'days', 'total', 'avg_trip', 'median_trip', 'avg_per_day'},
            set(data['cost_summary'][0]),
        )
        self.assertEqual(data['cost_summary'][0]['currency'], 'EUR')
        self.assertLessEqual(
            {'name', 'amount', 'currency', 'start_date', 'end_date', 'days'},
            set(data['top_expensive'][0]),
        )
        self.assertLessEqual(
            {'name', 'amount', 'currency', 'days', 'cost_per_day'},
            set(data['cost_per_day'][0]),
        )
        self.assertLessEqual(
            {'id', 'name', 'relation_type', 'trips', 'days'},
            set(data['participants'][0]),
        )
        self.assertEqual(data['participants'][0]['name'], 'Anna')
        self.assertLessEqual({'country', 'visits', 'days_spent'}, set(data['top_countries'][0]))
        self.assertLessEqual(
            {
                'id', 'location_name', 'country', 'location_type',
                'lat', 'lon', 'visit_count', 'days_spent',
            },
            set(data['top_places'][0]),
        )
        self.assertLessEqual({'total', 'counts', 'labels', 'needs_attention'}, set(data['data_quality']))
        self.assertLessEqual(
            {
                'missing_cost', 'missing_rating', 'missing_locations',
                'missing_reflections', 'missing_album', 'incomplete_description',
            },
            set(data['data_quality']['counts']),
        )
        self.assertLessEqual({'new', 'returning'}, set(data['country_milestones']))
        self.assertLessEqual({'id', 'name', 'first_visit', 'trips'}, set(data['country_milestones']['new'][0]))
        self.assertEqual(data['country_history']['summary']['returning_countries'], 1)
        self.assertLessEqual(
            {
                'id', 'name', 'first_visit', 'last_visit', 'trips',
                'days_spent', 'years_visited', 'period_trips', 'period_days',
                'days_since_last_visit', 'longest_gap_days',
            },
            set(data['country_history']['countries'][0]),
        )

    def test_stats_overview_endpoint_contract_is_lightweight(self):
        period = _period_payload()

        def overview_payload(year=None, include_months=False):
            payload = copy.deepcopy(period)
            if include_months:
                payload['by_month'] = [{'month': 7, 'days': 11, 'count': 1}]
            return payload

        with (
            patch.object(stats, '_period_overview', side_effect=overview_payload),
            patch.object(stats, '_hall_of_fame', return_value=copy.deepcopy(_hall_of_fame_payload())),
            patch.object(stats, '_current_trip', return_value=None),
            patch.object(stats, '_streak_months', return_value=0),
            patch.object(stats, '_heatmap_data', return_value=[{'year': 2025, 'month': 7, 'days': 11}]),
            patch.object(stats, 'query', side_effect=fake_stats_query),
        ):
            response = self.client.get('/api/stats/overview?year=2025')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        data = response.get_json()
        expected_keys = {
            'total_trips', 'total_days', 'countries', 'visited_locations', 'flights',
            'albums', 'avg_rating', 'avg_trip_days', 'amount_by_currency', 'purposes',
            'progress', 'locations', 'by_year', 'hall_of_fame', 'year', 'prev_period',
            'current_trip', 'streak_months', 'by_month',
        }
        self.assertEqual(expected_keys, set(data))
        self.assertEqual(data['year'], 2025)
        self.assertEqual(data['locations'], 4)
        self.assertEqual(data['by_month'][0], {'month': 7, 'days': 11, 'count': 1})
        self.assertEqual(data['prev_period']['year'], 2024)
        self.assertNotIn('participants', data)
        self.assertNotIn('data_quality', data)
        self.assertNotIn('country_history', data)
        self.assertNotIn('yearbook', data)

    def test_period_overview_reuses_base_rows_without_detail_queries(self):
        captured = []

        def period_query(sql, params=(), one=False):
            normalized = ' '.join(sql.split())
            captured.append((normalized, one))
            if 'SELECT * FROM travels' in normalized:
                return [{
                    'id': 1,
                    'name': 'Helsinki',
                    'start_date': date(2025, 7, 18),
                    'end_date': date(2025, 7, 28),
                    'amount': 1100.0,
                    'currency': 'EUR',
                    'rating': 4.5,
                    'number_of_flights': 2,
                    'has_photo_album': True,
                    'purpose': 'Urlop',
                    'is_description_complete': True,
                }]
            if 'COUNT(DISTINCT c.id) AS countries' in normalized:
                return {'countries': 2, 'visited_locations': 4}
            raise AssertionError(f'Unexpected period query: {normalized}')

        with patch.object(stats, 'query', side_effect=period_query):
            overview = stats._period_overview(2025)

        self.assertEqual(len(captured), 2)
        self.assertEqual(overview['total_trips'], 1)
        self.assertEqual(overview['countries'], 2)
        self.assertEqual(overview['progress']['described'], 1)
        self.assertEqual(overview['top_expensive'][0]['name'], 'Helsinki')
        self.assertEqual(overview['cost_per_day'][0]['cost_per_day'], 100)

    def test_hall_of_fame_contract(self):
        with patch.object(stats_hall_of_fame, 'query', side_effect=fake_stats_query):
            hall_of_fame = stats_hall_of_fame._hall_of_fame()

        self.assertEqual(set(hall_of_fame), {
            'longest', 'priciest', 'best_rated', 'most_places', 'most_flights',
            'most_countries', 'top_country', 'longest_gap', 'longest_streak', 'best_month',
        })
        self.assertEqual(hall_of_fame['longest']['value'], 11)
        self.assertEqual(hall_of_fame['priciest']['currency'], 'EUR')
        self.assertEqual(hall_of_fame['top_country']['name'], 'Finland')
        self.assertEqual(hall_of_fame['longest_streak']['start_date'], '2025-07-18')
        self.assertEqual(hall_of_fame['best_month'], {'year': 2025, 'month': 7, 'value': 11})

    def test_hall_of_fame_queries_avoid_stale_or_duplicate_records(self):
        captured = []

        def capture_hof_query(sql, params=(), one=False):
            captured.append((' '.join(sql.split()), one))
            return fake_stats_query(sql, params, one)

        with patch.object(stats_hall_of_fame, 'query', side_effect=capture_hof_query):
            hall_of_fame = stats_hall_of_fame._hall_of_fame()

        self.assertEqual(len(captured), 3)
        self.assertTrue(all(one is False for _, one in captured))
        most_places_sql = next(sql for sql, _ in captured if 'AS loc_count' in sql)
        self.assertIn('COUNT(DISTINCT tl.location_id) AS loc_count', most_places_sql)
        self.assertIn('JOIN locations l ON l.id = tl.location_id', most_places_sql)
        self.assertIn('l.deleted_at IS NULL', most_places_sql)
        self.assertEqual(hall_of_fame['most_places']['value'], 7)
        self.assertEqual(hall_of_fame['longest_gap']['value'], 120)

    def test_stats_todo_endpoint_contract(self):
        payload = _data_quality_payload()
        with patch.object(stats, '_data_quality', return_value=copy.deepcopy(payload)):
            response = self.client.get('/api/stats/todo?year=2025')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
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
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
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

    def test_location_detail_contract_derives_last_visit_from_visit_dates(self):
        location_row = {
            'id': 1,
            'name': 'Helsinki',
            'country_id': 1,
            'location_type_id': 2,
            'parent_location_id': None,
            'country_name': 'Finland',
            'location_type': 'miasto',
            'address': '',
            'notes': None,
            'latitude': None,
            'longitude': None,
            'parent_name': None,
        }
        direct_visits = [{
            'id': 10,
            'travel_name': 'Finlandia',
            'start_date': None,
            'end_date': None,
            'arrival_date': date(2025, 7, 18),
            'departure_date': date(2025, 7, 21),
            'notes': None,
        }]
        child_visits = [{
            'id': 12,
            'travel_name': 'Uusimaa',
            'start_date': None,
            'end_date': None,
            'child_location_id': 4,
            'child_location_name': 'Espoo',
            'arrival_date': date(2025, 7, 22),
            'departure_date': date(2025, 7, 23),
        }]

        with patch.object(locations, 'query', side_effect=[location_row, direct_visits, child_visits]):
            response = self.client.get('/api/locations/1')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['visit_count'], 2)
        self.assertEqual(data['last_visit'], '2025-07-23')
        self.assertEqual(data['visits'][0]['arrival_date'], '2025-07-18')


if __name__ == '__main__':
    unittest.main()
