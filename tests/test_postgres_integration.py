import os
import unittest
from uuid import uuid4

import psycopg2
from flask import g
from psycopg2 import sql


TEST_DATABASE_URL = (os.environ.get('TEST_DATABASE_URL') or '').strip()


def _set_search_path(conn, schema):
    with conn.cursor() as cur:
        cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))


def _drop_schema(database_url, schema):
    with psycopg2.connect(database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema)))


def _create_schema(database_url, schema):
    with psycopg2.connect(database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))


def _create_tables(conn):
    statements = (
        """
        CREATE TABLE countries (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )
        """,
        """
        CREATE TABLE location_types (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )
        """,
        """
        CREATE TABLE relation_types (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )
        """,
        """
        CREATE TABLE persons (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            relation_type_id INTEGER REFERENCES relation_types(id)
        )
        """,
        """
        CREATE TABLE locations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            country_id INTEGER NOT NULL REFERENCES countries(id),
            location_type_id INTEGER NOT NULL REFERENCES location_types(id),
            parent_location_id INTEGER REFERENCES locations(id),
            address TEXT,
            notes TEXT,
            latitude NUMERIC(8,5),
            longitude NUMERIC(8,5),
            deleted_at TIMESTAMP
        )
        """,
        """
        CREATE TABLE travels (
            id SERIAL PRIMARY KEY,
            name TEXT,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            purpose TEXT,
            has_photo_album BOOLEAN DEFAULT FALSE,
            amount NUMERIC(12,2),
            currency TEXT DEFAULT 'PLN',
            is_description_complete BOOLEAN DEFAULT FALSE,
            rating NUMERIC(2,1),
            reflections TEXT,
            notes TEXT,
            number_of_flights INTEGER DEFAULT 0,
            deleted_at TIMESTAMP
        )
        """,
        """
        CREATE TABLE travel_locations (
            id SERIAL PRIMARY KEY,
            travel_id INTEGER NOT NULL REFERENCES travels(id),
            location_id INTEGER NOT NULL REFERENCES locations(id),
            arrival_date DATE,
            departure_date DATE,
            notes TEXT,
            visit_order INTEGER NOT NULL DEFAULT 0
        )
        """,
        """
        CREATE TABLE travel_participants (
            travel_id INTEGER NOT NULL REFERENCES travels(id),
            person_id INTEGER NOT NULL REFERENCES persons(id),
            PRIMARY KEY (travel_id, person_id)
        )
        """,
    )
    with conn.cursor() as cur:
        for statement in statements:
            cur.execute(statement)
    conn.commit()


def _seed_fixture(conn):
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO countries (id, name) VALUES (%s, %s)",
            [(1, 'Finland'), (2, 'Estonia')],
        )
        cur.executemany(
            "INSERT INTO location_types (id, name) VALUES (%s, %s)",
            [(1, 'miasto'), (2, 'wyspa')],
        )
        cur.execute("INSERT INTO relation_types (id, name) VALUES (1, 'Rodzina')")
        cur.execute("INSERT INTO persons (id, name, relation_type_id) VALUES (1, 'Anna', 1)")
        cur.executemany(
            """
            INSERT INTO locations
                (id, name, country_id, location_type_id, parent_location_id,
                 address, notes, latitude, longitude, deleted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (1, 'Helsinki', 1, 1, None, 'Market Square', 'Capital base', 60.17000, 24.94000, None),
                (2, 'Suomenlinna', 1, 2, 1, 'Sea fortress', 'Island child', 60.14500, 24.98800, None),
                (3, 'Tallinn', 2, 1, None, 'Old Town', 'Estonia stop', 59.43700, 24.75300, None),
                (4, 'Archived Pier', 1, 2, None, 'Old pier', 'Soft deleted location', 60.00000, 24.00000, '2025-01-01 12:00:00'),
            ],
        )
        cur.executemany(
            """
            INSERT INTO travels
                (id, name, start_date, end_date, purpose, has_photo_album,
                 amount, currency, is_description_complete, rating,
                 reflections, notes, number_of_flights, deleted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    1, 'Nordic loop', '2025-07-18', '2025-07-23', 'Vacation', True,
                    1000.00, 'EUR', True, 4.5, 'Good light', 'Main fixture trip', 2, None,
                ),
                (
                    2, 'Island return', '2025-08-01', '2025-08-02', 'Weekend', False,
                    100.00, 'EUR', False, 4.0, '', 'Second fixture trip', 0, None,
                ),
                (
                    3, 'Archived trip', '2024-01-01', '2024-01-02', 'Archive', False,
                    0.00, 'PLN', False, None, None, None, 0, '2025-01-02 12:00:00',
                ),
            ],
        )
        cur.executemany(
            """
            INSERT INTO travel_locations
                (id, travel_id, location_id, arrival_date, departure_date, notes, visit_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (1, 1, 1, '2025-07-18', '2025-07-20', 'Direct parent visit', 1),
                (2, 1, 2, '2025-07-21', '2025-07-21', 'Child visit', 1),
                (3, 1, 3, '2025-07-22', '2025-07-23', 'Second country', 1),
                (4, 2, 2, '2025-08-01', '2025-08-02', 'Return through child', 1),
                (5, 3, 1, '2024-01-01', '2024-01-02', 'Deleted travel is ignored', 1),
            ],
        )
        cur.executemany(
            "INSERT INTO travel_participants (travel_id, person_id) VALUES (%s, %s)",
            [(1, 1), (2, 1), (3, 1)],
        )
        serial_tables = (
            'countries',
            'location_types',
            'relation_types',
            'persons',
            'locations',
            'travels',
            'travel_locations',
        )
        for table in serial_tables:
            cur.execute(
                sql.SQL("""
                    SELECT setval(
                        pg_get_serial_sequence(%s, 'id'),
                        COALESCE((SELECT MAX(id) FROM {}), 1)
                    )
                """).format(sql.Identifier(table)),
                (table,),
            )
    conn.commit()


@unittest.skipUnless(TEST_DATABASE_URL, 'set TEST_DATABASE_URL to run PostgreSQL integration tests')
class PostgresIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = f"mp_it_{uuid4().hex}"
        cls.database_url = TEST_DATABASE_URL
        cls.core = None
        cls.stats = None
        cls.travels = None
        cls._original_database_url = None
        cls._original_pool = None
        cls._original_write_version = None
        cls._original_get_db = None
        cls._original_ensure_schema = None
        cls._original_travels_get_db = None

        _create_schema(cls.database_url, cls.schema)
        try:
            with psycopg2.connect(cls.database_url) as conn:
                _set_search_path(conn, cls.schema)
                _create_tables(conn)
                _seed_fixture(conn)

            import core

            cls.core = core
            cls._original_database_url = core.DATABASE_URL
            cls._original_pool = core._db_pool
            cls._original_write_version = core._db_write_version
            cls._original_get_db = core.get_db
            cls._original_ensure_schema = core.ensure_schema
            core.DATABASE_URL = cls.database_url
            core._db_pool = None
            core._db_write_version = 0
            core.ensure_schema = lambda: None

            def get_schema_db():
                if 'db' not in g:
                    g.db = core.get_db_pool().getconn()
                    g.db_from_pool = True
                    g.db.autocommit = False
                    _set_search_path(g.db, cls.schema)
                return g.db

            core.get_db = get_schema_db

            import app as app_module
            import stats
            import travels

            cls.app_module = app_module
            cls.stats = stats
            cls.travels = travels
            cls._original_travels_get_db = travels.get_db
            travels.get_db = get_schema_db
            stats.clear_stats_cache()
        except Exception:
            _drop_schema(cls.database_url, cls.schema)
            raise

    @classmethod
    def tearDownClass(cls):
        if cls.core is not None:
            integration_pool = cls.core._db_pool
            if integration_pool is not None and integration_pool is not cls._original_pool:
                integration_pool.closeall()
            cls.core._db_pool = cls._original_pool
            cls.core.DATABASE_URL = cls._original_database_url
            cls.core._db_write_version = cls._original_write_version
            cls.core.get_db = cls._original_get_db
            cls.core.ensure_schema = cls._original_ensure_schema
        if cls.travels is not None:
            cls.travels.get_db = cls._original_travels_get_db
        if cls.stats is not None:
            cls.stats.clear_stats_cache()
        _drop_schema(cls.database_url, cls.schema)

    def setUp(self):
        self.stats.clear_stats_cache()
        self.client = self.app_module.app.test_client()
        with self.client.session_transaction() as session:
            session[self.app_module.AUTH_SESSION_KEY] = True

    def _travel_payload(self, **overrides):
        payload = {
            'name': 'Fixture save flow',
            'start_date': '2025-09-01',
            'end_date': '2025-09-05',
            'purpose': 'Test',
            'has_photo_album': False,
            'amount': '250.00',
            'currency': 'EUR',
            'is_description_complete': True,
            'rating': 4.5,
            'reflections': 'Saved through integration smoke',
            'notes': 'Temporary test trip',
            'number_of_flights': 0,
        }
        payload.update(overrides)
        return payload

    def _hard_delete_travel(self, travel_id):
        response = self.client.delete(f'/api/travels/{travel_id}?hard=1')
        self.assertEqual(response.status_code, 200)

    def _location_payload(self, **overrides):
        payload = {
            'name': 'Fixture location flow',
            'country_id': 1,
            'location_type_id': 2,
            'parent_location_id': None,
            'address': 'Temporary integration address',
            'notes': 'Temporary integration notes',
            'latitude': 61.10000,
            'longitude': 25.10000,
        }
        payload.update(overrides)
        return payload

    def _hard_delete_location(self, location_id):
        response = self.client.delete(f'/api/locations/{location_id}?hard=1')
        self.assertEqual(response.status_code, 200)

    def test_locations_and_map_aggregate_parent_child_visits(self):
        response = self.client.get('/api/locations')

        self.assertEqual(response.status_code, 200)
        locations_by_name = {item['name']: item for item in response.get_json()}
        self.assertNotIn('Archived Pier', locations_by_name)
        self.assertEqual(locations_by_name['Helsinki']['visit_count'], 2)
        self.assertEqual(locations_by_name['Helsinki']['last_visit'], '2025-08-02')
        self.assertEqual(locations_by_name['Tallinn']['visit_count'], 1)
        self.assertEqual(locations_by_name['Tallinn']['last_visit'], '2025-07-23')

        map_response = self.client.get('/api/map-locations')

        self.assertEqual(map_response.status_code, 200)
        map_locations = {item['name']: item for item in map_response.get_json()}
        self.assertNotIn('Archived Pier', map_locations)
        helsinki = map_locations['Helsinki']
        self.assertEqual(helsinki['visit_count'], 2)
        self.assertEqual(helsinki['first_visit'], '2025-07-18')
        self.assertEqual(helsinki['last_visit'], '2025-08-02')
        self.assertEqual(helsinki['travel_names'], 'Island return, Nordic loop')

    def test_location_detail_includes_child_visits(self):
        response = self.client.get('/api/locations/1')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['name'], 'Helsinki')
        self.assertEqual(data['visit_count'], 2)
        self.assertEqual(data['direct_visit_count'], 1)
        self.assertEqual(data['child_visit_count'], 2)
        self.assertEqual(data['child_location_count'], 1)
        self.assertEqual(data['first_visit'], '2025-07-18')
        self.assertEqual(data['last_visit'], '2025-08-02')
        self.assertEqual([visit['travel_name'] for visit in data['visits']], ['Nordic loop'])
        self.assertEqual(
            [visit['travel_name'] for visit in data['child_visits']],
            ['Nordic loop', 'Island return'],
        )
        self.assertEqual(data['children'][0]['name'], 'Suomenlinna')
        self.assertEqual(data['children'][0]['visit_count'], 2)
        self.assertEqual(data['quality']['complete'], True)

    def test_stats_use_real_postgres_fixture(self):
        response = self.client.get('/api/stats?year=2025')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total_trips'], 2)
        self.assertEqual(data['total_days'], 8)
        self.assertEqual(data['countries'], 2)
        self.assertEqual(data['visited_locations'], 3)
        self.assertEqual(data['participants'][0]['name'], 'Anna')
        self.assertEqual(data['participants'][0]['trips'], 2)
        self.assertEqual(data['participants'][0]['days'], 8)
        self.assertEqual(
            [(row['month'], row['days'], row['count']) for row in data['by_month']],
            [(7, 6, 1), (8, 2, 1)],
        )
        self.assertEqual(data['top_places'][0]['location_name'], 'Helsinki')
        self.assertEqual(data['top_places'][0]['visit_count'], 2)
        self.assertEqual(data['country_history']['summary']['active_countries'], 2)
        self.assertEqual(data['country_history']['summary']['returning_countries'], 1)
        self.assertEqual(data['yearbook'][0]['year'], 2025)

    def test_trash_soft_delete_and_restore_round_trip(self):
        initial_trash = self.client.get('/api/trash')

        self.assertEqual(initial_trash.status_code, 200)
        initial_data = initial_trash.get_json()
        self.assertEqual([item['name'] for item in initial_data['travels']], ['Archived trip'])
        self.assertEqual([item['name'] for item in initial_data['locations']], ['Archived Pier'])

        delete_response = self.client.delete('/api/travels/2')
        self.assertEqual(delete_response.status_code, 200)
        try:
            trash_after_delete = self.client.get('/api/trash')
            self.assertEqual(trash_after_delete.status_code, 200)
            deleted_names = [item['name'] for item in trash_after_delete.get_json()['travels']]
            self.assertIn('Island return', deleted_names)
            self.assertIn('Archived trip', deleted_names)
        finally:
            restore_response = self.client.post('/api/travels/2/restore')
            self.assertEqual(restore_response.status_code, 200)

    def test_wizard_creates_travel_with_locations_and_participants(self):
        response = self.client.post('/api/travels/wizard', json={
            'travel': self._travel_payload(
                name='Wizard integration trip',
                start_date='2025-09-10',
                end_date='2025-09-12',
                number_of_flights=2,
            ),
            'locations': [
                {
                    'location_id': 1,
                    'arrival_date': '2025-09-10',
                    'departure_date': '2025-09-11',
                    'notes': 'Wizard parent location',
                },
                {
                    'location_id': 3,
                    'arrival_date': '2025-09-12',
                    'departure_date': '2025-09-12',
                    'notes': 'Wizard second country',
                },
            ],
            'participants': [{'person_id': 1}],
        })

        self.assertEqual(response.status_code, 201)
        created = response.get_json()
        travel_id = created['id']
        try:
            self.assertEqual(created['locations'], 2)
            self.assertEqual(created['participants'], 1)

            detail = self.client.get(f'/api/travels/{travel_id}')
            self.assertEqual(detail.status_code, 200)
            data = detail.get_json()
            self.assertEqual(data['name'], 'Wizard integration trip')
            self.assertEqual(data['start_date'], '2025-09-10')
            self.assertEqual(data['end_date'], '2025-09-12')
            self.assertEqual(data['number_of_flights'], 2)
            self.assertEqual(
                [(loc['location_name'], loc['arrival_date'], loc['departure_date']) for loc in data['locations']],
                [('Helsinki', '2025-09-10', '2025-09-11'), ('Tallinn', '2025-09-12', '2025-09-12')],
            )
            self.assertEqual(data['participants'], [{'id': 1, 'name': 'Anna', 'relation_type': 'Rodzina'}])
        finally:
            self._hard_delete_travel(travel_id)

    def test_same_day_travel_locations_can_be_reordered(self):
        create_response = self.client.post(
            '/api/travels',
            json=self._travel_payload(name='Ordered route integration trip'),
        )
        self.assertEqual(create_response.status_code, 201)
        travel_id = create_response.get_json()['id']
        try:
            first = self.client.post(f'/api/travels/{travel_id}/locations', json={
                'location_id': 1,
                'arrival_date': '2025-09-02',
                'departure_date': '2025-09-02',
                'notes': 'First stop',
            })
            second = self.client.post(f'/api/travels/{travel_id}/locations', json={
                'location_id': 3,
                'arrival_date': '2025-09-02',
                'departure_date': '2025-09-02',
                'notes': 'Second stop',
            })
            self.assertEqual(first.status_code, 201)
            self.assertEqual(second.status_code, 201)

            first_id = first.get_json()['id']
            second_id = second.get_json()['id']
            reordered = self.client.put(
                f'/api/travels/{travel_id}/locations/order',
                json={'visit_ids': [second_id, first_id]},
            )
            self.assertEqual(reordered.status_code, 200)

            detail = self.client.get(f'/api/travels/{travel_id}')
            self.assertEqual(detail.status_code, 200)
            locations = detail.get_json()['locations']
            self.assertEqual(
                [(location['location_name'], location['visit_order']) for location in locations],
                [('Tallinn', 1), ('Helsinki', 2)],
            )
        finally:
            self._hard_delete_travel(travel_id)

    def test_travel_edit_conflict_and_clip_updates_visit_dates(self):
        create_response = self.client.post('/api/travels', json=self._travel_payload(name='Editable integration trip'))

        self.assertEqual(create_response.status_code, 201)
        travel_id = create_response.get_json()['id']
        try:
            location_response = self.client.post(f'/api/travels/{travel_id}/locations', json={
                'location_id': 1,
                'arrival_date': '2025-09-01',
                'departure_date': '2025-09-05',
                'notes': 'Needs clipping',
            })
            self.assertEqual(location_response.status_code, 201)

            narrower_payload = self._travel_payload(
                name='Editable integration trip',
                start_date='2025-09-02',
                end_date='2025-09-04',
                amount='275.50',
                rating=5.0,
                number_of_flights=1,
            )
            conflict = self.client.put(f'/api/travels/{travel_id}', json=narrower_payload)
            self.assertEqual(conflict.status_code, 409)
            self.assertEqual(conflict.get_json()['conflict'], True)

            clipped = self.client.put(
                f'/api/travels/{travel_id}',
                json={**narrower_payload, 'on_conflict': 'clip'},
            )
            self.assertEqual(clipped.status_code, 200)

            detail = self.client.get(f'/api/travels/{travel_id}')
            self.assertEqual(detail.status_code, 200)
            data = detail.get_json()
            self.assertEqual(data['start_date'], '2025-09-02')
            self.assertEqual(data['end_date'], '2025-09-04')
            self.assertEqual(data['rating'], '5.0')
            self.assertEqual(data['number_of_flights'], 1)
            self.assertEqual(data['locations'][0]['arrival_date'], '2025-09-02')
            self.assertEqual(data['locations'][0]['departure_date'], '2025-09-04')
        finally:
            self._hard_delete_travel(travel_id)

    def test_location_create_duplicate_update_delete_restore_and_hard_delete(self):
        create_response = self.client.post('/api/locations', json=self._location_payload())

        self.assertEqual(create_response.status_code, 201)
        location_id = create_response.get_json()['id']
        try:
            duplicate = self.client.post('/api/locations', json=self._location_payload())
            self.assertEqual(duplicate.status_code, 409)
            duplicate_payload = duplicate.get_json()
            self.assertEqual(duplicate_payload['duplicate'], True)
            self.assertEqual(duplicate_payload['existing']['id'], location_id)

            detail = self.client.get(f'/api/locations/{location_id}')
            self.assertEqual(detail.status_code, 200)
            data = detail.get_json()
            self.assertEqual(data['name'], 'Fixture location flow')
            self.assertEqual(data['country_name'], 'Finland')
            self.assertEqual(data['location_type'], 'wyspa')
            self.assertEqual(data['visit_count'], 0)

            update_response = self.client.put(f'/api/locations/{location_id}', json=self._location_payload(
                name='Fixture location flow updated',
                location_type_id=1,
                parent_location_id=1,
                address='Updated integration address',
                notes='Updated integration notes',
                latitude=61.23456,
                longitude=25.23456,
            ))
            self.assertEqual(update_response.status_code, 200)

            updated = self.client.get(f'/api/locations/{location_id}')
            self.assertEqual(updated.status_code, 200)
            updated_data = updated.get_json()
            self.assertEqual(updated_data['name'], 'Fixture location flow updated')
            self.assertEqual(updated_data['location_type'], 'miasto')
            self.assertEqual(updated_data['parent_location_id'], 1)
            self.assertEqual(updated_data['parent_name'], 'Helsinki')
            self.assertEqual(updated_data['address'], 'Updated integration address')
            self.assertEqual(updated_data['notes'], 'Updated integration notes')
            self.assertEqual(updated_data['latitude'], '61.23456')
            self.assertEqual(updated_data['longitude'], '25.23456')

            soft_delete = self.client.delete(f'/api/locations/{location_id}')
            self.assertEqual(soft_delete.status_code, 200)
            self.assertEqual(self.client.get(f'/api/locations/{location_id}').status_code, 404)

            trash_after_delete = self.client.get('/api/trash')
            self.assertEqual(trash_after_delete.status_code, 200)
            deleted_location_names = [item['name'] for item in trash_after_delete.get_json()['locations']]
            self.assertIn('Fixture location flow updated', deleted_location_names)

            restore = self.client.post(f'/api/locations/{location_id}/restore')
            self.assertEqual(restore.status_code, 200)
            self.assertEqual(self.client.get(f'/api/locations/{location_id}').status_code, 200)
        finally:
            self._hard_delete_location(location_id)

        self.assertEqual(self.client.get(f'/api/locations/{location_id}').status_code, 404)


if __name__ == '__main__':
    unittest.main()
