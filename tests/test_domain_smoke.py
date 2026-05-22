import unittest
from datetime import date
from unittest.mock import patch

from pydantic import ValidationError

from schemas import LocationCreate, TravelCreate, TravelLocationCreate
import stats_countries
from stats_common import _clipped_trip_days, _period_bounds, _travel_period_clause


def valid_travel_payload(**overrides):
    payload = {
        'name': 'Helsinki, Tallin i Tartu',
        'start_date': date(2025, 7, 18),
        'end_date': date(2025, 7, 28),
        'purpose': 'Wakacje',
        'amount': 1000,
        'currency': 'eur',
        'rating': 4.5,
    }
    payload.update(overrides)
    return payload


class DateLogicSmokeTests(unittest.TestCase):
    def test_trip_days_are_inclusive(self):
        self.assertEqual(_clipped_trip_days(date(2025, 7, 11), date(2025, 7, 12)), 2)
        self.assertEqual(_clipped_trip_days('2025-07-11', '2025-07-11'), 1)

    def test_trip_days_clip_to_selected_year(self):
        self.assertEqual(
            _clipped_trip_days(
                date(2025, 12, 30),
                date(2026, 1, 2),
                date(2026, 1, 1),
                date(2026, 12, 31),
            ),
            2,
        )

    def test_period_helpers_keep_overlap_semantics(self):
        self.assertEqual(_period_bounds(2026), (date(2026, 1, 1), date(2026, 12, 31)))
        clause, params = _travel_period_clause(2026, 't')
        self.assertIn('t.start_date <= %s', clause)
        self.assertIn('t.end_date >= %s', clause)
        self.assertEqual(params, (date(2026, 12, 31), date(2026, 1, 1)))

    def test_country_history_groups_returns_and_single_visit_countries(self):
        rows = [
            {'id': 1, 'name': 'Finland', 'travel_id': 10, 'visit_start': date(2022, 7, 1), 'visit_end': date(2022, 7, 3)},
            {'id': 1, 'name': 'Finland', 'travel_id': 11, 'visit_start': date(2025, 7, 18), 'visit_end': date(2025, 7, 20)},
            {'id': 1, 'name': 'Finland', 'travel_id': 11, 'visit_start': date(2025, 7, 25), 'visit_end': date(2025, 7, 26)},
            {'id': 2, 'name': 'Estonia', 'travel_id': 11, 'visit_start': date(2025, 7, 22), 'visit_end': date(2025, 7, 24)},
        ]
        with patch.object(stats_countries, 'query', return_value=rows):
            history = stats_countries._country_history(2025)

        self.assertEqual(history['summary']['countries'], 2)
        self.assertEqual(history['summary']['active_countries'], 2)
        self.assertEqual(history['summary']['returning_countries'], 1)
        self.assertEqual(history['summary']['single_visit_countries'], 1)
        self.assertEqual(history['summary']['avg_days_per_country'], 4.0)
        self.assertEqual(history['top_returns'][0]['name'], 'Finland')
        self.assertEqual(history['top_returns'][0]['trips'], 2)
        self.assertEqual(history['top_returns'][0]['days_spent'], 8)
        self.assertEqual(history['top_returns'][0]['period_days'], 5)
        self.assertEqual(history['only_once'][0]['name'], 'Estonia')
        self.assertEqual(history['top_returns'][0]['period_trips'], 1)
        self.assertGreater(history['top_returns'][0]['longest_gap_days'], 0)


class SchemaValidationSmokeTests(unittest.TestCase):
    def test_travel_accepts_half_point_ratings_and_normalizes_currency(self):
        travel = TravelCreate(**valid_travel_payload())
        self.assertEqual(travel.rating, 4.5)
        self.assertEqual(travel.currency, 'EUR')

    def test_travel_rejects_invalid_dates_rating_and_amount(self):
        with self.assertRaises(ValidationError):
            TravelCreate(**valid_travel_payload(end_date=date(2025, 7, 17)))
        with self.assertRaises(ValidationError):
            TravelCreate(**valid_travel_payload(rating=4.7))
        with self.assertRaises(ValidationError):
            TravelCreate(**valid_travel_payload(amount=-1))

    def test_location_validation_covers_required_name_and_gps_bounds(self):
        loc = LocationCreate(name=' Helsinki ', country_id=1, location_type_id=2, latitude=60.17, longitude=24.94)
        self.assertEqual(loc.name, 'Helsinki')
        with self.assertRaises(ValidationError):
            LocationCreate(name='', country_id=1, location_type_id=2)
        with self.assertRaises(ValidationError):
            LocationCreate(name='Nowhere', country_id=1, location_type_id=2, latitude=100)

    def test_visit_dates_cannot_end_before_arrival(self):
        with self.assertRaises(ValidationError):
            TravelLocationCreate(
                location_id=1,
                arrival_date=date(2025, 7, 12),
                departure_date=date(2025, 7, 11),
            )


if __name__ == '__main__':
    unittest.main()
