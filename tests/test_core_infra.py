import unittest
from unittest.mock import patch

from flask import Flask

import core


class FakeDb:
    def __init__(self):
        self.autocommit = True
        self.closed = 0
        self.rollbacks = 0
        self.commits = 0

    def rollback(self):
        self.rollbacks += 1

    def commit(self):
        self.commits += 1

    def close(self):
        self.closed = 1

    def cursor(self):
        return FakeCursor(self)


class FakePool:
    def __init__(self, db):
        self.db = db
        self.gets = 0
        self.returned = []

    def getconn(self):
        self.gets += 1
        return self.db

    def putconn(self, db, close=False):
        self.returned.append((db, close))


class FakeCursor:
    description = ('id',)
    rowcount = 3

    def __init__(self, db):
        self.db = db
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=()):
        self.executed.append((sql, params))

    def fetchone(self):
        return (42,)


class CoreInfrastructureTests(unittest.TestCase):
    def setUp(self):
        self.original_pool = core._db_pool
        self.original_write_version = core._db_write_version
        core._db_pool = None
        core._db_write_version = 0

    def tearDown(self):
        core._db_pool = self.original_pool
        core._db_write_version = self.original_write_version

    def test_get_db_uses_threaded_pool_and_returns_connection_to_pool(self):
        app = Flask(__name__)
        db = FakeDb()
        pool = FakePool(db)

        with (
            patch.object(core, 'DATABASE_URL', 'postgresql://example'),
            patch.object(core, 'DB_POOL_MINCONN', 2),
            patch.object(core, 'DB_POOL_MAXCONN', 4),
            patch.object(core.psycopg2.pool, 'ThreadedConnectionPool', return_value=pool) as pool_cls,
            app.app_context(),
        ):
            self.assertIs(core.get_db(), db)
            self.assertFalse(db.autocommit)
            core.close_db()

        pool_cls.assert_called_once_with(2, 4, 'postgresql://example')
        self.assertEqual(db.rollbacks, 1)
        self.assertEqual(pool.returned, [(db, False)])

    def test_execute_commits_and_marks_write_version(self):
        db = FakeDb()

        with patch.object(core, 'get_db', return_value=db):
            result = core.execute('INSERT INTO travels DEFAULT VALUES RETURNING id')

        self.assertEqual(result, 42)
        self.assertEqual(db.commits, 1)
        self.assertEqual(core.get_db_write_version(), 1)

    def test_schema_index_statements_cover_fk_and_active_record_queries(self):
        statements = '\n'.join(core.SCHEMA_INDEX_STATEMENTS)
        for fragment in (
            'travel_locations (travel_id)',
            'travel_locations (location_id)',
            'travel_participants (travel_id)',
            'travel_participants (person_id)',
            'locations (parent_location_id)',
            'locations (country_id)',
            'travels (start_date) WHERE deleted_at IS NULL',
            'locations (country_id) WHERE deleted_at IS NULL',
        ):
            self.assertIn(fragment, statements)


if __name__ == '__main__':
    unittest.main()
