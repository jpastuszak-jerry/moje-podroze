"""Blueprint /api/stats: aggregate travel analytics for the dashboard."""

import copy
import os
import time
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from statistics import median

from flask import Blueprint, jsonify, request

from core import etag_json, get_db_write_version, query
from stats_common import _day_series, _period_bounds, _series_params, _travel_period_clause
from stats_countries import _country_history, _country_milestones
from stats_hall_of_fame import _hall_of_fame
from stats_quality import _data_quality
from stats_yearbook import _yearbook


bp = Blueprint('stats', __name__)


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


STATS_CACHE_TTL_SECONDS = max(0, _env_int('STATS_CACHE_TTL_SECONDS', 60))
_stats_payload_cache = {}
_stats_overview_cache = {}
_stats_section_cache = {}


def clear_stats_cache():
    _stats_payload_cache.clear()
    _stats_overview_cache.clear()
    _stats_section_cache.clear()


def _cache_key(year):
    return (year, get_db_write_version())


def _cached_payload(cache, year, builder):
    if STATS_CACHE_TTL_SECONDS <= 0:
        return builder(year)

    now = time.monotonic()
    key = _cache_key(year)
    cached = cache.get(key)
    if cached and cached['expires_at'] > now:
        return copy.deepcopy(cached['payload'])

    payload = builder(year)
    cache.clear()
    cache[key] = {
        'expires_at': now + STATS_CACHE_TTL_SECONDS,
        'payload': copy.deepcopy(payload),
    }
    return payload


def _stats_payload(year):
    return _cached_payload(_stats_payload_cache, year, _build_stats_payload)


def _stats_overview_payload(year):
    return _cached_payload(_stats_overview_cache, year, _build_stats_overview_payload)


def _stats_section_payload(section, year):
    section_cache = _stats_section_cache.setdefault(section, {})
    return _cached_payload(
        section_cache,
        year,
        lambda selected_year: _build_stats_section_payload(section, selected_year),
    )


def _date_from_value(value):
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _round_half_up(value):
    return int(Decimal(str(value)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _period_base(year=None):
    """Shared period summary and source rows for detailed stats."""
    period_start, period_end = _period_bounds(year)
    main_clause, main_params = _travel_period_clause(year)
    t_clause, t_params = _travel_period_clause(year, 't')

    travels = [dict(r) for r in query(f"SELECT * FROM travels WHERE {main_clause}", main_params)]

    geography = query(f"""
        SELECT COUNT(DISTINCT c.id) AS countries,
               COUNT(DISTINCT l.id) AS visited_locations
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE l.deleted_at IS NULL AND {t_clause}
    """, t_params, one=True)

    total_days_set = set()
    trip_days = []
    amount_by_currency = {}
    cost_buckets = {}
    ratings = []
    flights = 0
    albums = 0
    purposes = {}
    described = 0
    paid_trips = []

    for t in travels:
        days = 0
        full_days = 0
        start = None
        end = None
        try:
            start = _date_from_value(t['start_date'])
            end = _date_from_value(t['end_date'])
            full_days = max((end - start).days + 1, 0)
            clipped_start = max(start, period_start) if period_start else start
            clipped_end = min(end, period_end) if period_end else end
            if clipped_end >= clipped_start:
                days = (clipped_end - clipped_start).days + 1
                trip_days.append(days)
                total_days_set.update(
                    date.fromordinal(clipped_start.toordinal() + i)
                    for i in range(days)
                )
        except Exception:
            pass

        amount = float(t.get('amount') or 0)
        if amount > 0:
            cur = (t.get('currency') or 'PLN').upper()
            amount_by_currency[cur] = amount_by_currency.get(cur, 0) + amount
            bucket = cost_buckets.setdefault(cur, {'amounts': [], 'days': 0})
            bucket['amounts'].append(amount)
            bucket['days'] += days
            if start and end and full_days > 0:
                paid_trips.append({
                    'name': t.get('name'),
                    'amount': round(amount, 2),
                    'currency': cur,
                    'start_date': str(start),
                    'end_date': str(end),
                    'days': full_days,
                    'cost_per_day': _round_half_up(amount / full_days),
                    '_sort_amount': amount,
                })
        if t.get('rating'):
            ratings.append(float(t['rating']))
        flights += int(t.get('number_of_flights') or 0)
        if t.get('has_photo_album'):
            albums += 1
        if t.get('is_description_complete'):
            described += 1
        purpose = t.get('purpose') or 'Inne'
        purposes[purpose] = purposes.get(purpose, 0) + 1

    avg_trip_days = round(sum(trip_days) / len(trip_days), 1) if trip_days else 0
    cost_summary = []
    for cur, bucket in cost_buckets.items():
        amounts = bucket['amounts']
        total = sum(amounts)
        days = bucket['days']
        cost_summary.append({
            'currency': cur,
            'trip_count': len(amounts),
            'days': days,
            'total': round(total, 2),
            'avg_trip': round(total / len(amounts), 2),
            'median_trip': round(median(amounts), 2),
            'avg_per_day': round(total / days, 2) if days else None,
        })
    cost_summary.sort(key=lambda item: item['total'], reverse=True)

    top_expensive = [
        {k: trip[k] for k in ('name', 'amount', 'currency', 'start_date', 'end_date', 'days')}
        for trip in sorted(
            paid_trips,
            key=lambda item: (item['_sort_amount'], item['start_date']),
            reverse=True,
        )[:10]
    ]
    cost_per_day = [
        {k: trip[k] for k in ('name', 'amount', 'currency', 'days', 'cost_per_day')}
        for trip in sorted(
            paid_trips,
            key=lambda item: (item['cost_per_day'], item['_sort_amount']),
            reverse=True,
        )[:5]
    ]

    period = {
        'total_trips': len(travels),
        'total_days': len(total_days_set),
        'countries': int(geography['countries'] or 0),
        'visited_locations': int(geography['visited_locations'] or 0),
        'flights': flights,
        'albums': albums,
        'avg_rating': round(sum(ratings) / len(ratings), 1) if ratings else 0,
        'avg_trip_days': avg_trip_days,
        'amount_by_currency': {
            cur: round(amt, 2)
            for cur, amt in sorted(amount_by_currency.items(), key=lambda x: -x[1])
        },
        'cost_summary': cost_summary,
        'purposes': sorted(
            [{'name': k, 'count': v} for k, v in purposes.items()],
            key=lambda x: -x['count'],
        ),
        'top_expensive': top_expensive,
        'cost_per_day': cost_per_day,
        'progress': {
            'total': len(travels),
            'described': described,
            'with_album': albums,
        },
    }
    return period, travels, t_clause, t_params


def _period_by_month(year, t_clause, t_params):
    trip_day_series = _day_series('t.start_date', 't.end_date', year)
    trip_series_params = _series_params(year) + t_params
    by_month = [dict(r) for r in query(f"""
        SELECT EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days,
               COUNT(DISTINCT t.id) AS count
        FROM travels t
        CROSS JOIN LATERAL {trip_day_series} d
        WHERE {t_clause}
        GROUP BY month ORDER BY month
    """, trip_series_params)]
    for month in by_month:
        month['days'] = int(month['days'])
        month['count'] = int(month['count'])
    return by_month


def _cost_timeline(year=None):
    rows = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM start_date)::int AS year,
               EXTRACT(MONTH FROM start_date)::int AS month,
               UPPER(COALESCE(currency, 'PLN')) AS currency,
               COUNT(*)::int AS trip_count,
               ROUND(SUM(amount), 2) AS total
        FROM travels
        WHERE deleted_at IS NULL
          AND amount > 0
        GROUP BY year, month, currency
        ORDER BY year, month, currency
    """)]

    by_currency = {}
    for row in rows:
        currency = row['currency']
        by_currency.setdefault(currency, []).append({
            'year': int(row['year']),
            'month': int(row['month']),
            'trip_count': int(row['trip_count']),
            'total': round(float(row['total']), 2),
        })

    series = []
    for currency, currency_rows in sorted(by_currency.items()):
        annual = {}
        for row in currency_rows:
            bucket = annual.setdefault(row['year'], {'total': 0.0, 'trip_count': 0})
            bucket['total'] += row['total']
            bucket['trip_count'] += row['trip_count']

        if year:
            monthly = {
                row['month']: row
                for row in currency_rows
                if row['year'] == year
            }
            points = [
                {
                    'period': month,
                    'total': round(monthly.get(month, {}).get('total', 0), 2),
                    'trip_count': int(monthly.get(month, {}).get('trip_count', 0)),
                }
                for month in range(1, 13)
            ]
            comparison_year = year
        else:
            points = [
                {
                    'period': point_year,
                    'total': round(values['total'], 2),
                    'trip_count': values['trip_count'],
                }
                for point_year, values in sorted(annual.items())
            ]
            comparison_year = max(annual) if annual else None

        nonzero_points = [point for point in points if point['total'] > 0]
        peak = max(nonzero_points, key=lambda point: point['total']) if nonzero_points else None
        current_total = annual.get(comparison_year, {}).get('total', 0) if comparison_year else 0
        previous_year = comparison_year - 1 if comparison_year else None
        previous_total = annual.get(previous_year, {}).get('total', 0) if previous_year else 0
        delta = current_total - previous_total

        series.append({
            'currency': currency,
            'points': points,
            'peak': peak,
            'year_over_year': {
                'year': comparison_year,
                'previous_year': previous_year,
                'current_total': round(current_total, 2),
                'previous_total': round(previous_total, 2),
                'delta': round(delta, 2),
                'percent': round(delta / previous_total * 100, 1) if previous_total else None,
            } if comparison_year else None,
        })

    return {
        'mode': 'month' if year else 'year',
        'basis': 'start_date',
        'year': year,
        'series': series,
    }


def _geography_rankings(year, t_clause, t_params):
    visit_day_series = _day_series('tl.arrival_date', 'tl.departure_date', year)
    visit_series_params = _series_params(year) + t_params

    top_countries = [dict(r) for r in query(f"""
        SELECT c.name AS country,
               COUNT(DISTINCT tl.travel_id) AS visits,
               COUNT(DISTINCT d::date) AS days_spent
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        LEFT JOIN LATERAL {visit_day_series} d ON tl.arrival_date IS NOT NULL AND tl.departure_date IS NOT NULL
        WHERE l.deleted_at IS NULL AND {t_clause}
        GROUP BY c.name ORDER BY visits DESC, days_spent DESC LIMIT 5
    """, visit_series_params)]
    for country in top_countries:
        country['visits'] = int(country['visits'])
        country['days_spent'] = int(country['days_spent'] or 0)

    top_places = [dict(r) for r in query(f"""
        SELECT l.id, l.name AS location_name, c.name AS country,
               lt.name AS location_type,
               l.latitude AS lat, l.longitude AS lon,
               COUNT(DISTINCT tl.travel_id) AS visit_count,
               COUNT(DISTINCT d::date) AS days_spent
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        JOIN locations child ON (child.id = l.id OR child.parent_location_id = l.id)
        JOIN travel_locations tl ON tl.location_id = child.id
        JOIN travels t ON t.id = tl.travel_id
        LEFT JOIN LATERAL {visit_day_series} d ON tl.arrival_date IS NOT NULL AND tl.departure_date IS NOT NULL
        WHERE LOWER(lt.name) IN ('miasto', 'wyspa')
          AND l.deleted_at IS NULL AND child.deleted_at IS NULL AND {t_clause}
        GROUP BY l.id, l.name, c.name, lt.name, l.latitude, l.longitude
        ORDER BY visit_count DESC, days_spent DESC LIMIT 10
    """, visit_series_params)]
    for place in top_places:
        place['visit_count'] = int(place['visit_count'])
        place['days_spent'] = int(place['days_spent'] or 0)
        if place.get('lat') is not None:
            place['lat'] = float(place['lat'])
        if place.get('lon') is not None:
            place['lon'] = float(place['lon'])

    return {
        'top_countries': top_countries,
        'top_places': top_places,
    }


def _period_overview(year=None, include_months=False):
    period, _, t_clause, t_params = _period_base(year)
    if include_months:
        period['by_month'] = _period_by_month(year, t_clause, t_params)
    return period


def _period_stats(year=None):
    """Stats for all time or for activity overlapping the selected calendar year."""
    period, _travels, t_clause, t_params = _period_base(year)

    geography_rankings = _geography_rankings(year, t_clause, t_params)
    by_month = _period_by_month(year, t_clause, t_params)

    return {
        **period,
        'participants': _participants_stats(year),
        **geography_rankings,
        'by_month': by_month,
    }


def _participants_stats(year=None):
    t_clause, t_params = _travel_period_clause(year, 't')
    participant_day_series = _day_series('t.start_date', 't.end_date', year)
    participant_params = _series_params(year) + t_params
    participants = [dict(r) for r in query(f"""
        SELECT p.id, p.name, rt.name AS relation_type,
               COUNT(DISTINCT t.id) AS trips,
               COUNT(DISTINCT d::date) AS days
        FROM persons p
        JOIN travel_participants tp ON tp.person_id = p.id
        JOIN travels t ON t.id = tp.travel_id
        LEFT JOIN relation_types rt ON p.relation_type_id = rt.id
        CROSS JOIN LATERAL {participant_day_series} d
        WHERE {t_clause}
        GROUP BY p.id, p.name, rt.name
        ORDER BY trips DESC, days DESC, p.name
        LIMIT 10
    """, participant_params)]
    for p in participants:
        p['trips'] = int(p['trips'])
        p['days'] = int(p['days'])
    return participants


def _current_trip():
    r = query("""
        SELECT id, name, start_date, end_date,
               (CURRENT_DATE - start_date + 1)::int AS days_in,
               (end_date - start_date + 1)::int    AS days_total
        FROM travels
        WHERE deleted_at IS NULL
          AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
        ORDER BY start_date DESC LIMIT 1
    """, one=True)
    if not r:
        return None
    return {
        'id': r['id'], 'name': r['name'],
        'start_date': str(r['start_date']),
        'end_date': str(r['end_date']),
        'days_in': int(r['days_in']),
        'days_total': int(r['days_total']),
    }


def _streak_months():
    rows = query("""
        SELECT DISTINCT
          EXTRACT(YEAR  FROM d)::int AS y,
          EXTRACT(MONTH FROM d)::int AS m
        FROM travels,
             generate_series(start_date::timestamp, end_date::timestamp, interval '1 day') d
        WHERE deleted_at IS NULL
    """)
    months = {(r['y'], r['m']) for r in rows}
    today = date.today()
    y, m, streak = today.year, today.month, 0
    while (y, m) in months:
        streak += 1
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return streak


def _heatmap_data():
    rows = query("""
        SELECT EXTRACT(YEAR  FROM d)::int AS year,
               EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days
        FROM travels,
             generate_series(start_date::timestamp, end_date::timestamp, interval '1 day') d
        WHERE deleted_at IS NULL
        GROUP BY year, month
        ORDER BY year, month
    """)
    return [{'year': r['year'], 'month': r['month'], 'days': int(r['days'])} for r in rows]


def _parse_stats_year():
    raw_year = request.args.get('year')
    return int(raw_year) if raw_year and raw_year.isdigit() else None


def _locations_count():
    return query("SELECT COUNT(*) AS cnt FROM locations WHERE deleted_at IS NULL", one=True)['cnt']


def _by_year():
    rows = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM d)::int AS year,
               COUNT(DISTINCT t.id) AS count,
               COUNT(DISTINCT d::date) AS days
        FROM travels t,
             generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
        WHERE t.deleted_at IS NULL
        GROUP BY year ORDER BY year
    """)]
    for year_row in rows:
        year_row['count'] = int(year_row['count'])
        year_row['days'] = int(year_row['days'])
    return rows


def _previous_period(year):
    if not year:
        return None
    prev = _period_overview(year - 1)
    return {
        'year': year - 1,
        'total_trips': prev['total_trips'],
        'total_days': prev['total_days'],
        'countries': prev['countries'],
        'visited_locations': prev['visited_locations'],
        'flights': prev['flights'],
        'albums': prev['albums'],
        'avg_rating': prev['avg_rating'],
        'avg_trip_days': prev['avg_trip_days'],
        'amount_by_currency': prev['amount_by_currency'],
        'progress_described': prev['progress']['described'],
    }


OVERVIEW_PERIOD_KEYS = (
    'total_trips',
    'total_days',
    'countries',
    'visited_locations',
    'flights',
    'albums',
    'avg_rating',
    'avg_trip_days',
    'amount_by_currency',
    'purposes',
    'progress',
)

STATS_SECTION_IDS = {'yearbook', 'countries', 'costs', 'participants', 'quality'}


@bp.route('/api/stats')
def get_stats():
    year = _parse_stats_year()
    return etag_json(_stats_payload(year))


@bp.route('/api/stats/overview')
def get_stats_overview():
    year = _parse_stats_year()
    return etag_json(_stats_overview_payload(year))


@bp.route('/api/stats/section/<section>')
def get_stats_section(section):
    if section not in STATS_SECTION_IDS:
        return jsonify({'error': 'Nieznana sekcja statystyk'}), 404
    year = _parse_stats_year()
    return etag_json(_stats_section_payload(section, year))


def _build_stats_overview_payload(year):
    period = _period_overview(year, include_months=bool(year))
    payload = {key: period[key] for key in OVERVIEW_PERIOD_KEYS}
    if year:
        payload['by_month'] = period.get('by_month', [])
    else:
        payload['heatmap'] = _heatmap_data()
    return {
        **payload,
        'locations': _locations_count(),
        'by_year': _by_year(),
        'hall_of_fame': _hall_of_fame(),
        'year': year,
        'prev_period': _previous_period(year),
        'current_trip': None if year else _current_trip(),
        'streak_months': 0 if year else _streak_months(),
    }


def _stats_section_base(year):
    return {
        'year': year,
        'by_year': _by_year(),
    }


def _build_stats_section_payload(section, year):
    payload = _stats_section_base(year)

    if section == 'yearbook':
        return {
            **payload,
            'yearbook': _yearbook(),
        }

    if section == 'costs':
        period = _period_overview(year)
        return {
            **payload,
            'amount_by_currency': period['amount_by_currency'],
            'cost_summary': period['cost_summary'],
            'cost_timeline': _cost_timeline(year),
            'top_expensive': period['top_expensive'],
            'cost_per_day': period['cost_per_day'],
        }

    if section == 'participants':
        return {
            **payload,
            'participants': _participants_stats(year),
        }

    if section == 'countries':
        t_clause, t_params = _travel_period_clause(year, 't')
        return {
            **payload,
            **_geography_rankings(year, t_clause, t_params),
            'country_milestones': _country_milestones(year),
            'country_history': _country_history(year),
        }

    if section == 'quality':
        return {
            **payload,
            'data_quality': _data_quality(year),
        }

    raise ValueError(f'Unknown stats section: {section}')


def _build_stats_payload(year):
    period = _period_stats(year)

    return {
        **period,
        'locations': _locations_count(),
        'by_year': _by_year(),
        'hall_of_fame': _hall_of_fame(),
        'year': year,
        'prev_period': _previous_period(year),
        'current_trip': _current_trip(),
        'streak_months': _streak_months(),
        'heatmap': _heatmap_data(),
        'data_quality': _data_quality(year),
        'country_milestones': _country_milestones(year),
        'country_history': _country_history(year),
        'yearbook': _yearbook(),
        'cost_timeline': _cost_timeline(year),
    }


@bp.route('/api/stats/todo')
def get_stats_todo():
    raw_year = request.args.get('year')
    year = int(raw_year) if raw_year and raw_year.isdigit() else None
    return etag_json({
        'year': year,
        **_data_quality(year, limit=None),
    })
