import unittest
from unittest.mock import patch

from flask import Flask

import core
import schema_migrations


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


class MigrationCursor:
    def __init__(self, applied=()):
        self.applied = set(applied)
        self.executed = []
        self._fetchall = []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        if 'SELECT version FROM schema_migrations' in sql:
            self._fetchall = [(version,) for version in sorted(self.applied)]
        if 'INSERT INTO schema_migrations' in sql:
            self.applied.add(params[0])

    def fetchall(self):
        return self._fetchall


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

    def test_schema_constraint_statements_cover_domain_invariants(self):
        statements = '\n'.join(core.SCHEMA_CONSTRAINT_STATEMENTS)
        for fragment in (
            'chk_travels_amount_non_negative',
            'chk_travels_currency_iso',
            'chk_travels_dates_order',
            'chk_travels_rating_half_step',
            'chk_travels_flights_non_negative',
            'chk_travel_locations_dates_order',
            'chk_locations_latitude_bounds',
            'chk_locations_longitude_bounds',
            'chk_locations_parent_not_self',
        ):
            self.assertIn(fragment, statements)

    def test_schema_migrations_are_versioned_and_ordered(self):
        versions = [version for version, _, _ in core.SCHEMA_MIGRATIONS]

        self.assertEqual(len(versions), len(set(versions)))
        self.assertEqual(versions, sorted(versions))
        self.assertIn('20260528_001_soft_delete_coordinates', versions)
        self.assertIn('20260528_005_domain_constraints', versions)
        self.assertIn('20260618_006_travel_location_order', versions)

    def test_schema_migration_runner_skips_applied_versions(self):
        calls = []

        def first_migration(cur):
            calls.append('first')

        def second_migration(cur):
            calls.append('second')

        cursor = MigrationCursor(applied={'001'})
        migrations = (
            ('001', 'Already applied', first_migration),
            ('002', 'New migration', second_migration),
        )

        with (
            patch.object(schema_migrations, 'SCHEMA_MIGRATIONS', migrations),
            patch('builtins.print'),
        ):
            applied_now = schema_migrations.run_schema_migrations(cursor)

        self.assertEqual(calls, ['second'])
        self.assertEqual(applied_now, ['002'])
        self.assertIn('002', cursor.applied)
        self.assertTrue(any('CREATE TABLE IF NOT EXISTS schema_migrations' in sql for sql, _ in cursor.executed))

    def test_ensure_schema_does_not_crash_when_migration_connection_is_closed(self):
        class ClosedMigrationDb(FakeDb):
            def cursor(self):
                self.closed = 1
                raise RuntimeError('connection lost during migration')

            def rollback(self):
                raise AssertionError('rollback should not run on a closed connection')

        db = ClosedMigrationDb()

        with (
            patch.object(core, 'DATABASE_URL', 'postgresql://example'),
            patch.object(core.psycopg2, 'connect', return_value=db),
            patch('builtins.print') as printed,
        ):
            core.ensure_schema()

        self.assertEqual(db.closed, 1)
        self.assertTrue(any(
            call.args[:1] == ('[schema] migration failed:',)
            for call in printed.call_args_list
        ))


if __name__ == '__main__':
    unittest.main()
