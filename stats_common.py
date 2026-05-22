"""Shared date and SQL helper functions for stats aggregations."""

from datetime import date


def _period_bounds(year):
    if not year:
        return None, None
    return date(year, 1, 1), date(year, 12, 31)


def _travel_period_clause(year, alias=''):
    prefix = f'{alias}.' if alias else ''
    if not year:
        return f'{prefix}deleted_at IS NULL', ()
    start, end = _period_bounds(year)
    return (
        f'{prefix}deleted_at IS NULL AND {prefix}start_date <= %s AND {prefix}end_date >= %s',
        (end, start),
    )


def _clipped_trip_days(start_date, end_date, period_start=None, period_end=None):
    start = start_date if isinstance(start_date, date) else date.fromisoformat(str(start_date))
    end = end_date if isinstance(end_date, date) else date.fromisoformat(str(end_date))
    if period_start:
        start = max(start, period_start)
    if period_end:
        end = min(end, period_end)
    if end < start:
        return 0
    return (end - start).days + 1


def _day_series(base_start, base_end, year=None):
    if not year:
        return f"generate_series({base_start}::timestamp, {base_end}::timestamp, interval '1 day')"
    return (
        f"generate_series(GREATEST({base_start}, %s::date)::timestamp, "
        f"LEAST({base_end}, %s::date)::timestamp, interval '1 day')"
    )


def _series_params(year):
    if not year:
        return ()
    return _period_bounds(year)
