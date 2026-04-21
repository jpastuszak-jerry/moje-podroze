let map = null;
let markerClusterGroup = null;
let allMapLocations = [];
let allMapMarkers = [];
let pendingMapLocationIds = null;

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

function renderMap() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div id="map-toolbar">
      <div class="map-toolbar-left">
        <h2>🗺️ Mapa</h2>
        <span id="map-counter" class="map-badge">…</span>
      </div>
      <div class="map-toolbar-right">
        <select id="map-filter-type" onchange="filterMapMarkers()"><option value="">Wszystkie typy</option></select>
        <select id="map-filter-country" onchange="filterMapMarkers()"><option value="">Wszystkie kraje</option></select>
        <button onclick="resetMapView()" class="map-btn">🔄</button>
      </div>
    </div>
    <div id="map-container"></div>
    <div id="map-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#e74c3c"></span>Miasto</span>
      <span class="legend-item"><span class="legend-dot" style="background:#3498db"></span>Wyspa</span>
      <span class="legend-item"><span class="legend-dot" style="background:#2ecc71"></span>Region</span>
      <span class="legend-item"><span class="legend-dot" style="background:#f39c12"></span>Inne</span>
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
}

async function loadMapLocations() {
  try {
    const res = await fetch('/api/map-locations');
    allMapLocations = await res.json();
    buildMapFilters(allMapLocations);
    if (pendingMapLocationIds) {
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

function buildMapFilters(locations) {
  const types = [...new Set(locations.map(l => l.location_type))].sort();
  const countries = [...new Set(locations.map(l => l.country_name))].sort();
  document.getElementById('map-filter-type').innerHTML =
    '<option value="">Wszystkie typy</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('map-filter-country').innerHTML =
    '<option value="">Wszystkie kraje</option>' + countries.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderMapMarkers(locations) {
  markerClusterGroup.clearLayers(); allMapMarkers = [];
  locations.forEach(loc => {
    const icon = createColorIcon(loc.location_type);
    const marker = L.marker([loc.latitude, loc.longitude], { icon }).bindPopup(createMapPopup(loc), { maxWidth: 280 });
    marker._locData = loc; allMapMarkers.push(marker); markerClusterGroup.addLayer(marker);
  });
  document.getElementById('map-counter').textContent = locations.length + ' miejsc';
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
  if (loc.address) h += `<div class="popup-meta" style="margin-top:3px">📫 ${escapeHtml(loc.address)}</div>`;
  h += `<a class="popup-link" onclick="openLocation(${loc.id})">Szczegóły →</a></div>`;
  return h;
}

function filterMapMarkers() {
  const st = document.getElementById('map-filter-type').value;
  const sc = document.getElementById('map-filter-country').value;
  const filtered = allMapLocations.filter(l => (!st || l.location_type === st) && (!sc || l.country_name === sc));
  renderMapMarkers(filtered);
  if (filtered.length > 0) fitMapToMarkers();
}

function fitMapToMarkers() {
  const b = markerClusterGroup.getBounds();
  if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 12 });
}

function resetMapView() {
  document.getElementById('map-filter-type').value = '';
  document.getElementById('map-filter-country').value = '';
  renderMapMarkers(allMapLocations);
  if (allMapLocations.length > 0) fitMapToMarkers();
}
