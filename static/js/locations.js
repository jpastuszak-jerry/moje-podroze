let currentLocationQualityFilter = 'all';
let currentLocationSort = 'country_name';

async function renderLocations(q = '') {
  const view = document.getElementById('view');
  if (!document.getElementById('loc-list')) {
    view.innerHTML = `
      <div class="page-header"><div class="page-title">Miejsca</div>
        <div class="search-box"><input type="search" placeholder="Szukaj miejsca lub kraju..." id="loc-search" oninput="onLocSearch(this.value)"></div>
        <div class="filter-grid">
          <select class="filter-select" id="loc-country-filter" onchange="applyLocationFilters()">
            <option value="">Wszystkie kraje</option>
          </select>
          <select class="filter-select" id="loc-type-filter" onchange="applyLocationFilters()">
            <option value="">Wszystkie typy</option>
          </select>
          <select class="filter-select filter-wide" id="loc-sort" onchange="setLocSort(this.value)">
            <option value="country_name">Kraj i nazwa</option>
            <option value="name_asc">Nazwa A-Z</option>
            <option value="visit_count_desc">Najwięcej wizyt</option>
            <option value="last_visit_desc">Ostatnio odwiedzone</option>
          </select>
        </div>
        <div class="sort-bar loc-quality-bar">
          <button class="sort-btn active" data-loc-quality="all" onclick="setLocQualityFilter('all')">Wszystkie</button>
          <button class="sort-btn" data-loc-quality="visited" onclick="setLocQualityFilter('visited')">Odwiedzone</button>
          <button class="sort-btn" data-loc-quality="not_visited" onclick="setLocQualityFilter('not_visited')">Nieodwiedzone</button>
          <button class="sort-btn" data-loc-quality="missing_gps" onclick="setLocQualityFilter('missing_gps')">Bez GPS</button>
        </div>
        <div class="action-strip">
          <button class="action-button" onclick="openDictionaryModal('/api/countries','Kraje')"><span class="action-button-icon">🌍</span><span>Kraje</span></button>
          <button class="action-button" onclick="openDictionaryModal('/api/location_types','Typy miejsc')"><span class="action-button-icon">📍</span><span>Typy</span></button>
          <button class="action-button" onclick="openPersonsModal()"><span class="action-button-icon">👤</span><span>Osoby</span></button>
          <button class="action-button" onclick="openLocationTodoView()"><span class="action-button-icon">✍️</span><span>Braki</span></button>
          <button class="action-button" onclick="exportDatabase()"><span class="action-button-icon">💾</span><span>Backup</span></button>
          <button class="action-button" onclick="openTrashModal()"><span class="action-button-icon">🗑</span><span>Kosz</span></button>
        </div></div>
      <div id="loc-list">${skeletonCards(4)}</div>
      <button class="fab" onclick="openNewLocationModal()">＋</button>`;
  }
  const list = document.getElementById('loc-list');
  list.innerHTML = skeletonCards(4);
  const locs = await api('/api/locations' + (q ? '?q='+encodeURIComponent(q) : ''));
  if (isApiError(locs)) {
    list.innerHTML = emptyState({ icon: '📍', title: 'Nie udało się wczytać miejsc', message: locs.error });
    return;
  }
  allLocationsCache = Array.isArray(locs) ? locs : [];
  populateLocationFilters(allLocationsCache);
  applyLocationFilters();
}

function populateLocationFilters(locs) {
  const countryEl = document.getElementById('loc-country-filter');
  const typeEl = document.getElementById('loc-type-filter');
  const sortEl = document.getElementById('loc-sort');
  if (sortEl) sortEl.value = currentLocationSort;
  if (countryEl) {
    const selected = countryEl.value;
    const countries = [...new Set(locs.map(l => l.country_name).filter(Boolean))].sort();
    countryEl.innerHTML = '<option value="">Wszystkie kraje</option>' +
      countries.map(c => `<option value="${escapeAttr(c)}"${c === selected ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }
  if (typeEl) {
    const selected = typeEl.value;
    const types = [...new Set(locs.map(l => l.location_type).filter(Boolean))].sort();
    typeEl.innerHTML = '<option value="">Wszystkie typy</option>' +
      types.map(t => `<option value="${escapeAttr(t)}"${t === selected ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
  }
}

function applyLocTypeFilter() {
  applyLocationFilters();
}

function setLocQualityFilter(filter) {
  currentLocationQualityFilter = filter || 'all';
  applyLocationFilters();
}

function setLocSort(sort) {
  currentLocationSort = sort || 'country_name';
  applyLocationFilters();
}

function updateLocQualityButtons() {
  document.querySelectorAll('[data-loc-quality]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.locQuality === currentLocationQualityFilter);
  });
}

function compareLocName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'pl', { sensitivity: 'base' });
}

function compareLocCountryName(a, b) {
  const country = String(a.country_name || '').localeCompare(String(b.country_name || ''), 'pl', { sensitivity: 'base' });
  return country || compareLocName(a, b);
}

function locationHasGps(loc) {
  return loc.latitude != null && loc.longitude != null;
}

function locationVisitCount(loc) {
  return Number(loc.visit_count || 0);
}

function applyLocationFilters() {
  const type = document.getElementById('loc-type-filter')?.value || '';
  const country = document.getElementById('loc-country-filter')?.value || '';
  const quality = currentLocationQualityFilter || 'all';
  let locs = Array.isArray(allLocationsCache) ? [...allLocationsCache] : [];
  if (type) locs = locs.filter(l => l.location_type === type);
  if (country) locs = locs.filter(l => l.country_name === country);
  if (quality === 'missing_gps') locs = locs.filter(l => !locationHasGps(l));
  if (quality === 'visited') locs = locs.filter(l => locationVisitCount(l) > 0);
  if (quality === 'not_visited') locs = locs.filter(l => locationVisitCount(l) === 0);

  if (currentLocationSort === 'name_asc') {
    locs.sort(compareLocName);
  } else if (currentLocationSort === 'visit_count_desc') {
    locs.sort((a, b) => (locationVisitCount(b) - locationVisitCount(a)) || compareLocCountryName(a, b));
  } else if (currentLocationSort === 'last_visit_desc') {
    locs.sort((a, b) => String(b.last_visit || '').localeCompare(String(a.last_visit || '')) || compareLocCountryName(a, b));
  } else {
    locs.sort(compareLocCountryName);
  }
  updateLocQualityButtons();
  renderLocList(locs);
}

function locVisitCountLabel(count) {
  count = Number(count || 0);
  if (count === 1) return '1 wizyta';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} wizyty`;
  return `${count} wizyt`;
}

function locVisitSummary(loc) {
  const count = locationVisitCount(loc);
  const last = loc.last_visit ? `ostatnio ${fmtDate(loc.last_visit)}` : 'brak wizyt';
  return `${locVisitCountLabel(count)} · ${last}`;
}

function locCardHtml(l, showCountry = false) {
  const type = escapeHtml(l.location_type || '');
  const parent = l.parent_name ? ` · ${escapeHtml(l.parent_name)}` : '';
  const country = showCountry ? `${escapeHtml(l.country_name || '')} · ` : '';
  const gpsBadge = locationHasGps(l) ? '' : '<span class="badge badge-orange">bez GPS</span>';
  return `<div class="card" onclick="openLocation(${l.id})"><div class="card-inner">
    <div class="card-icon" style="background:var(--blue-light)">${locationIcon(l.location_type)}</div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(l.name || '(bez nazwy)')}</div>
      <div class="card-subtitle">${country}${type}${parent}</div>
      <div class="card-subtitle">${escapeHtml(locVisitSummary(l))}</div>
      ${l.address ? `<div class="card-subtitle">${escapeHtml(l.address)}</div>` : ''}
      ${gpsBadge ? `<div class="card-meta">${gpsBadge}</div>` : ''}
    </div>
    <div style="color:var(--text3);font-size:20px;align-self:center">›</div>
  </div></div>`;
}

function renderLocList(locs) {
  const list = document.getElementById('loc-list');
  if (!locs.length) {
    const search = document.getElementById('loc-search')?.value || '';
    const type = document.getElementById('loc-type-filter')?.value || '';
    const country = document.getElementById('loc-country-filter')?.value || '';
    const hasFilter = search || type || country || currentLocationQualityFilter !== 'all';
    list.innerHTML = hasFilter
      ? emptyState({ icon: '🔍', title: 'Brak wyników', message: 'Spróbuj innego zapytania albo wyczyść filtry.' })
      : emptyState({ icon: '📍', title: 'Brak miejsc', message: 'Dodaj pierwsze miejsce do swojej kolekcji podróży.', ctaLabel: '＋ Nowe miejsce', ctaOnclick: 'openNewLocationModal()' });
    return;
  }
  if (currentLocationSort !== 'country_name') {
    list.innerHTML = `<div class="card-list">${locs.map(l => locCardHtml(l, true)).join('')}</div>`;
    return;
  }
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  list.innerHTML = Object.entries(grouped).map(([country, items]) => `
    <div class="country-header">${escapeHtml(country)}</div>
    <div class="card-list" style="padding-top:4px;padding-bottom:4px">
      ${items.map(l => locCardHtml(l)).join('')}
    </div>`).join('');
}

function onLocSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => renderLocations(val), 400); }

let currentLocationTodoFilter = 'all';

function openLocationTodoView() {
  currentLocationTodoFilter = 'all';
  showTab('locationTodo');
}

function setLocationTodoFilter(filter) {
  currentLocationTodoFilter = filter || 'all';
  renderLocationTodo();
}

async function renderLocationTodo() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Miejsca do uzupełnienia</div></div>` + skeletonCards(3);
  const data = await api('/api/locations/todo');
  if (data.error) {
    view.innerHTML = emptyState({ icon: '📍', title: 'Nie udało się wczytać listy', message: data.error });
    return;
  }

  const labels = data.labels || {};
  const filters = Object.entries(labels)
    .map(([key, label]) => ({ key, label, count: data.counts?.[key] || 0 }))
    .filter(f => f.count > 0);
  const items = (data.needs_attention || []).filter(item =>
    currentLocationTodoFilter === 'all' || (item.missing_keys || []).includes(currentLocationTodoFilter)
  );

  let html = `<div class="page-header">
    <div>
      <button class="back-btn" onclick="showTab('locations')">‹ Miejsca</button>
      <div class="page-title">Miejsca do uzupełnienia</div>
    </div>
  </div>`;
  html += `<div class="sort-bar">
    <button class="sort-btn${currentLocationTodoFilter === 'all' ? ' active' : ''}" onclick="setLocationTodoFilter('all')">Wszystkie (${data.needs_attention?.length || 0})</button>
    ${filters.map(f => `<button class="sort-btn${currentLocationTodoFilter === f.key ? ' active' : ''}" onclick="setLocationTodoFilter('${f.key}')">${escapeHtml(f.label)} (${f.count})</button>`).join('')}
  </div>`;
  html += `<div class="hero-card" style="margin-top:10px">
    <div class="hero-label">Jakość miejsc</div>
    <div class="hero-numbers">
      <div class="hero-number"><div class="hero-val">${data.total || 0}</div><div class="hero-key">miejsc w bazie</div></div>
      <div class="hero-number"><div class="hero-val">${data.needs_attention?.length || 0}</div><div class="hero-key">wymaga uwagi</div></div>
      <div class="hero-number"><div class="hero-val">${items.length}</div><div class="hero-key">na tej liście</div></div>
      <div class="hero-number"><div class="hero-val">${filters.length}</div><div class="hero-key">typów braków</div></div>
    </div>
  </div>`;

  if (!items.length) {
    html += emptyState({
      icon: '✅',
      title: 'Nie ma miejsc do uzupełnienia',
      message: currentLocationTodoFilter === 'all'
        ? 'Wszystkie miejsca wyglądają kompletnie.'
        : 'Ten typ braku nie występuje w miejscach.',
    });
    view.innerHTML = html;
    return;
  }

  html += '<div class="card-list" style="padding:12px 16px 24px">';
  html += items.map(item => `
    <div class="card" onclick="openLocation(${item.id})">
      <div class="card-inner">
        <div class="card-icon" style="background:var(--blue-light)">${locationIcon(item.location_type)}</div>
        <div class="card-body">
          <div style="display:flex;align-items:flex-start;gap:8px">
            <div class="card-title" style="flex:1">${escapeHtml(item.name || '(bez nazwy)')}</div>
            <button class="btn-add-small" onclick="event.stopPropagation(); openEditLocationModal(${item.id})">Edytuj</button>
          </div>
          <div class="card-subtitle">${escapeHtml(item.location_type)} · ${escapeHtml(item.country_name)} · ${item.visit_count || 0} wizyt</div>
          <div class="card-meta">
            ${(item.missing || []).map(label => `<span class="badge badge-orange">${escapeHtml(label)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('');
  html += '</div>';
  view.innerHTML = html;
}

async function openLocation(id) {
  const view = document.getElementById('view');
  view.innerHTML = skeletonCards(3);
  const loc = await api('/api/locations/' + id);
  if (!loc || !loc.id || isApiError(loc)) {
    if (loc && loc.error) toast('Nie znaleziono miejsca', 'error');
    showTab('locations');
    return;
  }
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
          ${loc.parent_name ? `<div class="info-item"><label>Region / miasto</label><span class="item-link" onclick="openLocation(${loc.parent_location_id})">${escapeHtml(loc.parent_name)}</span></div>` : ''}
          <div class="info-item"><label>Liczba wizyt</label><span>${loc.visit_count} ${loc.visit_count === 1 ? 'raz' : 'razy'}</span></div>
          ${loc.address ? `<div class="info-item info-wide"><label>Adres</label><span>${escapeHtml(loc.address)}</span></div>` : ''}
          ${(loc.latitude != null && loc.longitude != null) ? `
          <div class="info-item info-wide">
            <label>Współrzędne GPS</label>
            <span class="mono-detail">
              ${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}
              &nbsp;<a class="text-link" href="https://maps.google.com/?q=${loc.latitude},${loc.longitude}" target="_blank">📍 Google Maps</a>
            </span>
          </div>` : ''}
        </div>
        ${loc.notes ? `<div style="margin-top:10px"><div class="form-label">Notatki</div><div class="notes-text">${escapeHtml(loc.notes)}</div></div>` : ''}
      </div>
      ${loc.visits && loc.visits.length ? `<div class="section"><div class="section-title">Wizyty bezpośrednie (${loc.visits.length})</div>
        ${loc.visits.map(v => `<div class="loc-row clickable-row" onclick="openTravel(${v.id})">
          <div class="loc-icon">✈️</div><div style="flex:1"><div class="loc-name">${escapeHtml(v.travel_name || '(bez nazwy)')}</div>
          <div class="loc-sub">${fmtDate(v.arrival_date)} – ${fmtDate(v.departure_date)}</div>
          ${v.notes ? `<div class="loc-sub" style="font-style:italic">${escapeHtml(v.notes)}</div>` : ''}</div>
          <div class="list-chevron">›</div></div>`).join('')}
      </div>` : `<div class="section"><div class="empty inline-empty">Brak wizyt w bazie</div></div>`}
      ${loc.child_visits && loc.child_visits.length ? `<div class="section"><div class="section-title">Wizyty przez lokalizacje podrzędne (${loc.child_visits.length})</div>
        ${loc.child_visits.map(v => `<div class="loc-row clickable-row" onclick="openTravel(${v.id})">
          <div class="loc-icon">📍</div><div style="flex:1">
          <div class="loc-name">${escapeHtml(v.travel_name || '(bez nazwy)')}</div>
          <div class="loc-sub">${escapeHtml(v.child_location_name)}</div>
          <div class="loc-sub">${fmtDate(v.arrival_date)} – ${fmtDate(v.departure_date)}</div></div>
          <div class="list-chevron">›</div></div>`).join('')}
      </div>` : ''}
      <button class="delete-btn" onclick="confirmDeleteLocation(${loc.id})">🗑 Usuń miejsce</button>
      <div style="height:12px"></div>
    </div>
    <button class="fab" onclick="openEditLocationModal(${loc.id})">✎</button>`;
}

async function confirmDeleteLocation(id) {
  const ok = await askConfirm({
    title: 'Usunąć miejsce?',
    message: 'Trafi do Kosza — możesz przywrócić.',
    confirmText: 'Do Kosza', danger: true,
  });
  if (!ok) return;
  const res = await apiDelete('/api/locations/' + id);
  if (res.error) { toast(res.error, 'error'); return; }
  toast('Miejsce w koszu', 'success');
  showTab('locations');
}

async function openEditLocationModal(id) {
  document.getElementById('edit-loc-overlay')?.remove();
  const [loc, countries, locTypes, allLocs] = await Promise.all([
    api('/api/locations/' + id),
    api('/api/countries'),
    api('/api/location_types'),
    api('/api/locations')
  ]);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'edit-loc-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Edytuj miejsce</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('edit-loc-overlay'))">Anuluj</button></div>
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
      <div class="form-inline-row">
        <input class="form-input" id="el-lat" placeholder="Szer. np. 37.50745"
          value="${loc.latitude != null ? parseFloat(loc.latitude).toFixed(5) : ''}">
        <input class="form-input" id="el-lng" placeholder="Dług. np. 15.08720"
          value="${loc.longitude != null ? parseFloat(loc.longitude).toFixed(5) : ''}">
        <button class="form-icon-btn" id="el-geocode-btn" onclick="geocodeForLocModal('el')">🔍</button>
      </div>
      <div class="form-results" id="el-geo-results"></div>
      <div class="form-label">Notatki (opcjonalnie)</div>
      <textarea class="form-input form-textarea" id="el-notes"></textarea>
      <button class="form-primary-btn" id="el-save-btn" onclick="saveEditLocation(${id})">
        Zapisz zmiany
      </button>
    </div></div>`;
  overlay._allLocs = allLocs.filter(l => l.id !== id);
  overlay._currentParentId = loc.parent_location_id || null;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  document.getElementById('el-notes').value = loc.notes || '';
  updateParentLocListFor('edit-loc-overlay', 'el');
}

async function geocodeForLocModal(prefix) {
  const name = document.getElementById(prefix+'-name').value.trim();
  const cSel = document.getElementById(prefix+'-country');
  const country = cSel.options[cSel.selectedIndex]?.text || '';
  if (!name) { toast('Najpierw podaj nazwę miejsca', 'error'); return; }
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
          class="form-result-item">
          ${escapeHtml(r.display_name)}
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
  const btn = document.getElementById('el-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;
  try {
    const name = document.getElementById('el-name').value.trim();
    const countryId = document.getElementById('el-country').value;
    const typeId = document.getElementById('el-type').value;
    const parentId = document.getElementById('el-parent').value;
    const address = document.getElementById('el-address').value.trim();
    const notes = document.getElementById('el-notes').value.trim();
    if (!name) { toast('Podaj nazwę miejsca', 'error'); return; }
    if (!countryId) { toast('Wybierz kraj', 'error'); return; }
    if (!typeId) { toast('Wybierz typ miejsca', 'error'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }
    const latVal = parseCoord(document.getElementById('el-lat').value);
    const lngVal = parseCoord(document.getElementById('el-lng').value);
    const res = await apiPut('/api/locations/' + id, {
      name, country_id: parseInt(countryId), location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null, notes: notes || null, latitude: latVal, longitude: lngVal
    });
    if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
    closeModal(document.getElementById('edit-loc-overlay'));
    toast('Zapisano', 'success');
    openLocation(id);
  } catch(err) {
    toast('Nieoczekiwany błąd: ' + err.message, 'error');
  } finally {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

async function removeLocationFromTravel(travelId, tlid) {
  const ok = await askConfirm({ title: 'Usunąć miejsce z podróży?', confirmText: 'Usuń', danger: true });
  if (!ok) return;
  await apiDelete(`/api/travels/${travelId}/locations/${tlid}`);
  const row = document.getElementById('tl-' + tlid);
  removeWithSlide(row, () => {
    const list = document.getElementById('locations-list');
    if (list && !list.querySelector('.loc-row')) list.innerHTML = `<div class="empty-locs inline-empty">Brak miejsc</div>`;
  });
}

function openEditTravelLocation(travelId, tlid) {
  document.getElementById('edit-tl-overlay')?.remove();
  const row = document.getElementById('tl-' + tlid);
  const arrival = row.dataset.arrival || '';
  const departure = row.dataset.departure || '';
  const notes = row.dataset.notes || '';
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'edit-tl-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Edytuj pobyt</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('edit-tl-overlay'))">Anuluj</button></div>
    <div class="form-section">
      <div class="form-row">
        <div><div class="form-label">Przyjazd</div><input class="form-input" type="date" id="etl-arrival" value="${arrival}"></div>
        <div><div class="form-label">Wyjazd</div><input class="form-input" type="date" id="etl-departure" value="${departure}"></div>
      </div>
      <div class="form-label">Notatka</div>
      <input class="form-input" id="etl-notes" value="${notes.replace(/"/g,'&quot;')}">
      <button class="form-primary-btn" id="etl-save-btn" onclick="saveEditTravelLocation(${travelId}, ${tlid})">
        Zapisz zmiany
      </button>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function saveEditTravelLocation(travelId, tlid) {
  const btn = document.getElementById('etl-save-btn');
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }
  let arrival = document.getElementById('etl-arrival').value || null;
  let departure = document.getElementById('etl-departure').value || null;
  const notes = document.getElementById('etl-notes').value.trim() || null;
  let basePayload = { arrival_date: arrival, departure_date: departure, notes };
  let res = await apiPut(`/api/travels/${travelId}/locations/${tlid}`, basePayload);
  if (res.error && res.out_of_range) {
    const choice = await askVisitDateRangeAction({ travelStart: res.travel_start, travelEnd: res.travel_end });
    if (!choice) {
      if (btn) { btn.disabled = false; btn.textContent = 'Zapisz zmiany'; }
      return;
    }
    if (choice === 'clip') {
      const clipped = clipVisitDatesToTravelRange(arrival, departure, res.travel_start, res.travel_end);
      arrival = clipped.arrival;
      departure = clipped.departure;
      document.getElementById('etl-arrival').value = arrival || '';
      document.getElementById('etl-departure').value = departure || '';
      basePayload = { arrival_date: arrival, departure_date: departure, notes };
      res = await apiPut(`/api/travels/${travelId}/locations/${tlid}`, basePayload);
    } else {
      res = await apiPut(`/api/travels/${travelId}/locations/${tlid}`, { ...basePayload, force_outside_range: true });
    }
  }
  if (res.error) {
    toast('Błąd: ' + res.error, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Zapisz zmiany'; }
    return;
  }
  closeModal(document.getElementById('edit-tl-overlay'));
  toast('Zapisano', 'success');
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
  document.getElementById('new-loc-overlay')?.remove();
  document.getElementById('loc-picker-overlay')?.remove();
  const [countries, locTypes, allLocs] = await Promise.all([api('/api/countries'), api('/api/location_types'), api('/api/locations')]);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'new-loc-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Nowe miejsce</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('new-loc-overlay'))">Anuluj</button></div>
    <div class="form-section">
      ${locationFormHtml({
        prefix: 'nl', countries, locTypes,
        parentChangeHandler: "updateParentLocListFor('new-loc-overlay','nl')",
        saveBtnId: 'nl-save-btn',
        saveBtnOnclick: 'saveNewLocation()',
        saveBtnLabel: travelId ? 'Zapisz i dodaj do podróży' : 'Zapisz miejsce',
      })}
    </div></div>`;
  overlay._travelId = travelId || null; overlay._travelStart = travelStart || null;
  overlay._travelEnd = travelEnd || null; overlay._allLocs = allLocs;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function saveNewLocation() {
  const btn = document.getElementById('nl-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;
  try {
    const name = document.getElementById('nl-name').value.trim();
    const countryId = document.getElementById('nl-country').value;
    const typeId = document.getElementById('nl-type').value;
    const parentId = document.getElementById('nl-parent').value;
    const address = document.getElementById('nl-address').value.trim();
    const notes = document.getElementById('nl-notes').value.trim();
    const typeSelect = document.getElementById('nl-type');
    const typeName = typeSelect.options[typeSelect.selectedIndex]?.text || '';
    const cSel = document.getElementById('nl-country');
    const countryName = cSel.options[cSel.selectedIndex]?.text || '';
    if (!name) { toast('Podaj nazwę miejsca', 'error'); return; }
    if (!countryId) { toast('Wybierz kraj', 'error'); return; }
    if (!typeId) { toast('Wybierz typ miejsca', 'error'); return; }
    const overlay = document.getElementById('new-loc-overlay');
    const travelId = overlay?._travelId || null;
    const travelStart = overlay?._travelStart || null;
    const travelEnd = overlay?._travelEnd || null;
    const allLocs = overlay?._allLocs || allLocationsCache || [];
    const latVal = parseCoord(document.getElementById('nl-lat').value);
    const lngVal = parseCoord(document.getElementById('nl-lng').value);

    const dup = findDuplicateLocation(allLocs, name, countryName, parentId);
    let force = false;
    if (dup) {
      if (!await confirmDuplicateLocation(dup, countryName)) return;
      force = true;
    }

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }

    const body = {
      name, country_id: parseInt(countryId), location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null, notes: notes || null, latitude: latVal, longitude: lngVal
    };
    if (force) body.force_duplicate = true;
    let res = await apiPost('/api/locations', body);
    if (res.error && res.duplicate && res.existing) {
      if (!await confirmDuplicateLocation(res.existing, countryName)) return;
      res = await apiPost('/api/locations', { ...body, force_duplicate: true });
    }
    if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
    const parentSel = document.getElementById('nl-parent');
    const parentName = parentId ? (parentSel.options[parentSel.selectedIndex]?.text || '').split(' (')[0] : null;
    closeModal(overlay);
    toast('Miejsce dodane', 'success');
    if (travelId) openConfirmAddLocation(travelId, res.id, name, typeName, travelStart, travelEnd, parentId ? parseInt(parentId) : null, parentName);
    else showTab('locations');
  } catch(err) {
    toast('Nieoczekiwany błąd: ' + err.message, 'error');
  } finally {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

async function openAddLocationToTravel(travelId, travelStart, travelEnd) {
  const locs = await api('/api/locations');
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'loc-picker-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Dodaj miejsce do podróży</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('loc-picker-overlay'))">Anuluj</button></div>
    <div class="form-section">
      <div class="search-box modal-search">
        <input type="search" placeholder="Szukaj miejsca lub kraju..." oninput="filterLocPicker(this.value)">
      </div>
      <div id="loc-picker-list" class="modal-scroll-list">${buildLocPickerList(locs, travelId, travelStart, travelEnd)}</div>
    </div>
    <div class="form-section form-section-divider">
      <button class="form-secondary-btn" onclick="openNewLocationModal(${travelId}, '${travelStart}', '${travelEnd}')">
        ＋ Dodaj nowe miejsce do słownika
      </button>
    </div></div>`;
  overlay._allLocs = locs; overlay._travelId = travelId; overlay._travelStart = travelStart; overlay._travelEnd = travelEnd;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

function buildLocPickerList(locs, travelId, travelStart, travelEnd) {
  if (!locs.length) return `<div style="color:var(--text3);font-size:13px;padding:8px 0;text-align:center">Brak wyników</div>`;
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  return Object.entries(grouped).map(([country, items]) => `
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;padding:8px 0 4px">${escapeHtml(country)}</div>
    ${items.map(l => `<div class="person-row" onclick="openConfirmAddLocation(${travelId}, ${l.id}, '${jsStringArg(l.name)}', '${jsStringArg(l.location_type)}', '${jsStringArg(travelStart)}', '${jsStringArg(travelEnd)}', ${l.parent_location_id || 'null'}, '${jsStringArg(l.parent_name || '')}')">
      <div style="font-size:20px;width:28px;text-align:center;flex-shrink:0">${locationIcon(l.location_type)}</div>
      <div class="person-row-info"><div style="font-size:14px;font-weight:500">${escapeHtml(l.name)}</div>
        <div style="font-size:12px;color:var(--text2)">${escapeHtml(l.location_type)}${l.parent_name ? ' · ' + escapeHtml(l.parent_name) : ''}</div></div>
      <div class="person-row-plus">＋</div></div>`).join('')}`).join('');
}

function filterLocPicker(q) {
  const overlay = document.getElementById('loc-picker-overlay'); if (!overlay) return;
  const all = overlay._allLocs || [];
  const filtered = q.trim() ? all.filter(l => l.name.toLowerCase().includes(q.toLowerCase()) || l.country_name.toLowerCase().includes(q.toLowerCase())) : all;
  document.getElementById('loc-picker-list').innerHTML = buildLocPickerList(filtered, overlay._travelId, overlay._travelStart, overlay._travelEnd);
}

function openConfirmAddLocation(travelId, locationId, locationName, locationType, travelStart, travelEnd, parentId, parentName) {
  document.getElementById('loc-confirm-overlay')?.remove();
  const alreadyAdded = parentId && [...document.querySelectorAll('#locations-list .loc-row')].some(r => parseInt(r.dataset.locationId) === parentId);
  const parentHint = parentId && !alreadyAdded ? `
    <div class="form-hint-card">
      <input type="checkbox" id="lc-add-parent" checked>
      <label for="lc-add-parent">Dodaj też: <strong>${escapeHtml(parentName)}</strong> (miejsce nadrzędne)</label>
    </div>` : '';
  const overlay2 = document.createElement('div'); overlay2.className = 'modal-overlay'; overlay2.id = 'loc-confirm-overlay';
  overlay2.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${locationIcon(locationType)} ${escapeHtml(locationName)}</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('loc-confirm-overlay'))">Anuluj</button></div>
    <div class="form-section">
      ${parentHint}
      <div class="form-row">
        <div><div class="form-label">Przyjazd</div><input class="form-input" type="date" id="lc-arrival" value="${travelStart || ''}"></div>
        <div><div class="form-label">Wyjazd</div><input class="form-input" type="date" id="lc-departure" value="${travelEnd || ''}"></div>
      </div>
      <div class="form-label">Notatka (opcjonalnie)</div>
      <input class="form-input" id="lc-notes" placeholder="np. hotel nad morzem">
      <button class="form-primary-btn" id="lc-save-btn" onclick="saveLocationToTravel(${travelId}, ${locationId}, '${jsStringArg(locationName)}', '${jsStringArg(locationType)}', ${parentId || 'null'}, '${jsStringArg(parentName || '')}' )">
        Dodaj miejsce
      </button>
    </div></div>`;
  overlay2.addEventListener('click', e => { if (e.target === overlay2) closeModal(overlay2); });
  document.body.appendChild(overlay2);
  attachDragToDismiss(overlay2, '.modal', () => closeModal(overlay2));
}

async function saveLocationToTravel(travelId, locationId, locationName, locationType, parentId, parentName) {
  const btn = document.getElementById('lc-save-btn');
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }
  let arrival = document.getElementById('lc-arrival').value || null;
  let departure = document.getElementById('lc-departure').value || null;
  const notes = document.getElementById('lc-notes').value.trim() || null;
  const addParent = parentId && document.getElementById('lc-add-parent')?.checked;
  let basePayload = { location_id: locationId, arrival_date: arrival, departure_date: departure, notes };
  let res = await apiPost(`/api/travels/${travelId}/locations`, basePayload);
  if (res.error && res.out_of_range) {
    const choice = await askVisitDateRangeAction({ travelStart: res.travel_start, travelEnd: res.travel_end });
    if (!choice) {
      if (btn) { btn.disabled = false; btn.textContent = 'Dodaj miejsce'; }
      return;
    }
    if (choice === 'clip') {
      const clipped = clipVisitDatesToTravelRange(arrival, departure, res.travel_start, res.travel_end);
      arrival = clipped.arrival;
      departure = clipped.departure;
      document.getElementById('lc-arrival').value = arrival || '';
      document.getElementById('lc-departure').value = departure || '';
      basePayload = { location_id: locationId, arrival_date: arrival, departure_date: departure, notes };
      res = await apiPost(`/api/travels/${travelId}/locations`, basePayload);
    } else {
      res = await apiPost(`/api/travels/${travelId}/locations`, { ...basePayload, force_outside_range: true });
    }
  }
  if (res.error) {
    toast('Błąd: ' + res.error, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Dodaj miejsce'; }
    return;
  }
  toast('Miejsce dodane', 'success');
  if (addParent) {
    await apiPost(`/api/travels/${travelId}/locations`, { location_id: parentId, arrival_date: arrival, departure_date: departure, notes: null, force_outside_range: true });
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

/* ── Kosz (soft delete) ───────────────────────────────────── */
async function openTrashModal() {
  document.getElementById('trash-overlay')?.remove();
  const data = await api('/api/trash');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'trash-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">🗑 Kosz</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('trash-overlay'))">Gotowe</button></div>
    <div class="form-section" id="trash-body"></div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  renderTrashBody(data);
}

function renderTrashBody(data) {
  const body = document.getElementById('trash-body');
  if (!body) return;
  const travels = data.travels || [];
  const locations = data.locations || [];
  if (!travels.length && !locations.length) {
    body.innerHTML = `<div style="text-align:center;color:var(--text3);padding:24px 8px;font-size:14px">Kosz jest pusty</div>`;
    return;
  }
  const travelHtml = travels.length ? `
    <div class="form-label" style="margin-top:0">Podróże (${travels.length})</div>
    ${travels.map(t => `
      <div class="loc-row" id="trash-t-${t.id}">
        <div class="loc-icon">✈️</div>
        <div style="flex:1">
          <div class="loc-name">${escapeHtml(t.name || '(bez nazwy)')}</div>
          <div class="loc-sub">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</div>
          <div class="loc-sub" style="color:var(--text3);font-size:11px">usunięto ${fmtDate(t.deleted_at)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button onclick="restoreFromTrash('travel', ${t.id})" style="background:var(--green);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">Przywróć</button>
          <button onclick="hardDeleteFromTrash('travel', ${t.id})" style="background:var(--red);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">Usuń trwale</button>
        </div>
      </div>`).join('')}
  ` : '';
  const locHtml = locations.length ? `
    <div class="form-label" style="margin-top:${travels.length ? '14px' : '0'}">Miejsca (${locations.length})</div>
    ${locations.map(l => `
      <div class="loc-row" id="trash-l-${l.id}">
        <div class="loc-icon">${locationIcon(l.location_type)}</div>
        <div style="flex:1">
          <div class="loc-name">${escapeHtml(l.name)}</div>
          <div class="loc-sub">${escapeHtml(l.location_type)} · ${escapeHtml(l.country_name)}</div>
          <div class="loc-sub" style="color:var(--text3);font-size:11px">usunięto ${fmtDate(l.deleted_at)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button onclick="restoreFromTrash('location', ${l.id})" style="background:var(--green);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">Przywróć</button>
          <button onclick="hardDeleteFromTrash('location', ${l.id})" style="background:var(--red);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">Usuń trwale</button>
        </div>
      </div>`).join('')}
  ` : '';
  body.innerHTML = travelHtml + locHtml;
}

async function restoreFromTrash(kind, id) {
  const path = kind === 'travel' ? `/api/travels/${id}/restore` : `/api/locations/${id}/restore`;
  const res = await apiPost(path, {});
  if (res.error) { toast(res.error, 'error'); return; }
  const row = document.getElementById(`trash-${kind === 'travel' ? 't' : 'l'}-${id}`);
  removeWithSlide(row, async () => {
    toast('Przywrócono', 'success');
    const data = await api('/api/trash');
    renderTrashBody(data);
  });
}

async function hardDeleteFromTrash(kind, id) {
  const ok = await askConfirm({
    title: 'Usunąć trwale?',
    message: 'Tej operacji NIE można cofnąć.',
    confirmText: 'Usuń trwale', danger: true,
  });
  if (!ok) return;
  const path = (kind === 'travel' ? `/api/travels/${id}` : `/api/locations/${id}`) + '?hard=1';
  const res = await apiDelete(path);
  if (res.error) { toast(res.error, 'error'); return; }
  const row = document.getElementById(`trash-${kind === 'travel' ? 't' : 'l'}-${id}`);
  removeWithSlide(row, async () => {
    toast('Usunięto trwale', 'success');
    const data = await api('/api/trash');
    renderTrashBody(data);
  });
}
