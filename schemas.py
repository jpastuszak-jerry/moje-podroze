"""Pydantic — schematy walidacji wejścia dla całego API."""

import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, field_validator


def _blank_to_none(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


class TravelCreate(BaseModel):
    name: str = ''
    start_date: date
    end_date: date
    purpose: str = ''
    has_photo_album: bool = False
    amount: float = 0
    currency: str = 'PLN'
    is_description_complete: bool = False
    rating: Optional[float] = None
    reflections: Optional[str] = None
    notes: Optional[str] = None
    number_of_flights: int = 0

    @field_validator('rating', mode='before')
    @classmethod
    def _rating_falsy_to_none(cls, v):
        return v if v not in (None, '', 0, '0') else None

    @field_validator('rating')
    @classmethod
    def _rating_range(cls, v):
        if v is None:
            return v
        if not (0.5 <= v <= 5):
            raise ValueError('rating musi być z zakresu 0.5–5.0')
        # krok 0.5 — zaokrąglij do 1 miejsca po przecinku i sprawdź
        rounded = round(v * 2) / 2
        if abs(rounded - v) > 1e-6:
            raise ValueError('rating musi być wielokrotnością 0.5')
        return rounded

    @field_validator('reflections', 'notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)

    @field_validator('end_date')
    @classmethod
    def _end_after_start(cls, v, info):
        start = info.data.get('start_date')
        if start and v < start:
            raise ValueError('end_date nie może być wcześniejsza niż start_date')
        return v

    @field_validator('amount')
    @classmethod
    def _amount_non_negative(cls, v):
        if v < 0:
            raise ValueError('amount nie może być ujemna')
        return v

    @field_validator('currency', mode='before')
    @classmethod
    def _currency_clean(cls, v):
        if v is None or str(v).strip() == '':
            return 'PLN'
        s = str(v).strip().upper()
        if not re.fullmatch(r'[A-Z]{3}', s):
            raise ValueError('currency musi być 3-literowym kodem ISO (np. PLN, EUR, USD)')
        return s


class LocationBase(BaseModel):
    name: str
    country_id: int
    location_type_id: int
    parent_location_id: Optional[int] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Podaj nazwę miejsca')
        return s

    @field_validator('address', 'notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)

    @field_validator('latitude')
    @classmethod
    def _lat_bounds(cls, v):
        if v is not None and not (-90 <= v <= 90):
            raise ValueError('latitude musi być w zakresie -90 do 90')
        return v

    @field_validator('longitude')
    @classmethod
    def _lon_bounds(cls, v):
        if v is not None and not (-180 <= v <= 180):
            raise ValueError('longitude musi być w zakresie -180 do 180')
        return v


class LocationCreate(LocationBase):
    force_duplicate: bool = False


class TravelUpdate(TravelCreate):
    """Aktualizacja podróży = wszystkie pola TravelCreate + opcjonalna strategia konfliktu dat."""
    on_conflict: Optional[Literal['clip', 'ignore']] = None


class LocationUpdate(LocationBase):
    """Aktualizacja lokacji = wszystkie pola LocationBase (bez force_duplicate)."""
    pass


class _TravelLocationFields(BaseModel):
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    notes: Optional[str] = None
    force_outside_range: bool = False

    @field_validator('notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)

    @field_validator('departure_date')
    @classmethod
    def _depart_after_arrival(cls, v, info):
        a = info.data.get('arrival_date')
        if v and a and v < a:
            raise ValueError('departure_date nie może być wcześniej niż arrival_date')
        return v


class TravelLocationCreate(_TravelLocationFields):
    location_id: int


class TravelLocationUpdate(_TravelLocationFields):
    pass


class ParticipantAdd(BaseModel):
    person_id: int


class PersonInput(BaseModel):
    name: str
    relation_type_id: Optional[int] = None

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Podaj imię i nazwisko')
        return s


class DictItem(BaseModel):
    name: str

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Nazwa wymagana')
        return s
