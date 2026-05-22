# CLAUDE.md

This file provides guidance to Claude Code and other coding agents working in this repository.

## Run Locally

```bash
set DATABASE_URL=postgresql://...   # Neon.tech connection string
pip install -r requirements.txt
python app.py                       # http://localhost:5000
```

Production on Render starts with `gunicorn app:app` from `Procfile`. `DATABASE_URL` must be configured in Render environment variables.

## Deployment

Changes are deployed by pushing to `main`:

```bash
git add ...
git commit -m "..."
git push origin main
```

Render automatically deploys from GitHub.

## Architecture

Backend is Flask + PostgreSQL split into modules:

| File | Responsibility |
|------|----------------|
| `app.py` | Flask app setup, static shell, service worker, trash/export endpoints |
| `core.py` | DB connection, query helpers, validation/error helpers, schema migrations |
| `travels.py` | travel CRUD, travel locations, travel participants |
| `locations.py` | location CRUD, location detail, map data, location completion worklist |
| `dicts.py` | countries, location types, relation types, persons |
| `stats.py` | stats dashboard routes, Hall of Fame and main stats endpoint |
| `stats_common.py` | shared date/range helpers for stats |
| `stats_countries.py` | country history, new countries and returning countries aggregations |
| `stats_quality.py` | travel data-quality and completion worklist aggregations |
| `schemas.py` | Pydantic request validation |
| `migrate.py` | destructive SQLite -> PostgreSQL migration, requires `--force` |

Frontend is a vanilla JS SPA. `templates/index.html` is the shell and loads scripts from `static/js/`.

| File | Responsibility |
|------|----------------|
| `utils.js` | API helpers, escaping, dates, icons, navigation |
| `travels.js` | travel list, travel detail, travel edit modal |
| `locations.js` | location list/detail/edit, location completion worklist |
| `wizard.js` | multi-step new travel wizard |
| `map.js` | Leaflet map with MarkerCluster |
| `stats.js` | stats dashboard and charts |
| `todo.js` | travel completion worklist |
| `dictionaries.js` | dictionary CRUD modals |
| `persons.js` | participant CRUD modal |

Navigation is handled by `showTab(name)` in `utils.js`. Some views such as `todo` and `locationTodo` are tabless internal views opened from other screens.

## Product Rules

- Travel length is counted inclusively: `2025-07-11` to `2025-07-12` is 2 days.
- Yearly stats are activity-based: a trip crossing year boundary contributes days to each overlapping year.
- Costs are kept per currency. Do not silently merge currencies into one total.
- Incomplete travel is allowed intentionally. Do not remove the ability to save a partially filled trip.
- Technical partial-save failures should not be hidden from the user.

## Data Quality Views

Travel data quality lives in:

- API: `/api/stats/todo`
- UI: `static/js/todo.js`
- Entry point: `Statystyki -> Jakosc danych -> Lista`

Location data quality lives in:

- API: `/api/locations/todo`
- UI: `static/js/locations.js`
- Entry point: `Miejsca -> Braki`

## Database

Core tables:

```text
countries, location_types, relation_types
locations
persons
travels
travel_locations
travel_participants
```

Locations support hierarchy through `parent_location_id`.

## Testing And Checks

Current checks used during development:

```bash
python -m py_compile app.py core.py travels.py locations.py dicts.py stats.py schemas.py migrate.py
python -m py_compile stats_common.py stats_countries.py stats_quality.py
python -m ruff check .
python -m unittest discover -s tests
```

For frontend syntax, use `node --check` when available, or parse changed JS files with the Node runtime.
For shared frontend helpers, run:

```bash
node tools/smoke_js.mjs
```

## Important Notes

- `AGENTS.md` is intentionally tracked and is the current shared guidance for Codex and other agents.
- `migrate.py` drops/recreates PostgreSQL tables and must be run with `--force`.
- Static assets are loaded with `?v={{ asset_version }}` to avoid stale PWA/cache behavior after deploys.
