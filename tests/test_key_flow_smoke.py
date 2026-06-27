from datetime import date, datetime
import unittest
from unittest.mock import patch

import app as app_module
import dicts
import locations
import travels


def authenticate_client(client):
    with client.session_transaction() as sess:
        sess[app_module.AUTH_SESSION_KEY] = True


TRAVEL_ROW = {
    'id': 7,
    'name': 'Helsinki',
    'start_date': date(2025, 7, 18),
    'end_date': date(2025, 7, 28),
    'purpose': 'Wakacje',
    'has_photo_album': True,
    'amount': 1000.0,
    'currency': 'EUR',
    'is_description_complete': True,
    'rating': 4.5,
    'reflections': 'Dobry wyjazd',
    'notes': 'Notatki',
    'number_of_flights': 2,
    'deleted_at': None,
}

TRAVEL_LOCATION_ROW = {
    'id': 70,
    'location_id': 10,
    'location_name': 'Helsinki',
    'country_name': 'Finlandia',
    'location_type': 'miasto',
    'arrival_date': date(2025, 7, 18),
    'departure_date': date(2025, 7, 21),
    'notes': 'Centrum',
}

TRAVEL_PARTICIPANT_ROW = {
    'id': 5,
    'name': 'Anna',
    'relation_type': 'Rodzina',
}

LOCATION_LIST_ROW = {
    'id': 10,
    'name': 'Helsinki',
    'country_name': 'Finlandia',
    'location_type': 'miasto',
    'address': 'Market Square',
    'notes': 'Stolica Finlandii',
    'latitude': 60.17,
    'longitude': 24.94,
    'parent_location_id': None,
    'parent_name': None,
    'visit_count': 2,
    'last_visit': date(2025, 7, 21),
}

MAP_LOCATION_ROW = {
    'id': 10,
    'name': 'Helsinki',
    'latitude': 60.17,
    'longitude': 24.94,
    'address': 'Market Square',
    'notes': 'Stolica Finlandii',
    'country_name': 'Finlandia',
    'location_type': 'miasto',
    'visit_count': 2,
    'first_visit': date(2025, 7, 18),
    'last_visit': date(2025, 7, 21),
    'travel_names': 'Helsinki',
}


def _normalize_sql(sql):
    return ' '.join(sql.split())


def fake_travels_query(sql, params=(), one=False):
    normalized = _normalize_sql(sql)
    if one and 'SELECT * FROM travels WHERE id=%s AND deleted_at IS NULL' in normalized:
        return dict(TRAVEL_ROW) if params == (7,) else None
    if 'SELECT * FROM travels WHERE deleted_at IS NULL' in normalized:
        return [dict(TRAVEL_ROW)]
    if 'FROM travel_locations tl JOIN locations l' in normalized:
        return [dict(TRAVEL_LOCATION_ROW)]
    if 'FROM travel_participants tp' in normalized:
        return [dict(TRAVEL_PARTICIPANT_ROW)]
    if one and 'SELECT start_date, end_date FROM travels WHERE id=%s' in normalized:
        return {'start_date': date(2025, 8, 1), 'end_date': date(2025, 8, 5)}
    raise AssertionError(f'Unexpected travels query: {normalized}')


def fake_locations_query(sql, params=(), one=False):
    normalized = _normalize_sql(sql)
    if not one and 'WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL' in normalized:
        return [dict(MAP_LOCATION_ROW)]
    if not one and 'location_visit_stats AS' in normalized and 'WHERE l.deleted_at IS NULL' in normalized:
        return [dict(LOCATION_LIST_ROW)]
    if one and 'WHERE LOWER(l.name) = LOWER(%s)' in normalized:
        return None
    raise AssertionError(f'Unexpected locations query: {normalized}')


def fake_dicts_query(sql, params=(), one=False):
    normalized = _normalize_sql(sql)
    if 'FROM countries' in normalized:
        return [{'id': 1, 'name': 'Finlandia'}]
    if 'FROM location_types' in normalized:
        return [{'id': 2, 'name': 'miasto'}]
    if 'FROM relation_types' in normalized:
        return [{'id': 3, 'name': 'Rodzina'}]
    if 'FROM persons p' in normalized:
        return [{'id': 5, 'name': 'Anna', 'relation_type_id': 3, 'relation_type': 'Rodzina'}]
    raise AssertionError(f'Unexpected dicts query: {normalized}')


def fake_app_query(sql, params=(), one=False):
    normalized = _normalize_sql(sql)
    if one and normalized == 'SELECT 1 AS ok':
        return {'ok': 1}
    if 'FROM travels WHERE deleted_at IS NOT NULL' in normalized:
        return [{
            'id': 11,
            'name': 'Old trip',
            'start_date': date(2024, 1, 1),
            'end_date': date(2024, 1, 3),
            'deleted_at': datetime(2025, 1, 10, 12, 0),
        }]
    if 'FROM locations l JOIN countries c' in normalized and 'WHERE l.deleted_at IS NOT NULL' in normalized:
        return [{
            'id': 12,
            'name': 'Old place',
            'country_name': 'Finlandia',
            'location_type': 'miasto',
            'deleted_at': datetime(2025, 1, 11, 12, 0),
        }]
    raise AssertionError(f'Unexpected app query: {normalized}')


class AuthGateKeyFlowSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_private_read_and_write_flows_require_admin_session(self):
        checks = [
            ('get', '/api/travels', None),
            ('post', '/api/travels', {}),
            ('get', '/api/travels/7', None),
            ('delete', '/api/travels/7', None),
            ('get', '/api/locations', None),
            ('post', '/api/locations', {}),
            ('get', '/api/location-inspirations', None),
            ('post', '/api/location-inspirations/10', {}),
            ('get', '/api/location-collections', None),
            ('post', '/api/location-collections', {}),
            ('get', '/api/map-locations', None),
            ('get', '/api/stats', None),
            ('get', '/api/stats/overview', None),
            ('get', '/api/stats/todo', None),
            ('get', '/api/locations/todo', None),
            ('get', '/api/trash', None),
            ('get', '/api/export', None),
            ('get', '/api/persons', None),
        ]

        for method, path, payload in checks:
            with self.subTest(method=method, path=path):
                call = getattr(self.client, method)
                response = call(path, json=payload) if payload is not None else call(path)

                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertEqual(response.get_json(), {'error': 'unauthorized'})


class KeyFlowSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        authenticate_client(self.client)

    def test_admin_can_load_core_read_flow(self):
        with (
            patch.object(app_module, 'static_asset_version', return_value='smoke'),
            patch.object(app_module, 'query', side_effect=fake_app_query),
            patch.object(travels, 'query', side_effect=fake_travels_query),
            patch.object(locations, 'query', side_effect=fake_locations_query),
            patch.object(dicts, 'query', side_effect=fake_dicts_query),
        ):
            shell = self.client.get('/')
            health = self.client.get('/healthz')
            travels_list = self.client.get('/api/travels')
            travels_search = self.client.get('/api/travels?q=hel')
            travel_detail = self.client.get('/api/travels/7')
            locations_list = self.client.get('/api/locations')
            countries = self.client.get('/api/countries')
            location_types = self.client.get('/api/location_types')
            relation_types = self.client.get('/api/relation_types')
            persons = self.client.get('/api/persons')
            trash = self.client.get('/api/trash')
            map_locations = self.client.get('/api/map-locations')

        self.assertEqual(shell.status_code, 200)
        self.assertIn('/static/js/travels.js?v=smoke', shell.get_data(as_text=True))
        self.assertIn('/static/js/stats_yearbook.js?v=smoke', shell.get_data(as_text=True))
        self.assertIn('id="app-menu"', shell.get_data(as_text=True))
        self.assertIn('logoutAdmin()', shell.get_data(as_text=True))

        self.assertEqual(health.status_code, 200)
        health_payload = health.get_json()
        self.assertEqual(health_payload['db'], 'ok')
        self.assertEqual(health_payload['status'], 'ok')
        self.assertLessEqual(
            {'app_version', 'source_revision', 'source_revision_short', 'source_revision_source'},
            set(health_payload['build']),
        )

        self.assertEqual(travels_list.status_code, 200)
        self.assertEqual(travels_list.headers['Cache-Control'], 'no-store')
        self.assertEqual(travels_list.get_json()[0]['start_date'], '2025-07-18')
        self.assertEqual(travels_search.get_json()[0]['name'], 'Helsinki')

        self.assertEqual(travel_detail.status_code, 200)
        detail = travel_detail.get_json()
        self.assertEqual(detail['name'], 'Helsinki')
        self.assertEqual(detail['locations'][0]['arrival_date'], '2025-07-18')
        self.assertEqual(detail['participants'][0]['name'], 'Anna')

        self.assertEqual(locations_list.status_code, 200)
        self.assertEqual(locations_list.headers['Cache-Control'], 'no-cache')
        self.assertIn('ETag', locations_list.headers)
        self.assertEqual(locations_list.get_json()[0]['visit_count'], 2)
        self.assertEqual(locations_list.get_json()[0]['last_visit'], '2025-07-21')

        for response in (countries, location_types, relation_types, persons):
            self.assertEqual(response.status_code, 200)
            self.assertIn('ETag', response.headers)
        self.assertEqual(countries.get_json()[0]['name'], 'Finlandia')
        self.assertEqual(location_types.get_json()[0]['name'], 'miasto')
        self.assertEqual(relation_types.get_json()[0]['name'], 'Rodzina')
        self.assertEqual(persons.get_json()[0]['relation_type'], 'Rodzina')

        self.assertEqual(trash.status_code, 200)
        self.assertEqual(trash.headers['Cache-Control'], 'no-store')
        self.assertTrue(trash.get_json()['travels'][0]['deleted_at'].startswith('2025-01-10'))
        self.assertEqual(trash.get_json()['locations'][0]['name'], 'Old place')

        self.assertEqual(map_locations.status_code, 200)
        self.assertEqual(map_locations.headers['Cache-Control'], 'no-cache')
        self.assertIn('ETag', map_locations.headers)
        self.assertEqual(map_locations.get_json()[0]['name'], 'Helsinki')
        self.assertEqual(map_locations.get_json()[0]['first_visit'], '2025-07-18')
        self.assertEqual(map_locations.get_json()[0]['visit_count'], 2)

    def test_admin_can_create_trip_location_and_attach_people(self):
        executed = []

        def fake_travels_execute(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('travels', normalized, params))
            if normalized.startswith('INSERT INTO travels '):
                return 101
            if normalized.startswith('INSERT INTO travel_locations '):
                return 201
            if normalized.startswith('INSERT INTO travel_participants '):
                return None
            raise AssertionError(f'Unexpected travel execute: {normalized}')

        def fake_locations_execute(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('locations', normalized, params))
            if normalized.startswith('INSERT INTO locations '):
                return 10
            raise AssertionError(f'Unexpected location execute: {normalized}')

        def fake_dicts_execute(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('dicts', normalized, params))
            if normalized.startswith('INSERT INTO persons '):
                return 5
            raise AssertionError(f'Unexpected dicts execute: {normalized}')

        travel_payload = {
            'name': 'Weekend',
            'start_date': '2025-08-01',
            'end_date': '2025-08-05',
            'purpose': 'City break',
            'has_photo_album': True,
            'amount': '123.45',
            'currency': 'EUR',
            'is_description_complete': True,
            'rating': 4.5,
            'reflections': 'Udany wyjazd',
            'notes': 'Plan minimum',
            'number_of_flights': 2,
        }
        location_payload = {
            'name': 'Helsinki',
            'country_id': 1,
            'location_type_id': 2,
            'address': 'Market Square',
            'notes': 'Centrum',
            'latitude': 60.17,
            'longitude': 24.94,
        }

        with (
            patch.object(travels, 'query', side_effect=fake_travels_query),
            patch.object(locations, 'query', side_effect=fake_locations_query),
            patch.object(travels, 'execute', side_effect=fake_travels_execute),
            patch.object(locations, 'execute', side_effect=fake_locations_execute),
            patch.object(dicts, 'execute', side_effect=fake_dicts_execute),
        ):
            travel = self.client.post('/api/travels', json=travel_payload)
            location = self.client.post('/api/locations', json=location_payload)
            person = self.client.post('/api/persons', json={'name': 'Anna', 'relation_type_id': 3})
            attached_location = self.client.post('/api/travels/101/locations', json={
                'location_id': 10,
                'arrival_date': '2025-08-01',
                'departure_date': '2025-08-03',
                'notes': 'Pierwszy etap',
            })
            attached_person = self.client.post('/api/travels/101/participants', json={'person_id': 5})

        self.assertEqual(travel.status_code, 201)
        self.assertEqual(travel.get_json()['id'], 101)
        self.assertEqual(location.status_code, 201)
        self.assertEqual(location.get_json(), {'id': 10, 'name': 'Helsinki'})
        self.assertEqual(person.status_code, 201)
        self.assertEqual(person.get_json(), {'id': 5, 'name': 'Anna'})
        self.assertEqual(attached_location.status_code, 201)
        self.assertEqual(attached_location.get_json()['id'], 201)
        self.assertEqual(attached_person.status_code, 201)
        self.assertEqual(attached_person.get_json(), {'ok': True})

        executed_sql = '\n'.join(sql for _, sql, _ in executed)
        self.assertIn('INSERT INTO travels', executed_sql)
        self.assertIn('INSERT INTO locations', executed_sql)
        self.assertIn('INSERT INTO persons', executed_sql)
        self.assertIn('INSERT INTO travel_locations', executed_sql)
        self.assertIn('INSERT INTO travel_participants', executed_sql)

    def test_admin_can_soft_delete_restore_and_detach_relations(self):
        executed = []

        def fake_travels_rowcount(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('travels_rowcount', normalized, params))
            if normalized.startswith('UPDATE travels SET deleted_at = NOW()'):
                return 1
            if normalized.startswith('UPDATE travels SET deleted_at = NULL'):
                return 1
            raise AssertionError(f'Unexpected travel rowcount execute: {normalized}')

        def fake_locations_rowcount(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('locations_rowcount', normalized, params))
            if normalized.startswith('UPDATE locations SET deleted_at = NOW()'):
                return 1
            if normalized.startswith('UPDATE locations SET deleted_at = NULL'):
                return 1
            raise AssertionError(f'Unexpected location rowcount execute: {normalized}')

        def fake_travels_execute(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('travels_execute', normalized, params))
            if normalized.startswith('DELETE FROM travel_locations'):
                return None
            if normalized.startswith('DELETE FROM travel_participants'):
                return None
            raise AssertionError(f'Unexpected travel execute: {normalized}')

        with (
            patch.object(travels, 'execute_rowcount', side_effect=fake_travels_rowcount),
            patch.object(locations, 'execute_rowcount', side_effect=fake_locations_rowcount),
            patch.object(travels, 'execute', side_effect=fake_travels_execute),
        ):
            deleted_travel = self.client.delete('/api/travels/101')
            restored_travel = self.client.post('/api/travels/101/restore')
            deleted_location = self.client.delete('/api/locations/10')
            restored_location = self.client.post('/api/locations/10/restore')
            detached_location = self.client.delete('/api/travels/101/locations/201')
            detached_participant = self.client.delete('/api/travels/101/participants/5')

        for response in (
            deleted_travel,
            restored_travel,
            deleted_location,
            restored_location,
            detached_location,
            detached_participant,
        ):
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['ok'], True)

        executed_sql = '\n'.join(sql for _, sql, _ in executed)
        self.assertIn('UPDATE travels SET deleted_at = NOW()', executed_sql)
        self.assertIn('UPDATE travels SET deleted_at = NULL', executed_sql)
        self.assertIn('UPDATE locations SET deleted_at = NOW()', executed_sql)
        self.assertIn('UPDATE locations SET deleted_at = NULL', executed_sql)
        self.assertIn('DELETE FROM travel_locations', executed_sql)
        self.assertIn('DELETE FROM travel_participants', executed_sql)

    def test_admin_can_manage_location_inspirations_and_collections(self):
        executed = []

        def fake_inspiration_query(sql, params=(), one=False):
            normalized = _normalize_sql(sql)
            if one and 'SELECT id FROM locations WHERE id=%s AND deleted_at IS NULL' in normalized:
                return {'id': params[0]} if params in ((10,),) else None
            if one and 'SELECT id FROM location_collections WHERE id=%s' in normalized:
                return {'id': params[0]} if params in ((22,),) else None
            if one and 'FROM location_collections WHERE id=%s' in normalized:
                return {
                    'id': 22,
                    'name': 'Wyspy',
                    'description': 'Miejsca nad woda',
                    'created_at': datetime(2025, 1, 1, 12, 0),
                    'updated_at': datetime(2025, 1, 1, 12, 0),
                }
            if not one and 'FROM location_inspirations li' in normalized:
                return [{
                    'location_id': 10,
                    'status': 'want',
                    'priority': 1,
                    'season': 'wiosna',
                    'inspiration_notes': 'Zobaczyc port',
                    'created_at': datetime(2025, 1, 1, 12, 0),
                    'updated_at': datetime(2025, 1, 2, 12, 0),
                    'id': 10,
                    'name': 'Helsinki',
                    'country_name': 'Finlandia',
                    'location_type': 'miasto',
                    'address': 'Market Square',
                    'location_notes': 'Stolica Finlandii',
                    'latitude': 60.17,
                    'longitude': 24.94,
                    'parent_location_id': None,
                    'parent_name': None,
                    'visit_count': 0,
                    'collection_count': 1,
                    'collection_names': 'Wyspy',
                }]
            if not one and 'FROM location_collections lc' in normalized:
                return [{
                    'id': 22,
                    'name': 'Wyspy',
                    'description': 'Miejsca nad woda',
                    'created_at': datetime(2025, 1, 1, 12, 0),
                    'updated_at': datetime(2025, 1, 1, 12, 0),
                    'item_count': 1,
                    'visited_count': 0,
                    'inspiration_count': 1,
                }]
            if not one and 'FROM location_collection_items lci' in normalized:
                return [{
                    'location_id': 10,
                    'note': None,
                    'sort_order': 1,
                    'id': 10,
                    'name': 'Helsinki',
                    'country_name': 'Finlandia',
                    'location_type': 'miasto',
                    'address': 'Market Square',
                    'latitude': 60.17,
                    'longitude': 24.94,
                    'parent_location_id': None,
                    'parent_name': None,
                    'visit_count': 0,
                    'inspiration_status': 'want',
                    'inspiration_priority': 1,
                }]
            raise AssertionError(f'Unexpected inspiration query: {normalized}')

        def fake_inspiration_execute(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('execute', normalized, params))
            if normalized.startswith('INSERT INTO location_inspirations '):
                return params[0]
            if normalized.startswith('INSERT INTO location_collections '):
                return 22
            if normalized.startswith('INSERT INTO location_collection_items '):
                return params[1]
            raise AssertionError(f'Unexpected inspiration execute: {normalized}')

        def fake_inspiration_rowcount(sql, params=()):
            normalized = _normalize_sql(sql)
            executed.append(('rowcount', normalized, params))
            if normalized.startswith('DELETE FROM location_inspirations'):
                return 1
            if normalized.startswith('DELETE FROM location_collection_items'):
                return 1
            if normalized.startswith('DELETE FROM location_collections'):
                return 1
            raise AssertionError(f'Unexpected inspiration rowcount: {normalized}')

        with (
            patch.object(locations, 'query', side_effect=fake_inspiration_query),
            patch.object(locations, 'execute', side_effect=fake_inspiration_execute),
            patch.object(locations, 'execute_rowcount', side_effect=fake_inspiration_rowcount),
        ):
            upsert = self.client.post('/api/location-inspirations/10', json={
                'status': 'want',
                'priority': 1,
                'season': 'wiosna',
                'notes': 'Zobaczyc port',
            })
            inspirations = self.client.get('/api/location-inspirations')
            collection = self.client.post('/api/location-collections', json={
                'name': 'Wyspy',
                'description': 'Miejsca nad woda',
            })
            collections = self.client.get('/api/location-collections')
            detail = self.client.get('/api/location-collections/22')
            add_item = self.client.post('/api/location-collections/22/locations', json={'location_id': 10})
            remove_item = self.client.delete('/api/location-collections/22/locations/10')
            delete_collection = self.client.delete('/api/location-collections/22')
            delete_inspiration = self.client.delete('/api/location-inspirations/10')

        self.assertEqual(upsert.status_code, 200)
        self.assertEqual(upsert.get_json(), {'ok': True, 'location_id': 10})
        self.assertEqual(inspirations.status_code, 200)
        self.assertEqual(inspirations.get_json()['items'][0]['name'], 'Helsinki')
        self.assertEqual(inspirations.get_json()['counts']['want'], 1)
        self.assertEqual(collection.status_code, 201)
        self.assertEqual(collection.get_json(), {'id': 22, 'name': 'Wyspy'})
        self.assertEqual(collections.status_code, 200)
        self.assertEqual(collections.get_json()['collections'][0]['item_count'], 1)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json()['items'][0]['name'], 'Helsinki')
        self.assertEqual(add_item.status_code, 201)
        self.assertEqual(remove_item.status_code, 200)
        self.assertEqual(delete_collection.status_code, 200)
        self.assertEqual(delete_inspiration.status_code, 200)

        executed_sql = '\n'.join(sql for _, sql, _ in executed)
        self.assertIn('INSERT INTO location_inspirations', executed_sql)
        self.assertIn('INSERT INTO location_collections', executed_sql)
        self.assertIn('INSERT INTO location_collection_items', executed_sql)
        self.assertIn('DELETE FROM location_inspirations', executed_sql)


if __name__ == '__main__':
    unittest.main()
