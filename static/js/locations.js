async function renderLocations(q = '') {
  const view = document.getElementById('view');
  if (!document.getElementById('loc-list')) {
    view.innerHTML = `
      <div class="page-header"><div class="page-title">Miejsca</div>
        <div class="search-box"><input type="search" placeholder="Szukaj miejsca lub kraju..." id="loc-search" oninput="onLocSearch(this.value)"></div>
        <select id="loc-type-filter" onchange="applyLocTypeFilter()" style="width:100%;margin-top:8px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;cursor:pointer">
          <option value="">Wszystkie typy</option>
        </select>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="openDictionaryModal('/api/countries','Kraje')" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text2);font-size:12px;cursor:pointer">🌍 Kraje</button>
          <button onclick="openDictionaryModal('/api/location_types','Typy miejsc')" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text2);font-size:12px;cursor:pointer">📍 Typy miejsc</button>
          <button onclick="openPersonsModal()" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text2);font-size:12px;cursor:pointer">👤 Osoby</button>
        </div></div>
      <div id="loc-list"><div class="spinner"></div></div>
      <button class="fab" onclick="openNewLocationModal()">＋</button>`;
  }
  const list = document.getElementById('loc-list');
  list.innerHTML = '<div class="spinner"></div>';
  const locs = await api('/api/locations' + (q ? '?q='+encodeURIComponent(q) : ''));
  allLocationsCache = locs;
  const filterEl = document.getElementById('loc-type-filter');
  if (filterEl) {
    const selected = filterEl.value;
    const types = [...new Set(locs.map(l => l.location_type))].sort();
    filterEl.innerHTML = '<option value="">Wszystkie typy</option>' + types.map(t => `<option value="${t}"${t===selected?' selected':''}>${t}</option>`).join('');
  }
  renderLocList(locs);
}

function applyLocTypeFilter() {
  const type = document.getElementById('loc-type-filter')?.value || '';
  renderLocList(type ? allLocationsCache.filter(l => l.location_type === type) : allLocationsCache);
}

function renderLocList(locs) {
  const list = document.getElementById('loc-list');
  if (!locs.length) { list.innerHTML = `<div class="empty">Brak wyników</div>`; return; }
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  list.innerHTML = Object.entries(grouped).map(([country, items]) => `
    <div class="country-header">${country}</div>
    <div class="card-list" style="padding-top:4px;padding-bottom:4px">
      ${items.map(l => `<div class="card" onclick="openLocation(${l.id})"><div class="card-inner">
        <div class="card-icon" style="background:var(--blue-light)">${locationIcon(l.location_type)}</div>
        <div class="card-body"><div class="card-title">${l.name}</div><div class="card-subtitle">${l.location_type}</div>
          ${l.address ? `<div class="card-subtitle">${l.address}</div>` : ''}</div>
        <div style="color:var(--text3);font-size:20px;align-self:center">›</div></div></div>`).join('')}
    </div>`).join('');
}

function onLocSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => renderLocations(val), 400); }

async function openLocation(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="spinner"></div>`;
  const loc = await api('/api/locations/' + id);
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="showTab('locations')">‹ Miejsca</button>
      <div class="detail-title">${escapeHtml(loc.name)}</div>
      <div class="detail-sub">${escapeHtml(loc.location_type)} · ${escapeHtml(loc.country_name)}</div>
    </div>
    <div class="detail-body">
      <div class="section"><div class="section-title">Informacje</div>
        <div class="info-grid">
          <div class="info-item"><label>Typ miejsca</label><span>${escapeHtml(loc.location_type)}</span></div>
          <div class="info-item"><label>Kraj</label><span>${escapeHtml(loc.country_name)}</span></div>
          ${loc.parent_name ? `<div class="info-item"><label>Region / miasto</label><span onclick="openLocation(${loc.parent_location_id})" style="color:var(--blue);cursor:pointer">${escapeHtml(loc.parent_name)}</span></div>` : ''}
          <div class="info-item"><label>Liczba wizyt</label><span>${loc.visit_count} ${loc.visit_count === 1 ? 'raz' : 'razy'}</span></div>
          ${loc.address ? `<div class="info-item" style="grid-column:span 2"><label>Adres</label><span>${loc.address}</span></div>` : ''}
          ${(loc.latitude != null && loc.longitude != null) ? `
          <div class="info-item" style="grid-column:span 2">
            <label>Współrzędne GPS</label>
            <span style="font-family:monospace;font-size:13px">
              ${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}
              &nbsp;<a href="https://maps.google.com/?q=${loc.latitude},${loc.longitude}" target="_blank" style="color:var(--blue);font-size:12px;text-decoration:none">📍 Google Maps</a>
            </span>
          </div>` : ''}
        </div>
        ${loc.notes ? `<div style="margin-top:10px"><div class="form-label">Notatki</div><div class="notes-text">${escapeHtml(loc.notes)}</div></div>` : ''}
      </div>
      ${loc.visits && loc.visits.length ? `<div class="section"><div class="section-title">Wizyty bezpośrednie (${loc.visits.length})</div>
        ${loc.visits.map(v => `<div class="loc-row" onclick="openTravel(${v.id})" style="cursor:pointer">
          <div class="loc-icon">✈️</div><div style="flex:1"><div class="loc-name">${escapeHtml(v.travel_name || '(bez nazwy)')}</div>
          <div class="loc-sub">${fmtDate(v.arrival_date)} – ${fmtDate(v.departure_date)}</div>
          ${v.notes ? `<div class="loc-sub" style="font-style:italic">${escapeHtml(v.notes)}</div>` : ''}</div>
          <div style="color:var(--text3);font-size:18px">›</div></div>`).join('')}
      </div>` : `<div class="section"><div class="empty" style="padding:20px">Brak wizyt w bazie</div></div>`}
      ${loc.child_visits && loc.child_visits.length ? `<div class="section"><div class="section-title">Wizyty przez lokalizacje podrzędne (${loc.child_visits.length})</div>
        ${loc.child_visits.map(v => `<div class="loc-row" onclick="openTravel(${v.id})" style="cursor:pointer">
          <div class="loc-icon">📍</div><div style="flex:1">
          <div class="loc-name">${v.travel_name || '(bez nazwy)'}</div>
          <div class="loc-sub">${escapeHtml(v.child_location_name)}</div>
          <div class="loc-sub">${fmtDate(v.arrival_date)} – ${fmtDate(v.departure_date)}</div></div>
          <div style="color:var(--text3);font-size:18px">›</div></div>`).join('')}
      </div>` : ''}
      <button class="delete-btn" onclick="confirmDeleteLocation(${loc.id})">🗑 Usuń miejsce</button>
      <div style="height:12px"></div>
    </div>
    <button class="fab" onclick="openEditLocationModal(${loc.id})">✎</button>`;
}

async function confirmDeleteLocation(id) {
  if (!confirm('Usunąć to miejsce? Tej operacji nie można cofnąć.')) return;
  const res = await apiDelete('/api/locations/' + id);
  if (res.error) { alert(res.error); return; }
  showTab('locations');
}

async function openEditLocationModal(id) {
  const [loc, countries, locTypes, allLocs] = await Promise.all([
    api('/api/locations/' + id),
    api('/api/countries'),
    api('/api/location_types'),
    api('/api/locations')
  ]);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'edit-loc-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Edytuj miejsce</span>
      <button class="modal-save" onclick="document.getElementById('edit-loc-overlay').remove()">Anuluj</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa miejsca *</div>
      <input class="form-input" id="el-name" value="${(loc.name||'').replace(/"/g,'&quot;')}">
      <div class="form-row">
        <div><div class="form-label">Kraj *</div>
          <select class="form-input" id="el-country" onchange="updateParentLocListFor('edit-loc-overlay','el')">
            <option value="">– wybierz –</option>
            ${countries.map(c => `<option value="${c.id}"${c.id===loc.country_id?' selected':''}>${c.name}</option>`).join('')}
          </select></div>
        <div><div class="form-label">Typ miejsca *</div>
          <select class="form-input" id="el-type">
            <option value="">– wybierz –</option>
            ${locTypes.map(t => `<option value="${t.id}"${t.id===loc.location_type_id?' selected':''}>${t.name}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-label">Miejsce nadrzędne (opcjonalnie)</div>
      <select class="form-input" id="el-parent"><option value="">– brak –</option></select>
      <div class="form-label">Adres / opis (opcjonalnie)</div>
      <input class="form-input" id="el-address" value="${(loc.address||'').replace(/"/g,'&quot;')}">
      <div class="form-label">Współrzędne GPS (opcjonalnie)</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input class="form-input" id="el-lat" placeholder="Szer. np. 37.50745" style="margin-bottom:0;flex:1;min-width:0"
          value="${loc.latitude != null ? parseFloat(loc.latitude).toFixed(5) : ''}">
        <input class="form-input" id="el-lng" placeholder="Dług. np. 15.08720" style="margin-bottom:0;flex:1;min-width:0"
          value="${loc.longitude != null ? parseFloat(loc.longitude).toFixed(5) : ''}">
        <button id="el-geocode-btn" onclick="geocodeForLocModal('el')"
          style="background:var(--blue);color:white;border:none;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">🔍</button>
      </div>
      <div id="el-geo-results" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;max-height:200px;overflow-y:auto"></div>
      <div class="form-label">Notatki (opcjonalnie)</div>
      <textarea class="form-input form-textarea" id="el-notes"></textarea>
      <button onclick="saveEditLocation(${id})"
        style="background:var(--blue);color:white;border:none;border-radius:10px;padding:12px;width:100%;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px">
        Zapisz zmiany
      </button>
    </div></div>`;
  overlay._allLocs = allLocs.filter(l => l.id !== id);
  overlay._currentParentId = loc.parent_location_id || null;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('el-notes').value = loc.notes || '';
  updateParentLocListFor('edit-loc-overlay', 'el');
}

async function geocodeForLocModal(prefix) {
  const name = document.getElementById(prefix+'-name').value.trim();
  const cSel = document.getElementById(prefix+'-country');
  const country = cSel.options[cSel.selectedIndex]?.text || '';
  if (!name) { alert('Najpierw podaj nazwę miejsca'); return; }
  const btn = document.getElementById(prefix+'-geocode-btn');
  const resultsDiv = document.getElementById(prefix+'-geo-results');
  btn.textContent = '⏳'; btn.disabled = true; btn.style.background = '';
  resultsDiv.style.display = 'none'; resultsDiv.innerHTML = '';
  try {
    const q = encodeURIComponent(country && country !== '– wybierz –' ? name + ', ' + country : name);
    const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + q + '&format=json&limit=5',
      { headers: {'Accept-Language':'pl,en'} });
    const data = await res.json();
    if (data.length === 0) {
      btn.textContent = '✗ Nie znaleziono'; btn.style.background = 'var(--red)';
      setTimeout(() => { btn.textContent = '🔍'; btn.style.background = ''; btn.disabled = false; }, 2500);
    } else if (data.length === 1) {
      document.getElementById(prefix+'-lat').value = parseFloat(data[0].lat).toFixed(5);
      document.getElementById(prefix+'-lng').value = parseFloat(data[0].lon).toFixed(5);
      btn.textContent = '✓'; btn.style.background = 'var(--green)'; btn.disabled = false;
    } else {
      btn.textContent = '🔍'; btn.style.background = ''; btn.disabled = false;
      resultsDiv.innerHTML = data.map(r => `
        <div onclick="selectGeoResult('${prefix}',${parseFloat(r.lat).toFixed(5)},${parseFloat(r.lon).toFixed(5)})"
          style="padding:9px 12px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px;color:var(--text);line-height:1.4">
          ${r.display_name}
        </div>`).join('');
      resultsDiv.style.display = 'block';
    }
  } catch(e) {
    btn.textContent = '✗ Błąd'; btn.style.background = 'var(--red)';
    setTimeout(() => { btn.textContent = '🔍'; btn.style.background = ''; btn.disabled = false; }, 2500);
  }
}

function selectGeoResult(prefix, lat, lng) {
  document.getElementById(prefix+'-lat').value = lat;
  document.getElementById(prefix+'-lng').value = lng;
  const resultsDiv = document.getElementById(prefix+'-geo-results');
  resultsDiv.style.display = 'none'; resultsDiv.innerHTML = '';
  const btn = document.getElementById(prefix+'-geocode-btn');
  btn.textContent = '✓'; btn.style.background = 'var(--green)';
}

function updateParentLocListFor(overlayId, prefix) {
  const overlay = document.getElementById(overlayId); if (!overlay) return;
  const countryId = parseInt(document.getElementById(prefix+'-country').value) || null;
  const allLocs = overlay._allLocs || [];
  const currentParentId = overlay._currentParentId || null;
  const cSel = document.getElementById(prefix+'-country');
  const countryName = countryId ? (cSel.options[cSel.selectedIndex]?.text || null) : null;
  const filtered = countryName ? allLocs.filter(l => l.country_name === countryName) : [];
  document.getElementById(prefix+'-parent').innerHTML = '<option value="">– brak –</option>' +
    filtered.map(l => `<option value="${l.id}"${l.id === currentParentId ? ' selected' : ''}>${l.name} (${l.location_type})</option>`).join('');
}

async function saveEditLocation(id) {
  try {
    const name = document.getElementById('el-name').value.trim();
    const countryId = document.getElementById('el-country').value;
    const typeId = document.getElementById('el-type').value;
    const parentId = document.getElementById('el-parent').value;
    const address = document.getElementById('el-address').value.trim();
    const notes = document.getElementById('el-notes').value.trim();
    if (!name) { alert('Podaj nazwę miejsca!'); return; }
    if (!countryId) { alert('Wybierz kraj!'); return; }
    if (!typeId) { alert('Wybierz typ miejsca!'); return; }
    const latVal = parseFloat(document.getElementById('el-lat').value) || null;
    const lngVal = parseFloat(document.getElementById('el-lng').value) || null;
    const res = await apiPut('/api/locations/' + id, {
      name, country_id: parseInt(countryId), location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null, notes: notes || null, latitude: latVal, longitude: lngVal
    });
    if (res.error) { alert('Błąd: ' + res.error); return; }
    document.getElementById('edit-loc-overlay').remove();
    openLocation(id);
  } catch(err) { alert('Nieoczekiwany błąd: ' + err.message); }
}

async function removeLocationFromTravel(travelId, tlid) {
  if (!confirm('Usunąć to miejsce z podróży?')) return;
  await apiDelete(`/api/travels/${travelId}/locations/${tlid}`);
  const row = document.getElementById('tl-' + tlid); if (row) row.remove();
  const list = document.getElementById('locations-list');
  if (list && !list.querySelector('.loc-row')) list.innerHTML = `<div class="empty-locs" style="color:var(--text3);font-size:13px;padding:4px 0">Brak miejsc</div>`;
}

function openEditTravelLocation(travelId, tlid) {
  const row = document.getElementById('tl-' + tlid);
  const arrival = row.dataset.arrival || '';
  const departure = row.dataset.departure || '';
  const notes = row.dataset.notes || '';
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'edit-tl-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Edytuj pobyt</span>
      <button class="modal-save" onclick="document.getElementById('edit-tl-overlay').remove()">Anuluj</button></div>
    <div class="form-section">
      <div class="form-row">
        <div><div class="form-label">Przyjazd</div><input class="form-input" type="date" id="etl-arrival" value="${arrival}"></div>
        <div><div class="form-label">Wyjazd</div><input class="form-input" type="date" id="etl-departure" value="${departure}"></div>
      </div>
      <div class="form-label">Notatka</div>
      <input class="form-input" id="etl-notes" value="${notes.replace(/"/g,'&quot;')}">
      <button onclick="saveEditTravelLocation(${travelId}, ${tlid})"
        style="background:var(--blue);color:white;border:none;border-radius:10px;padding:12px;width:100%;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px">
        Zapisz zmiany
      </button>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function saveEditTravelLocation(travelId, tlid) {
  const arrival = document.getElementById('etl-arrival').value || null;
  const departure = document.getElementById('etl-departure').value || null;
  const notes = document.getElementById('etl-notes').value.trim() || null;
  const res = await apiPut(`/api/travels/${travelId}/locations/${tlid}`, { arrival_date: arrival, departure_date: departure, notes });
  if (res.error) { alert('Błąd: ' + res.error); return; }
  document.getElementById('edit-tl-overlay').remove();
  const row = document.getElementById('tl-' + tlid);
  if (row) {
    row.dataset.arrival = arrival || '';
    row.dataset.departure = departure || '';
    row.dataset.notes = notes || '';
    document.getElementById('tl-dates-' + tlid).textContent = fmtDate(arrival) + ' – ' + fmtDate(departure);
    document.getElementById('tl-notes-' + tlid).textContent = notes || '';
  }
}

async function openNewLocationModal(travelId, travelStart, travelEnd) {
  document.getElementById('loc-picker-overlay')?.remove();
  const [countries, locTypes, allLocs] = await Promise.all([api('/api/countries'), api('/api/location_types'), api('/api/locations')]);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'new-loc-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Nowe miejsce</span>
      <button class="modal-save" onclick="document.getElementById('new-loc-overlay').remove()">Anuluj</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa miejsca *</div>
      <input class="form-input" id="nl-name" placeholder="np. Catania">
      <div class="form-row">
        <div><div class="form-label">Kraj *</div>
          <select class="form-input" id="nl-country" onchange="updateParentLocListFor('new-loc-overlay','nl')">
            <option value="">– wybierz –</option>
            ${countries.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select></div>
        <div><div class="form-label">Typ miejsca *</div>
          <select class="form-input" id="nl-type">
            <option value="">– wybierz –</option>
            ${locTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-label">Miejsce nadrzędne (opcjonalnie)</div>
      <select class="form-input" id="nl-parent"><option value="">– brak –</option></select>
      <div class="form-label">Adres / opis (opcjonalnie)</div>
      <input class="form-input" id="nl-address" placeholder="np. centrum Katanii">
      <div class="form-label">Współrzędne GPS (opcjonalnie)</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input class="form-input" id="nl-lat" placeholder="Szer. np. 37.50745" style="margin-bottom:0;flex:1;min-width:0">
        <input class="form-input" id="nl-lng" placeholder="Dług. np. 15.08720" style="margin-bottom:0;flex:1;min-width:0">
        <button id="nl-geocode-btn" onclick="geocodeForLocModal('nl')" style="background:var(--blue);color:white;border:none;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">🔍</button>
      </div>
      <div id="nl-geo-results" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;max-height:200px;overflow-y:auto"></div>
      <div class="form-label">Notatki (opcjonalnie)</div>
      <textarea class="form-input form-textarea" id="nl-notes" placeholder="Dodatkowe informacje..."></textarea>
      <button onclick="saveNewLocation()"
        style="background:var(--blue);color:white;border:none;border-radius:10px;padding:12px;width:100%;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px">
        ${travelId ? 'Zapisz i dodaj do podróży' : 'Zapisz miejsce'}
      </button>
    </div></div>`;
  overlay._travelId = travelId || null; overlay._travelStart = travelStart || null;
  overlay._travelEnd = travelEnd || null; overlay._allLocs = allLocs;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function saveNewLocation() {
  try {
    const name = document.getElementById('nl-name').value.trim();
    const countryId = document.getElementById('nl-country').value;
    const typeId = document.getElementById('nl-type').value;
    const parentId = document.getElementById('nl-parent').value;
    const address = document.getElementById('nl-address').value.trim();
    const notes = document.getElementById('nl-notes').value.trim();
    const typeSelect = document.getElementById('nl-type');
    const typeName = typeSelect.options[typeSelect.selectedIndex]?.text || '';
    if (!name) { alert('Podaj nazwę miejsca!'); return; }
    if (!countryId) { alert('Wybierz kraj!'); return; }
    if (!typeId) { alert('Wybierz typ miejsca!'); return; }
    const overlay = document.getElementById('new-loc-overlay');
    const travelId = overlay?._travelId || null;
    const travelStart = overlay?._travelStart || null;
    const travelEnd = overlay?._travelEnd || null;
    const latVal = parseFloat(document.getElementById('nl-lat').value) || null;
    const lngVal = parseFloat(document.getElementById('nl-lng').value) || null;
    const res = await apiPost('/api/locations', {
      name, country_id: parseInt(countryId), location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null, notes: notes || null, latitude: latVal, longitude: lngVal
    });
    if (res.error) { alert('Błąd: ' + res.error); return; }
    const parentSel = document.getElementById('nl-parent');
    const parentName = parentId ? (parentSel.options[parentSel.selectedIndex]?.text || '').split(' (')[0] : null;
    overlay.remove();
    if (travelId) openConfirmAddLocation(travelId, res.id, name, typeName, travelStart, travelEnd, parentId ? parseInt(parentId) : null, parentName);
    else showTab('locations');
  } catch(err) { alert('Nieoczekiwany błąd: ' + err.message); }
}

async function openAddLocationToTravel(travelId, travelStart, travelEnd) {
  const locs = await api('/api/locations');
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'loc-picker-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Dodaj miejsce do podróży</span>
      <button class="modal-save" onclick="document.getElementById('loc-picker-overlay').remove()">Anuluj</button></div>
    <div class="form-section">
      <div class="search-box" style="margin-bottom:10px">
        <input type="search" placeholder="Szukaj miejsca lub kraju..." oninput="filterLocPicker(this.value)"
          style="width:100%;padding:8px 12px 8px 36px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:15px;outline:none">
      </div>
      <div id="loc-picker-list" style="max-height:45vh;overflow-y:auto">${buildLocPickerList(locs, travelId, travelStart, travelEnd)}</div>
    </div>
    <div class="form-section" style="border-top:1px solid var(--border);padding-top:14px">
      <button onclick="openNewLocationModal(${travelId}, '${travelStart}', '${travelEnd}')"
        style="background:var(--green-light);color:var(--green);border:none;border-radius:10px;padding:12px;width:100%;font-size:14px;font-weight:600;cursor:pointer">
        ＋ Dodaj nowe miejsce do słownika
      </button>
    </div></div>`;
  overlay._allLocs = locs; overlay._travelId = travelId; overlay._travelStart = travelStart; overlay._travelEnd = travelEnd;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function buildLocPickerList(locs, travelId, travelStart, travelEnd) {
  if (!locs.length) return `<div style="color:var(--text3);font-size:13px;padding:8px 0;text-align:center">Brak wyników</div>`;
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  return Object.entries(grouped).map(([country, items]) => `
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;padding:8px 0 4px">${country}</div>
    ${items.map(l => `<div class="person-row" onclick="openConfirmAddLocation(${travelId}, ${l.id}, '${l.name.replace(/'/g,"\\'")}', '${l.location_type.replace(/'/g,"\\'")}', '${travelStart}', '${travelEnd}', ${l.parent_location_id || 'null'}, '${(l.parent_name||'').replace(/'/g,"\\'")}')">
      <div style="font-size:20px;width:28px;text-align:center;flex-shrink:0">${locationIcon(l.location_type)}</div>
      <div class="person-row-info"><div style="font-size:14px;font-weight:500">${l.name}</div>
        <div style="font-size:12px;color:var(--text2)">${l.location_type}${l.parent_name ? ' · ' + l.parent_name : ''}</div></div>
      <div class="person-row-plus">＋</div></div>`).join('')}`).join('');
}

function filterLocPicker(q) {
  const overlay = document.getElementById('loc-picker-overlay'); if (!overlay) return;
  const all = overlay._allLocs || [];
  const filtered = q.trim() ? all.filter(l => l.name.toLowerCase().includes(q.toLowerCase()) || l.country_name.toLowerCase().includes(q.toLowerCase())) : all;
  document.getElementById('loc-picker-list').innerHTML = buildLocPickerList(filtered, overlay._travelId, overlay._travelStart, overlay._travelEnd);
}

function openConfirmAddLocation(travelId, locationId, locationName, locationType, travelStart, travelEnd, parentId, parentName) {
  const alreadyAdded = parentId && [...document.querySelectorAll('#locations-list .loc-row')].some(r => parseInt(r.dataset.locationId) === parentId);
  const parentHint = parentId && !alreadyAdded ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px;background:var(--blue-light);border-radius:8px">
      <input type="checkbox" id="lc-add-parent" checked style="width:18px;height:18px;cursor:pointer;flex-shrink:0">
      <label for="lc-add-parent" style="font-size:13px;cursor:pointer;line-height:1.4">Dodaj też: <strong>${escapeHtml(parentName)}</strong> (miejsce nadrzędne)</label>
    </div>` : '';
  const overlay2 = document.createElement('div'); overlay2.className = 'modal-overlay'; overlay2.id = 'loc-confirm-overlay';
  overlay2.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${locationIcon(locationType)} ${escapeHtml(locationName)}</span>
      <button class="modal-save" onclick="document.getElementById('loc-confirm-overlay').remove()">Anuluj</button></div>
    <div class="form-section">
      ${parentHint}
      <div class="form-row">
        <div><div class="form-label">Przyjazd</div><input class="form-input" type="date" id="lc-arrival" value="${travelStart || ''}"></div>
        <div><div class="form-label">Wyjazd</div><input class="form-input" type="date" id="lc-departure" value="${travelEnd || ''}"></div>
      </div>
      <div class="form-label">Notatka (opcjonalnie)</div>
      <input class="form-input" id="lc-notes" placeholder="np. hotel nad morzem">
      <button onclick="saveLocationToTravel(${travelId}, ${locationId}, '${locationName.replace(/'/g,"\\'")}', '${locationType.replace(/'/g,"\\'")}', ${parentId || 'null'}, '${(parentName||'').replace(/'/g,"\\'")}' )"
        style="background:var(--blue);color:white;border:none;border-radius:10px;padding:12px;width:100%;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px">
        Dodaj miejsce
      </button>
    </div></div>`;
  overlay2.addEventListener('click', e => { if (e.target === overlay2) overlay2.remove(); });
  document.body.appendChild(overlay2);
}

async function saveLocationToTravel(travelId, locationId, locationName, locationType, parentId, parentName) {
  const arrival = document.getElementById('lc-arrival').value || null;
  const departure = document.getElementById('lc-departure').value || null;
  const notes = document.getElementById('lc-notes').value.trim() || null;
  const addParent = parentId && document.getElementById('lc-add-parent')?.checked;
  const res = await apiPost(`/api/travels/${travelId}/locations`, { location_id: locationId, arrival_date: arrival, departure_date: departure, notes });
  if (addParent) {
    await apiPost(`/api/travels/${travelId}/locations`, { location_id: parentId, arrival_date: arrival, departure_date: departure, notes: null });
  }
  document.getElementById('loc-confirm-overlay')?.remove();
  document.getElementById('loc-picker-overlay')?.remove();
  const list = document.getElementById('locations-list');
  if (list) {
    list.querySelectorAll('.empty-locs').forEach(el => el.remove());
    const row = document.createElement('div'); row.className = 'loc-row'; row.id = 'tl-' + res.id;
    row.dataset.arrival = arrival || '';
    row.dataset.departure = departure || '';
    row.dataset.notes = notes || '';
    row.dataset.locationId = locationId;
    row.innerHTML = `<div class="loc-icon">${locationIcon(locationType)}</div><div style="flex:1">
      <div class="loc-name">${escapeHtml(locationName)}</div><div class="loc-sub">${escapeHtml(locationType)}</div>
      <div class="loc-sub" id="tl-dates-${res.id}">${fmtDate(arrival)} – ${fmtDate(departure)}</div>
      <div class="loc-sub" id="tl-notes-${res.id}" style="font-style:italic">${notes ? escapeHtml(notes) : ''}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px;align-self:flex-start;margin-top:2px">
        <button onclick="openEditTravelLocation(${travelId}, ${res.id})" style="background:none;border:none;color:var(--blue);font-size:16px;cursor:pointer;padding:0;line-height:1">✎</button>
        <button onclick="removeLocationFromTravel(${travelId}, ${res.id})" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0;line-height:1">✕</button>
      </div>`;
    list.appendChild(row);
  }
}
