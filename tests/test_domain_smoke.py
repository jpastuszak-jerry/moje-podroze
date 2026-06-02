import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from pydantic import ValidationError

from schemas import LocationCreate, TravelCreate, TravelLocationCreate
import stats_countries
import stats_quality
import stats_yearbook
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
            {
                'id': 1,
                'name': 'Finland',
                'travel_id': 10,
                'location_id': 100,
                'location_name': 'Helsinki',
                'location_type': 'miasto',
                'visit_start': date(2022, 7, 1),
                'visit_end': date(2022, 7, 3),
            },
            {
                'id': 1,
                'name': 'Finland',
                'travel_id': 11,
                'location_id': 100,
                'location_name': 'Helsinki',
                'location_type': 'miasto',
                'visit_start': date(2025, 7, 18),
                'visit_end': date(2025, 7, 20),
            },
            {
                'id': 1,
                'name': 'Finland',
                'travel_id': 11,
                'location_id': 101,
                'location_name': 'Saimaa',
                'location_type': 'jezioro',
                'visit_start': date(2025, 7, 25),
                'visit_end': date(2025, 7, 26),
            },
            {
                'id': 2,
                'name': 'Estonia',
                'travel_id': 11,
                'location_id': 200,
                'location_name': 'Tallinn',
                'location_type': 'miasto',
                'visit_start': date(2025, 7, 22),
                'visit_end': date(2025, 7, 24),
            },
        ]
        with patch.object(stats_countries, 'query', return_value=rows):
            history = stats_countries._country_history(2025)

        self.assertEqual(history['summary']['countries'], 2)
        self.assertEqual(history['summary']['active_countries'], 2)
        self.assertEqual(history['summary']['returning_countries'], 1)
        self.assertEqual(history['summary']['single_visit_countries'], 1)
        self.assertEqual(history['summary']['locations'], 3)
        self.assertEqual(history['summary']['location_types'], 2)
        self.assertEqual(history['summary']['avg_days_per_country'], 4.0)
        self.assertEqual(history['top_returns'][0]['name'], 'Finland')
        self.assertEqual(history['top_returns'][0]['trips'], 2)
        self.assertEqual(history['top_returns'][0]['days_spent'], 8)
        self.assertEqual(history['top_returns'][0]['period_days'], 5)
        self.assertEqual(history['top_returns'][0]['location_count'], 2)
        self.assertEqual(history['top_returns'][0]['period_location_count'], 2)
        self.assertEqual(history['top_returns'][0]['location_types'][0]['location_type'], 'miasto')
        self.assertEqual(history['top_time_countries'][0]['name'], 'Finland')
        self.assertEqual(history['top_location_countries'][0]['name'], 'Finland')
        self.assertEqual(history['top_location_types'][0]['location_type'], 'miasto')
        self.assertEqual(history['top_location_types'][0]['locations'], 2)
        self.assertEqual(history['longest_places'][0]['name'], 'Helsinki')
        self.assertEqual(history['longest_places'][0]['days_spent'], 3)
        self.assertEqual(history['only_once'][0]['name'], 'Estonia')
        self.assertEqual(history['top_returns'][0]['period_trips'], 1)
        self.assertGreater(history['top_returns'][0]['longest_gap_days'], 0)

    def test_yearbook_builds_year_chapters_and_highlights(self):
        summary_rows = [
            {'year': 2025, 'trips': 2, 'days': 12, 'countries': 2},
            {'year': 2024, 'trips': 1, 'days': 3, 'countries': 1},
        ]
        trip_rows = [
            {
                'year': 2025,
                'id': 1,
                'name': 'Helsinki',
                'start_date': date(2025, 7, 18),
                'end_date': date(2025, 7, 28),
                'purpose': 'Wakacje',
                'rating': 4.5,
                'amount': 1000,
                'currency': 'EUR',
                'days': 11,
            },
            {
                'year': 2025,
                'id': 2,
                'name': 'Tallinn',
                'start_date': date(2025, 9, 1),
                'end_date': date(2025, 9, 1),
                'purpose': 'Miasto',
                'rating': 5,
                'amount': 200,
                'currency': 'EUR',
                'days': 1,
            },
            {
                'year': 2024,
                'id': 3,
                'name': 'Praga',
                'start_date': date(2024, 5, 1),
                'end_date': date(2024, 5, 3),
                'purpose': 'Weekend',
                'rating': None,
                'amount': 0,
                'currency': 'PLN',
                'days': 3,
            },
        ]
        month_rows = [
            {'year': 2025, 'month': 7, 'days': 11},
            {'year': 2025, 'month': 9, 'days': 1},
            {'year': 2024, 'month': 5, 'days': 3},
        ]
        country_rows = [
            {'year': 2025, 'id': 10, 'name': 'Finland', 'first_visit': date(2025, 7, 18), 'trips': 1},
            {'year': 2025, 'id': 11, 'name': 'Estonia', 'first_visit': date(2023, 6, 1), 'trips': 2},
            {'year': 2024, 'id': 12, 'name': 'Czechy', 'first_visit': date(2024, 5, 1), 'trips': 1},
        ]

        with patch.object(stats_yearbook, 'query', side_effect=[summary_rows, trip_rows, month_rows, country_rows]):
            yearbook = stats_yearbook._yearbook()

        self.assertEqual([chapter['year'] for chapter in yearbook], [2025, 2024])
        chapter = yearbook[0]
        self.assertEqual(chapter['days'], 12)
        self.assertEqual(chapter['top_month'], {'month': 7, 'days': 11})
        self.assertEqual(chapter['highlights']['longest']['name'], 'Helsinki')
        self.assertEqual(chapter['highlights']['best_rated']['name'], 'Tallinn')
        self.assertEqual(chapter['highlights']['priciest']['currency'], 'EUR')
        self.assertEqual(chapter['new_countries'][0]['name'], 'Finland')
        self.assertEqual(chapter['returning_countries'][0]['name'], 'Estonia')
        self.assertEqual(chapter['trips_list'][0]['id'], 1)


class DataQualitySmokeTests(unittest.TestCase):
    def test_data_quality_counts_missing_fields_and_respects_limit(self):
        rows = [
            {
                'id': 1,
                'name': 'Complete trip',
                'start_date': date(2025, 7, 18),
                'amount': 100,
                'rating': 4.5,
                'loc_count': 1,
                'reflections': 'ok',
                'has_photo_album': True,
                'is_description_complete': True,
            },
            {
                'id': 2,
                'name': None,
                'start_date': date(2025, 8, 1),
                'amount': None,
                'rating': None,
                'loc_count': 0,
                'reflections': '',
                'has_photo_album': False,
                'is_description_complete': False,
            },
        ]

        with patch.object(stats_quality, 'query', return_value=rows):
            quality = stats_quality._data_quality(2025, limit=1)

        self.assertEqual(quality['total'], 2)
        self.assertEqual(quality['counts']['missing_cost'], 1)
        self.assertEqual(quality['counts']['missing_rating'], 1)
        self.assertEqual(quality['counts']['missing_locations'], 1)
        self.assertEqual(quality['counts']['missing_reflections'], 1)
        self.assertEqual(quality['counts']['missing_album'], 1)
        self.assertEqual(quality['counts']['incomplete_description'], 1)
        self.assertEqual(len(quality['needs_attention']), 1)
        self.assertEqual(quality['needs_attention'][0]['id'], 2)
        self.assertEqual(quality['needs_attention'][0]['name'], '(bez nazwy)')
        self.assertEqual(quality['labels']['missing_reflections'], 'brak wspomnień')


class SchemaValidationSmokeTests(unittest.TestCase):
    def test_travel_accepts_half_point_ratings_and_normalizes_currency(self):
        travel = TravelCreate(**valid_travel_payload())
        self.assertEqual(travel.rating, 4.5)
        self.assertEqual(travel.currency, 'EUR')
        self.assertEqual(travel.amount, Decimal('1000.00'))

        travel_with_cents = TravelCreate(**valid_travel_payload(amount='123.455'))
        self.assertEqual(travel_with_cents.amount, Decimal('123.46'))

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
