"""Versioned PostgreSQL schema migrations for startup deploys."""

from psycopg2.extensions import quote_ident


SCHEMA_INDEX_STATEMENTS = (
    "CREATE INDEX IF NOT EXISTS idx_travel_locations_travel_id ON travel_locations (travel_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_locations_location_id ON travel_locations (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_participants_travel_id ON travel_participants (travel_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_participants_person_id ON travel_participants (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_locations_parent_location_id ON locations (parent_location_id)",
    "CREATE INDEX IF NOT EXISTS idx_locations_country_id ON locations (country_id)",
    "CREATE INDEX IF NOT EXISTS idx_travels_active_start_date ON travels (start_date) WHERE deleted_at IS NULL",
    "CREATE INDEX IF NOT EXISTS idx_locations_active_country_id ON locations (country_id) WHERE deleted_at IS NULL",
)


SCHEMA_CONSTRAINT_STATEMENTS = (
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_amount_non_negative'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_amount_non_negative
          CHECK (amount IS NULL OR amount >= 0) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_currency_iso'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_currency_iso
          CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$') NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_dates_order'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_dates_order
          CHECK (end_date >= start_date) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_rating_half_step'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_rating_half_step
          CHECK (
            rating IS NULL OR (
              rating >= 0.5 AND rating <= 5
              AND rating * 2 = ROUND(rating * 2)
            )
          ) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_flights_non_negative'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_flights_non_negative
          CHECK (number_of_flights IS NULL OR number_of_flights >= 0) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travel_locations_dates_order'
      ) THEN
        ALTER TABLE travel_locations
          ADD CONSTRAINT chk_travel_locations_dates_order
          CHECK (
            arrival_date IS NULL OR departure_date IS NULL
            OR departure_date >= arrival_date
          ) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_latitude_bounds'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_latitude_bounds
          CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_longitude_bounds'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_longitude_bounds
          CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_parent_not_self'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_parent_not_self
          CHECK (parent_location_id IS NULL OR parent_location_id <> id) NOT VALID;
      END IF;
    END $$;
    """,
)


def _add_soft_delete_and_coordinates(cur):
    cur.execute("ALTER TABLE travels   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(8,5)")
    cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(8,5)")


def _migrate_rating_numeric(cur):
    cur.execute("""
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'travels' AND column_name = 'rating'
    """)
    row = cur.fetchone()
    if not row or row[0] != 'integer':
        print(f'[schema] rating: type={row[0] if row else "?"}; migration skipped')
        return

    cur.execute("""
        SELECT DISTINCT cl.relname::text, pg_get_viewdef(cl.oid, true) AS definition
        FROM pg_depend d
        JOIN pg_rewrite r ON d.objid = r.oid
        JOIN pg_class cl ON r.ev_class = cl.oid
        JOIN pg_attribute a ON d.refobjid = a.attrelid AND d.refobjsubid = a.attnum
        JOIN pg_class tc ON a.attrelid = tc.oid
        WHERE tc.relname = 'travels' AND a.attname = 'rating' AND cl.relkind = 'v'
    """)
    dependent_views = cur.fetchall()
    for view_name, _ in dependent_views:
        cur.execute(f"DROP VIEW IF EXISTS {quote_ident(view_name, cur)}")
        print(f'[schema] dropped dependent view: {view_name}')

    cur.execute("ALTER TABLE travels ALTER COLUMN rating TYPE NUMERIC(2,1) USING rating::numeric")
    print('[schema] rating: INTEGER -> NUMERIC(2,1)')

    for view_name, view_definition in dependent_views:
        cur.execute(f"CREATE VIEW {quote_ident(view_name, cur)} AS {view_definition}")
        print(f'[schema] recreated view: {view_name}')


def _migrate_amount_numeric(cur):
    cur.execute("SAVEPOINT amount_numeric_migration")
    try:
        cur.execute("""
            SELECT data_type, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_name = 'travels' AND column_name = 'amount'
        """)
        amount_col = cur.fetchone()
        if amount_col and amount_col != ('numeric', 12, 2):
            cur.execute("""
                ALTER TABLE travels
                ALTER COLUMN amount TYPE NUMERIC(12,2)
                USING ROUND(amount::numeric, 2)
            """)
            print('[schema] amount: -> NUMERIC(12,2)')
    except Exception as amount_error:
        cur.execute("ROLLBACK TO SAVEPOINT amount_numeric_migration")
        print('[schema] amount migration skipped:', amount_error)
    finally:
        cur.execute("RELEASE SAVEPOINT amount_numeric_migration")


def _ensure_indexes(cur):
    for statement in SCHEMA_INDEX_STATEMENTS:
        cur.execute(statement)
    print(f'[schema] indexes ensured: {len(SCHEMA_INDEX_STATEMENTS)}')


def _ensure_constraints(cur):
    for statement in SCHEMA_CONSTRAINT_STATEMENTS:
        cur.execute(statement)
    print(f'[schema] constraints ensured: {len(SCHEMA_CONSTRAINT_STATEMENTS)}')


SCHEMA_MIGRATIONS = (
    ('20260528_001_soft_delete_coordinates', 'Add soft delete and coordinates', _add_soft_delete_and_coordinates),
    ('20260528_002_rating_numeric', 'Convert rating to NUMERIC(2,1)', _migrate_rating_numeric),
    ('20260528_003_amount_numeric', 'Convert amount to NUMERIC(12,2)', _migrate_amount_numeric),
    ('20260528_004_indexes', 'Ensure FK and active-record indexes', _ensure_indexes),
    ('20260528_005_domain_constraints', 'Ensure domain CHECK constraints', _ensure_constraints),
)


def _ensure_migration_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)


def _applied_versions(cur):
    cur.execute("SELECT version FROM schema_migrations")
    return {row[0] for row in cur.fetchall()}


def run_schema_migrations(cur):
    _ensure_migration_table(cur)
    applied = _applied_versions(cur)
    applied_now = []

    for version, name, migration in SCHEMA_MIGRATIONS:
        if version in applied:
            continue
        print(f'[schema] applying {version}: {name}')
        migration(cur)
        cur.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
            (version, name),
        )
        applied.add(version)
        applied_now.append(version)

    return applied_now
