let map = null;
let markerClusterGroup = null;
let allMapLocations = [];
let allMapMarkers = [];
let mapLocationsLoaded = false;
let mapLocationsLoadPromise = null;
let pendingMapLocationIds = null;
let pendingMapRoute = null;
let mapRouteLayer = null;
let activeTravelMapRoute = null;
let activeTravelMapDay = 'all';

const MAP_COLLATOR = typeof Intl !== 'undefined' && Intl.Collator
  ? new Intl.Collator('pl', { sensitivity: 'base' })
  : null;

async function getMapLocationsData() {
  if (mapLocationsLoaded) return allMapLocations;
  if (mapLocationsLoadPromise) return mapLocationsLoadPromise;
  mapLocationsLoadPromise = api('/api/map-locations').then(data => {
    if (Array.isArray(data)) {
      allMapLocations = data;
      mapLocationsLoaded = true;
    }
    return data;
  }).finally(() => {
    mapLocationsLoadPromise = null;
  });
  return mapLocationsLoadPromise;
}

registerDataCacheInvalidator(() => {
  allMapLocations = [];
  allMapMarkers = [];
  mapLocationsLoaded = false;
  mapLocationsLoadPromise = null;
});

function compareMapText(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  return MAP_COLLATOR
    ? MAP_COLLATOR.compare(left, right)
    : left.localeCompare(right, 'pl', { sensitivity: 'base' });
}

function createColorIcon(locationType) {
  const type = (locationType || '').toLowerCase();
  const color = MAP_TYPE_COLORS[type] || MAP_TYPE_COLORS['default'];
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<svg width="26" height="38" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5.5" fill="#fff" opacity="0.9"/>
    </svg>`,
    iconSize: [26, 38], iconAnchor: [13, 38], popupAnchor: [0, -38]
  });
}

function createTravelRouteIcon(order) {
  return L.divIcon({
    className: 'travel-route-map-pin',
    html: `<span>${order}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

function renderMap() {
  const view = document.getElementById('view');
  setMapViewMode(true);
  resetViewScroll(view);
  view.innerHTML = `
    <div class="map-screen-shell">
    <div id="map-toolbar">
      <div class="map-toolbar-left">
        <h2>🗺️ Mapa</h2>
        <span id="map-counter" class="map-badge">…</span>
      </div>
      <div class="map-toolbar-right">
        <select class="filter-select map-filter-select" id="map-filter-type" onchange="filterMapMarkers()"><option value="">Wszystkie typy</option></select>
        <select class="filter-select map-filter-select" id="map-filter-country" onchange="filterMapMarkers()"><option value="">Wszystkie kraje</option></select>
        <button onclick="goHome()" class="icon-button map-btn" title="Pokaż dom">🏠</button>
        <button onclick="resetMapView()" class="icon-button map-btn" title="Pokaż wszystkie">🔄</button>
      </div>
    </div>
    <div id="map-route-banner" class="map-route-banner" hidden></div>
    <div id="map-container"></div>
    <div id="map-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#e74c3c"></span>Miasto</span>
      <span class="legend-item"><span class="legend-dot" style="background:#3498db"></span>Wyspa</span>
      <span class="legend-item"><span class="legend-dot" style="background:#2ecc71"></span>Region</span>
      <span class="legend-item"><span class="legend-dot" style="background:#f39c12"></span>Inne</span>
    </div>
    </div>`;
  initMap();
  loadMapLocations();
}

function initMap() {
  if (map) { map.remove(); map = null; }
  map = L.map('map-container', { center: [50, 15], zoom: 4, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>', maxZoom: 18
  }).addTo(map);
  markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true, showCoverageOnHover: false, zoomToBoundsOnClick: true });
  map.addLayer(markerClusterGroup);
  mapRouteLayer = L.layerGroup().addTo(map);
  setTimeout(() => { if (map) map.invalidateSize(); }, 0);
}

async function loadMapLocations() {
  try {
    const data = await getMapLocationsData();
    if (!Array.isArray(data)) {
      toastApiError(data, 'Nie udało się wczytać miejsc na mapie');
      document.getElementById('map-counter').textContent = 'błąd';
      return;
    }
    buildMapFilters(allMapLocations);
    if (allMapMarkers.length !== allMapLocations.length) {
      buildMapMarkerCache(allMapLocations);
    }
    if (pendingMapRoute) {
      const route = pendingMapRoute;
      pendingMapRoute = null;
      renderTravelMapRoute(route);
    } else if (pendingMapLocationIds) {
      const ids = pendingMapLocationIds;
      pendingMapLocationIds = null;
      const filtered = allMapLocations.filter(l => ids.includes(l.id));
      renderMapMarkers(filtered.length ? filtered : allMapLocations);
      if ((filtered.length || allMapLocations.length) > 0) fitMapToMarkers();
    } else {
      renderMapMarkers(allMapLocations);
      if (allMapLocations.length > 0) fitMapToMarkers();
      else document.getElementById('map-counter').textContent = '0 miejsc';
    }
  } catch (err) {
    console.error('Błąd mapy:', err);
    document.getElementById('map-counter').textContent = 'błąd';
  }
}

function showTravelOnMap(locationIds) {
  pendingMapLocationIds = locationIds;
  showTab('map');
}

function showTravelRouteOnMap(encodedRoute) {
  try {
    pendingMapRoute = JSON.parse(decodeURIComponent(encodedRoute));
    pendingMapLocationIds = null;
    showTab('map');
  } catch (err) {
    console.error('Błąd danych trasy:', err);
    toast('Nie udało się otworzyć trasy na mapie', 'error');
  }
}

function buildMapFilters(locations) {
  const types = [...new Set(locations.map(l => l.location_type).filter(Boolean))].sort(compareMapText);
  const countries = [...new Set(locations.map(l => l.country_name).filter(Boolean))].sort(compareMapText);
  document.getElementById('map-filter-type').innerHTML =
    renderSelectOptions(types, '', { emptyOption: 'Wszystkie typy' });
  document.getElementById('map-filter-country').innerHTML =
    renderSelectOptions(countries, '', { emptyOption: 'Wszystkie kraje' });
}

function createMapMarker(loc) {
  const icon = createColorIcon(loc.location_type);
  const marker = L.marker([loc.latitude, loc.longitude], { icon }).bindPopup(createMapPopup(loc), {
    maxWidth: 280,
    maxHeight: 220,
    keepInView: true,
    autoPanPadding: [18, 18],
  });
  marker._locData = loc;
  return marker;
}

function buildMapMarkerCache(locations) {
  allMapMarkers = (locations || []).map(createMapMarker);
}

function renderCachedMapMarkers(markers) {
  clearTravelMapRoute();
  markerClusterGroup.clearLayers();
  if (markerClusterGroup.addLayers) markerClusterGroup.addLayers(markers);
  else markers.forEach(marker => markerClusterGroup.addLayer(marker));
  document.getElementById('map-counter').textContent = markers.length + ' miejsc';
}

function renderMapMarkers(locations) {
  const locationIds = new Set((locations || []).map(loc => loc.id));
  const markers = locationIds.size === allMapMarkers.length
    ? allMapMarkers
    : allMapMarkers.filter(marker => locationIds.has(marker._locData.id));
  renderCachedMapMarkers(markers);
}

function createMapPopup(loc) {
  const visits = loc.visit_count || 0;
  const vw = visits === 1 ? 'wizyta' : (visits < 5 ? 'wizyty' : 'wizyt');
  let h = `<div class="map-popup"><h3>${escapeHtml(loc.name)}</h3>`;
  h += `<div class="popup-meta">📍 ${escapeHtml(loc.country_name)} · ${escapeHtml(loc.location_type)}</div>`;
  if (visits > 0) {
    h += `<div class="popup-visits">🧳 ${visits} ${vw}`;
    if (loc.first_visit) {
      const fy = String(loc.first_visit).substring(0,4);
      const ly = loc.last_visit ? String(loc.last_visit).substring(0,4) : fy;
      h += ` (${fy}${ly !== fy ? '–'+ly : ''})`;
    }
    h += `</div>`;
  }
  if (loc.travel_names) h += `<div class="popup-travels">Podróże: ${escapeHtml(loc.travel_names)}</div>`;
  if (loc.address) h += `<div class="popup-description"><span aria-hidden="true">📫</span><span class="popup-description-text">${escapeHtml(loc.address)}</span></div>`;
  h += `<a class="popup-link" onclick="openLocation(${loc.id})">Szczegóły →</a></div>`;
  return h;
}

function createTravelRoutePopup(loc, stop, order) {
  const dateLabel = stop.arrival_date
    ? (stop.departure_date && stop.departure_date !== stop.arrival_date
      ? `${fmtDate(stop.arrival_date)} – ${fmtDate(stop.departure_date)}`
      : fmtDate(stop.arrival_date))
    : 'bez daty wizyty';
  return `<div class="map-popup travel-route-popup">
    <div class="popup-route-step">Etap ${order} · ${escapeHtml(dateLabel)}</div>
    <h3>${escapeHtml(loc.name)}</h3>
    <div class="popup-meta">📍 ${escapeHtml(loc.country_name)} · ${escapeHtml(loc.location_type)}</div>
    ${loc.address ? `<div class="popup-description"><span aria-hidden="true">📫</span><span class="popup-description-text">${escapeHtml(loc.address)}</span></div>` : ''}
    <a class="popup-link" onclick="openLocation(${loc.id})">Szczegóły →</a>
  </div>`;
}

function clearTravelMapRoute({ hideBanner = true } = {}) {
  if (mapRouteLayer) mapRouteLayer.clearLayers();
  const banner = document.getElementById('map-route-banner');
  if (banner && hideBanner) {
    banner.hidden = true;
    banner.innerHTML = '';
  }
}

function travelRouteDayKey(stop) {
  return stop?.arrival_date || 'no-date';
}

function travelRouteDayMeta(route, dayKey) {
  if (dayKey === 'all') {
    return {
      key: 'all',
      label: 'Wszystkie',
      dateLabel: travelRouteDateLabel(route),
    };
  }
  if (dayKey === 'no-date') {
    return { key: dayKey, label: 'Bez daty', dateLabel: '' };
  }
  const dayNumber = route?.start_date ? daysCount(route.start_date, dayKey) : 0;
  return {
    key: dayKey,
    label: dayNumber > 0 ? `Dzień ${dayNumber}` : fmtDate(dayKey),
    dateLabel: fmtDate(dayKey),
  };
}

function travelRouteDayOptions(route) {
  const keys = [];
  const seen = new Set();
  (route?.stops || []).forEach(stop => {
    const key = travelRouteDayKey(stop);
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  return keys.map(key => travelRouteDayMeta(route, key));
}

function renderTravelRouteDayFilters(route, selectedDayKey) {
  const options = travelRouteDayOptions(route);
  if (options.length < 2) return '';
  const allOptions = [travelRouteDayMeta(route, 'all'), ...options];
  return `<div class="map-route-days" role="group" aria-label="Pokaż dzień podróży">
    ${allOptions.map(option => {
      const active = option.key === selectedDayKey;
      return `<button type="button" class="map-route-day${active ? ' active' : ''}"
        aria-pressed="${active ? 'true' : 'false'}"
        onclick="filterTravelMapRouteDay('${escapeAttr(option.key)}')">
        <strong>${escapeHtml(option.label)}</strong>
        ${option.key !== 'all' && option.dateLabel ? `<span>${escapeHtml(option.dateLabel)}</span>` : ''}
      </button>`;
    }).join('')}
  </div>`;
}

function travelRouteDateLabel(route) {
  if (!route?.start_date) return '';
  if (route.end_date && route.end_date !== route.start_date) {
    return `${fmtDate(route.start_date)} – ${fmtDate(route.end_date)}`;
  }
  return fmtDate(route.start_date);
}

function renderTravelMapRoute(route, selectedDayKey = 'all') {
  activeTravelMapRoute = route;
  activeTravelMapDay = selectedDayKey;
  clearTravelMapRoute({ hideBanner: false });
  markerClusterGroup.clearLayers();

  const locationsById = new Map(allMapLocations.map(location => [Number(location.id), location]));
  const orderedStops = (route.stops || []).map((stop, index) => {
    const location = locationsById.get(Number(stop.location_id));
    return { ...stop, location: location || null, order: index + 1 };
  });
  const selectedStops = selectedDayKey === 'all'
    ? orderedStops
    : orderedStops.filter(stop => travelRouteDayKey(stop) === selectedDayKey);
  const stops = selectedStops.filter(stop => stop.location);
  const coordinates = stops.map(stop => [
    Number(stop.location.latitude),
    Number(stop.location.longitude),
  ]);

  stops.forEach(stop => {
    L.marker(
      [Number(stop.location.latitude), Number(stop.location.longitude)],
      {
        icon: createTravelRouteIcon(stop.order),
        zIndexOffset: 100000 + (stop.order * 1000),
        riseOnHover: true,
        riseOffset: 100000,
      },
    )
      .bindPopup(createTravelRoutePopup(stop.location, stop, stop.order), {
        maxWidth: 280,
        maxHeight: 220,
        keepInView: true,
        autoPanPadding: [18, 18],
      })
      .addTo(mapRouteLayer);
  });

  const totalStops = selectedStops.length;
  const missingGps = Math.max(0, totalStops - stops.length);
  const selectedDay = travelRouteDayMeta(route, selectedDayKey);
  const routeDate = selectedDayKey === 'all'
    ? selectedDay.dateLabel
    : [selectedDay.label, selectedDay.dateLabel].filter(Boolean).join(' · ');
  const banner = document.getElementById('map-route-banner');
  if (banner) {
    banner.hidden = false;
    banner.innerHTML = `<div class="map-route-banner-top">
      <div class="map-route-banner-main">
        <span class="map-route-banner-icon">🧭</span>
        <div>
          <strong>${escapeHtml(route.name || 'Trasa podróży')}</strong>
          <span>${escapeHtml(routeDate)}${routeDate ? ' · ' : ''}${totalStops} ${polishPlural(totalStops, 'etap', 'etapy', 'etapów')}${missingGps ? ` · ${missingGps} bez GPS` : ''}</span>
        </div>
      </div>
      <button type="button" class="map-route-close" onclick="showAllMapLocations()">Wszystkie miejsca</button>
    </div>
    ${renderTravelRouteDayFilters(route, selectedDayKey)}`;
  }
  document.getElementById('map-counter').textContent =
    `${stops.length}/${totalStops} ${polishPlural(totalStops, 'etap', 'etapy', 'etapów')}`;

  if (coordinates.length > 1) {
    map.fitBounds(L.latLngBounds(coordinates), { padding: [42, 42], maxZoom: 12 });
  } else if (coordinates.length === 1) {
    map.setView(coordinates[0], 12);
  } else {
    document.getElementById('map-counter').textContent = 'brak GPS';
  }
}

function filterTravelMapRouteDay(dayKey) {
  if (!activeTravelMapRoute) return;
  const selectedDayKey = dayKey || 'all';
  if (selectedDayKey === activeTravelMapDay) return;
  renderTravelMapRoute(activeTravelMapRoute, selectedDayKey);
}

function showAllMapLocations() {
  activeTravelMapRoute = null;
  activeTravelMapDay = 'all';
  clearTravelMapRoute();
  renderCachedMapMarkers(allMapMarkers);
  if (allMapLocations.length > 0) fitMapToMarkers();
}

function filterMapMarkers() {
  const st = document.getElementById('map-filter-type').value;
  const sc = document.getElementById('map-filter-country').value;
  const markers = allMapMarkers.filter(marker => {
    const loc = marker._locData;
    return (!st || loc.location_type === st) && (!sc || loc.country_name === sc);
  });
  renderCachedMapMarkers(markers);
  if (markers.length > 0) fitMapToMarkers();
}

function fitMapToMarkers() {
  const b = markerClusterGroup.getBounds();
  if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 12 });
}

function resetMapView() {
  document.getElementById('map-filter-type').value = '';
  document.getElementById('map-filter-country').value = '';
  showAllMapLocations();
}

function goHome() {
  if (map) map.setView(HOME_COORDS, HOME_ZOOM);
}
