"""Prepare or apply structured travel-description imports.

Default mode is a dry run: it reads the draft, validates it against the
database, and prints what would change. Writes require both --apply and the
exact confirmation token.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras


CONFIRM_TOKEN = "TAK_IMPORTUJ"


class PlanError(Exception):
    pass


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def rows_by_name(cur, table: str) -> dict[str, dict[str, Any]]:
    cur.execute(f"SELECT id, name FROM {table} ORDER BY name")
    return {str(row["name"]).lower(): dict(row) for row in cur.fetchall()}


def require_named(lookup: dict[str, dict[str, Any]], name: str, label: str) -> dict[str, Any]:
    row = lookup.get(name.lower())
    if not row:
        raise PlanError(f"Missing {label}: {name}")
    return row


def as_date_text(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def format_notes(trip: dict[str, Any]) -> str:
    lines = [
        f"{trip['name']} --> {trip['start_date']} --- {trip['end_date']}",
        "",
    ]
    for day in trip.get("daily_notes", []):
        lines.append(f"{day['date']} - {day['text']}")
    return "\n".join(lines).strip()


def fetch_target_travel(cur, trip: dict[str, Any]) -> dict[str, Any]:
    cur.execute(
        """
        SELECT id, name, start_date, end_date, is_description_complete,
               notes, reflections
        FROM travels
        WHERE id = %s AND deleted_at IS NULL
        """,
        (trip["travel_id"],),
    )
    travel = cur.fetchone()
    if not travel:
        raise PlanError(f"Travel id={trip['travel_id']} not found")
    travel = dict(travel)
    if travel["name"] != trip["name"]:
        raise PlanError(
            f"Travel id={trip['travel_id']} has name {travel['name']!r}, expected {trip['name']!r}"
        )
    if as_date_text(travel["start_date"]) != trip["start_date"] or as_date_text(travel["end_date"]) != trip["end_date"]:
        raise PlanError(
            f"Travel id={trip['travel_id']} date range differs from draft"
        )
    return travel


def find_existing_location(cur, spec: dict[str, Any], country_id: int, parent_id: int | None) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type,
               l.parent_location_id
        FROM locations l
        JOIN countries c ON c.id = l.country_id
        JOIN location_types lt ON lt.id = l.location_type_id
        WHERE lower(l.name) = lower(%s)
          AND l.country_id = %s
          AND COALESCE(l.parent_location_id, 0) = COALESCE(%s, 0)
          AND l.deleted_at IS NULL
        ORDER BY l.id
        LIMIT 1
        """,
        (spec["name"], country_id, parent_id),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def resolve_location(
    cur,
    key: str,
    specs: dict[str, dict[str, Any]],
    countries: dict[str, dict[str, Any]],
    location_types: dict[str, dict[str, Any]],
    state: dict[str, Any],
    apply_changes: bool,
) -> int | str:
    if key in state["resolved"]:
        return state["resolved"][key]
    if key not in specs:
        raise PlanError(f"Visit references unknown location key: {key}")

    spec = specs[key]
    country = require_named(countries, spec["country"], "country")
    location_type = require_named(location_types, spec["type"], "location type")
    parent_id: int | None = None
    parent_key = spec.get("parent_key")
    if parent_key:
        resolved_parent = resolve_location(
            cur,
            parent_key,
            specs,
            countries,
            location_types,
            state,
            apply_changes,
        )
        if isinstance(resolved_parent, int):
            parent_id = resolved_parent

    existing = None
    if not parent_key or parent_id is not None:
        existing = find_existing_location(cur, spec, country["id"], parent_id)
    if existing:
        state["resolved"][key] = existing["id"]
        state["reused_locations"].append(
            {
                "key": key,
                "id": existing["id"],
                "name": existing["name"],
                "country": existing["country_name"],
            }
        )
        return existing["id"]

    if not apply_changes:
        token = f"new:{key}"
        state["resolved"][key] = token
        state["new_locations"].append(
            {
                "key": key,
                "name": spec["name"],
                "country": spec["country"],
                "type": spec["type"],
                "parent_key": parent_key,
            }
        )
        return token

    cur.execute(
        """
        INSERT INTO locations
            (name, country_id, location_type_id, parent_location_id, address, notes, latitude, longitude)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            spec["name"],
            country["id"],
            location_type["id"],
            parent_id,
            spec.get("address"),
            spec.get("notes"),
            spec.get("latitude"),
            spec.get("longitude"),
        ),
    )
    new_id = cur.fetchone()["id"]
    state["resolved"][key] = new_id
    state["new_locations"].append(
        {
            "key": key,
            "id": new_id,
            "name": spec["name"],
            "country": spec["country"],
            "type": spec["type"],
            "parent_key": parent_key,
        }
    )
    return new_id


def existing_travel_locations(cur, travel_id: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT tl.id, l.name AS location_name, tl.arrival_date, tl.departure_date, tl.notes
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        WHERE tl.travel_id = %s
        ORDER BY tl.arrival_date, tl.id
        """,
        (travel_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def existing_participants(cur, travel_id: int) -> list[str]:
    cur.execute(
        """
        SELECT p.name
        FROM travel_participants tp
        JOIN persons p ON p.id = tp.person_id
        WHERE tp.travel_id = %s
        ORDER BY p.name
        """,
        (travel_id,),
    )
    return [row["name"] for row in cur.fetchall()]


def process_trip(
    cur,
    trip: dict[str, Any],
    lookups: dict[str, dict[str, dict[str, Any]]],
    apply_changes: bool,
) -> dict[str, Any]:
    travel = fetch_target_travel(cur, trip)
    specs = {loc["key"]: loc for loc in trip.get("locations", [])}
    state: dict[str, Any] = {
        "resolved": {},
        "new_locations": [],
        "reused_locations": [],
    }

    for spec in trip.get("locations", []):
        resolve_location(
            cur,
            spec["key"],
            specs,
            lookups["countries"],
            lookups["location_types"],
            state,
            apply_changes,
        )

    visits = trip.get("visits", [])
    for visit in visits:
        if visit["location_key"] not in state["resolved"]:
            resolve_location(
                cur,
                visit["location_key"],
                specs,
                lookups["countries"],
                lookups["location_types"],
                state,
                apply_changes,
            )

    participants = trip.get("participants", [])
    for participant in participants:
        require_named(lookups["persons"], participant, "person")

    current_locations = existing_travel_locations(cur, trip["travel_id"])
    current_participants = existing_participants(cur, trip["travel_id"])
    missing_participants = [p for p in participants if p not in current_participants]
    notes = format_notes(trip)

    if apply_changes:
        cur.execute(
            """
            UPDATE travels
            SET notes = %s, is_description_complete = %s
            WHERE id = %s
            """,
            (notes, bool(trip.get("is_description_complete", True)), trip["travel_id"]),
        )
        if trip.get("replace_travel_locations"):
            cur.execute("DELETE FROM travel_locations WHERE travel_id = %s", (trip["travel_id"],))
        for visit in visits:
            location_id = state["resolved"][visit["location_key"]]
            if not isinstance(location_id, int):
                raise PlanError(f"Unresolved location id for {visit['location_key']}")
            cur.execute(
                """
                INSERT INTO travel_locations
                    (travel_id, location_id, arrival_date, departure_date, notes)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    trip["travel_id"],
                    location_id,
                    visit["arrival_date"],
                    visit["departure_date"],
                    visit.get("notes"),
                ),
            )
        for participant in missing_participants:
            person = lookups["persons"][participant.lower()]
            cur.execute(
                """
                INSERT INTO travel_participants (travel_id, person_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (trip["travel_id"], person["id"]),
            )

    return {
        "travel": travel,
        "planned_notes_len": len(notes),
        "planned_daily_notes": len(trip.get("daily_notes", [])),
        "replace_travel_locations": bool(trip.get("replace_travel_locations")),
        "existing_travel_locations": current_locations,
        "planned_visits": len(visits),
        "new_locations": state["new_locations"],
        "reused_locations": state["reused_locations"],
        "participants": participants,
        "missing_participants": missing_participants,
    }


def print_summary(plan: dict[str, Any], results: list[dict[str, Any]], apply_changes: bool) -> None:
    mode = "APPLY" if apply_changes else "DRY RUN"
    print(f"{mode}: {plan.get('title', 'travel import draft')}")
    print(f"Source: {plan.get('source_file', '-')}")
    print()
    for result in results:
        travel = result["travel"]
        print(f"- {travel['name']} (id={travel['id']})")
        print(
            f"  notes: {result['planned_daily_notes']} days, {result['planned_notes_len']} chars; "
            f"is_description_complete -> true"
        )
        print(
            f"  travel_locations: {len(result['existing_travel_locations'])} existing -> "
            f"{result['planned_visits']} planned"
        )
        if result["replace_travel_locations"]:
            print("  strategy: replace travel_locations for this travel")
        print(
            f"  locations: reuse {len(result['reused_locations'])}, "
            f"create {len(result['new_locations'])}"
        )
        if result["new_locations"]:
            names = ", ".join(f"{loc['name']} ({loc['country']})" for loc in result["new_locations"])
            print(f"  to create: {names}")
        print(
            f"  participants: {', '.join(result['participants'])}; "
            f"missing now: {', '.join(result['missing_participants']) or 'none'}"
        )
        print()
    if not apply_changes:
        print("No database writes were performed.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dry-run or apply a structured travel import draft.")
    parser.add_argument(
        "draft",
        nargs="?",
        default="tools/import_drafts/travels_description_1a.json",
        help="Path to import draft JSON.",
    )
    parser.add_argument("--apply", action="store_true", help="Write the prepared import to the database.")
    parser.add_argument(
        "--confirm",
        default="",
        help=f"Required with --apply. Must be exactly {CONFIRM_TOKEN}.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply and args.confirm != CONFIRM_TOKEN:
        raise SystemExit(f"--apply requires --confirm {CONFIRM_TOKEN}")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set")

    plan = load_json(Path(args.draft))
    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            lookups = {
                "countries": rows_by_name(cur, "countries"),
                "location_types": rows_by_name(cur, "location_types"),
                "persons": rows_by_name(cur, "persons"),
            }
            results = [
                process_trip(cur, trip, lookups, args.apply)
                for trip in plan.get("trips", [])
            ]
        if args.apply:
            conn.commit()
        else:
            conn.rollback()
        print_summary(plan, results, args.apply)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
