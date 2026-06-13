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
            notes TEXT
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
                (id, travel_id, location_id, arrival_date, departure_date, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            [
                (1, 1, 1, '2025-07-18', '2025-07-20', 'Direct parent visit'),
                (2, 1, 2, '2025-07-21', '2025-07-21', 'Child visit'),
                (3, 1, 3, '2025-07-22', '2025-07-23', 'Second country'),
                (4, 2, 2, '2025-08-01', '2025-08-02', 'Return through child'),
                (5, 3, 1, '2024-01-01', '2024-01-02', 'Deleted travel is ignored'),
            ],
        )
        cur.executemany(
            "INSERT INTO travel_participants (travel_id, person_id) VALUES (%s, %s)",
            [(1, 1), (2, 1), (3, 1)],
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
        self.assertEqual(data['last_visit'], '2025-08-02')
        self.assertEqual([visit['travel_name'] for visit in data['visits']], ['Nordic loop'])
        self.assertEqual(
            [visit['travel_name'] for visit in data['child_visits']],
            ['Nordic loop', 'Island return'],
        )

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


if __name__ == '__main__':
    unittest.main()
