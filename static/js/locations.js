let currentLocationQualityFilter = 'all';
let currentLocationSort = 'country_name';
let currentLocationSearch = '';

const LOCATION_QUALITY_LABELS = {
  all: 'Wszystkie',
  visited: 'Odwiedzone',
  not_visited: 'Nieodwiedzone',
  missing_gps: 'Bez GPS',
};

const LOCATION_SORT_LABELS = {
  country_name: 'Kraj i nazwa',
  name_asc: 'Nazwa A-Z',
  visit_count_desc: 'Najwięcej wizyt',
  last_visit_desc: 'Ostatnio odwiedzone',
};

async function renderLocations(q) {
  if (q !== undefined) currentLocationSearch = q || '';
  const view = document.getElementById('view');
  if (!document.getElementById('loc-list')) {
    view.innerHTML = `
      <div class="page-header">
        <div class="locations-title-row">
          <div class="page-title">Miejsca</div>
          <button class="location-tools-button" type="button" onclick="openLocationToolsModal()" title="Narzędzia miejsc" aria-label="Narzędzia miejsc">
            <span class="action-button-icon">⚙️</span><span>Narzędzia</span>
          </button>
        </div>
        <div class="search-box"><input type="search" placeholder="Szukaj miejsca lub kraju..." id="loc-search" value="${escapeAttr(currentLocationSearch || '')}" oninput="onLocSearch(this.value)"></div>
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
        <div class="filter-summary hidden" id="loc-filter-summary"></div></div>
      <div id="loc-list">${skeletonCards(4)}</div>
      <button class="fab" onclick="openNewLocationModal()">＋</button>`;
  }
  const searchInput = document.getElementById('loc-search');
  if (searchInput && searchInput.value !== (currentLocationSearch || '')) {
    searchInput.value = currentLocationSearch || '';
  }
  const list = document.getElementById('loc-list');
  list.innerHTML = skeletonCards(4);
  const locs = await api('/api/locations' + (currentLocationSearch ? '?q='+encodeURIComponent(currentLocationSearch) : ''));
  if (isApiError(locs)) {
    list.innerHTML = emptyState({ icon: '📍', title: 'Nie udało się wczytać miejsc', message: locs.error });
    return;
  }
  allLocationsCache = Array.isArray(locs) ? locs : [];
  populateLocationFilters(allLocationsCache);
  applyLocationFilters();
}

function openLocationToolsModal() {
  document.getElementById('location-tools-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'location-tools-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Narzędzia miejsc</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('location-tools-overlay'))">Gotowe</button></div>
    <div class="form-section">
      <div class="location-tools-section">
        <div class="form-label">Słowniki</div>
        <div class="location-tools-grid">
          <button class="location-tool-button" type="button" onclick="runLocationTool('countries')">
            <span class="location-tool-icon">🌍</span>
            <span class="location-tool-text"><span class="location-tool-label">Kraje</span><span class="location-tool-sub">Lista krajów używana przy miejscach.</span></span>
          </button>
          <button class="location-tool-button" type="button" onclick="runLocationTool('location_types')">
            <span class="location-tool-icon">📍</span>
            <span class="location-tool-text"><span class="location-tool-label">Typy miejsc</span><span class="location-tool-sub">Miasta, regiony, wyspy i inne typy.</span></span>
          </button>
          <button class="location-tool-button" type="button" onclick="runLocationTool('persons')">
            <span class="location-tool-icon">👤</span>
            <span class="location-tool-text"><span class="location-tool-label">Osoby</span><span class="location-tool-sub">Uczestnicy podróży i relacje.</span></span>
          </button>
        </div>
      </div>
      <div class="location-tools-section">
        <div class="form-label">Utrzymanie danych</div>
        <div class="location-tools-grid">
          <button class="location-tool-button" type="button" onclick="runLocationTool('todo')">
            <span class="location-tool-icon">✍️</span>
            <span class="location-tool-text"><span class="location-tool-label">Braki w miejscach</span><span class="location-tool-sub">Miejsca wymagające uzupełnienia.</span></span>
          </button>
          <button class="location-tool-button" type="button" onclick="runLocationTool('backup')">
            <span class="location-tool-icon">💾</span>
            <span class="location-tool-text"><span class="location-tool-label">Backup JSON</span><span class="location-tool-sub">Pobierz kopię całej bazy.</span></span>
          </button>
          <button class="location-tool-button danger" type="button" onclick="runLocationTool('trash')">
            <span class="location-tool-icon">🗑</span>
            <span class="location-tool-text"><span class="location-tool-label">Kosz</span><span class="location-tool-sub">Przywracanie albo trwałe usuwanie.</span></span>
          </button>
        </div>
      </div>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

function runLocationTool(action) {
  const overlay = document.getElementById('location-tools-overlay');
  closeModal(overlay);
  setTimeout(() => {
    if (action === 'countries') openDictionaryModal('/api/countries', 'Kraje');
    else if (action === 'location_types') openDictionaryModal('/api/location_types', 'Typy miejsc');
    else if (action === 'persons') openPersonsModal();
    else if (action === 'todo') openLocationTodoView();
    else if (action === 'backup') exportDatabase();
    else if (action === 'trash') openTrashModal();
  }, 180);
}

function populateLocationFilters(locs) {
  const countryEl = document.getElementById('loc-country-filter');
  const typeEl = document.getElementById('loc-type-filter');
  const sortEl = document.getElementById('loc-sort');
  if (sortEl) sortEl.value = currentLocationSort;
  if (countryEl) {
    const selected = countryEl.value;
    const countries = [...new Set(locs.map(l => l.country_name).filter(Boolean))].sort();
    countryEl.innerHTML = renderSelectOptions(countries, selected, { emptyOption: 'Wszystkie kraje' });
  }
  if (typeEl) {
    const selected = typeEl.value;
    const types = [...new Set(locs.map(l => l.location_type).filter(Boolean))].sort();
    typeEl.innerHTML = renderSelectOptions(types, selected, { emptyOption: 'Wszystkie typy' });
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

function locationResultLabel(count) {
  count = Number(count || 0);
  if (count === 1) return 'wynik';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'wyniki';
  return 'wyników';
}

function locationFilterActiveLabels() {
  const search = (document.getElementById('loc-search')?.value || currentLocationSearch || '').trim();
  const country = document.getElementById('loc-country-filter')?.value || '';
  const type = document.getElementById('loc-type-filter')?.value || '';
  const quality = currentLocationQualityFilter || 'all';
  const labels = [];
  if (search) labels.push(`Szukaj: ${search}`);
  if (country) labels.push(country);
  if (type) labels.push(type);
  if (quality !== 'all') labels.push(LOCATION_QUALITY_LABELS[quality] || quality);
  if (currentLocationSort !== 'country_name') labels.push(LOCATION_SORT_LABELS[currentLocationSort] || 'Inne sortowanie');
  return labels;
}

function updateLocationFilterSummary(resultCount) {
  const el = document.getElementById('loc-filter-summary');
  if (!el) return;
  const labels = locationFilterActiveLabels();
  if (!labels.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="filter-summary-text">
      <strong>${resultCount} ${locationResultLabel(resultCount)}</strong>
      <span>${labels.map(escapeHtml).join(' · ')}</span>
    </div>
    <button class="filter-reset-btn" type="button" onclick="resetLocationFilters()">Wyczyść filtry</button>`;
}

function resetLocationFilters() {
  currentLocationSearch = '';
  currentLocationQualityFilter = 'all';
  currentLocationSort = 'country_name';
  clearTimeout(searchTimeout);
  const searchEl = document.getElementById('loc-search');
  const countryEl = document.getElementById('loc-country-filter');
  const typeEl = document.getElementById('loc-type-filter');
  const sortEl = document.getElementById('loc-sort');
  if (searchEl) searchEl.value = '';
  if (countryEl) countryEl.value = '';
  if (typeEl) typeEl.value = '';
  if (sortEl) sortEl.value = 'country_name';
  renderLocations('');
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
  updateLocationFilterSummary(locs.length);
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
  if (count === 0) return 'brak wizyt';
  if (!loc.last_visit) return `${locVisitCountLabel(count)} · brak daty ostatniej wizyty`;
  return `${locVisitCountLabel(count)} · ostatnio ${fmtDate(loc.last_visit)}`;
}

function locationVisitDates(visit) {
  const start = fmtDate(visit.arrival_date);
  const end = fmtDate(visit.departure_date);
  if (start && end) return `${start} – ${end}`;
  return start || end || 'brak dat';
}

function renderLocationDetailProfile(loc, directVisits, childVisits) {
  const hasGps = locationHasGps(loc);
  const gpsText = hasGps
    ? `${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}`
    : 'Brak współrzędnych';
  const mapsHref = hasGps ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.latitude},${loc.longitude}`)}` : '';
  const totalVisits = locationVisitCount(loc);
  return `<div class="section location-detail-card">
    <div class="location-profile-top">
      <div class="location-profile-icon">${locationIcon(loc.location_type)}</div>
      <div class="location-profile-main">
        <div class="location-profile-title">${escapeHtml(loc.name || '(bez nazwy)')}</div>
        <div class="location-profile-sub">${escapeHtml(loc.location_type || 'typ nieznany')} · ${escapeHtml(loc.country_name || 'kraj nieznany')}</div>
        <div class="location-detail-badges">
          <span class="location-detail-badge">${escapeHtml(locVisitSummary(loc))}</span>
          <span class="location-detail-badge ${hasGps ? 'ok' : 'warn'}">${hasGps ? 'GPS zapisany' : 'Bez GPS'}</span>
        </div>
      </div>
    </div>
    ${renderMetricGrid([
      { label: 'Wizyty łącznie', value: totalVisits || 0 },
      { label: 'Bezpośrednie', value: directVisits.length },
      { label: 'Przez podrzędne', value: childVisits.length },
    ], {
      className: 'location-metrics-grid',
      itemClass: 'location-metric',
      valueClass: 'location-metric-value',
      labelClass: 'location-metric-label',
      subClass: 'location-metric-sub',
    })}
    <div class="location-meta-list">
      ${loc.parent_name ? `<div class="location-meta-item">
        <span>Region / miasto</span>
        <button type="button" class="location-meta-link" onclick="openLocation(${loc.parent_location_id})">${escapeHtml(loc.parent_name)}</button>
      </div>` : ''}
      ${loc.address ? `<div class="location-meta-item wide"><span>Adres</span><strong>${escapeHtml(loc.address)}</strong></div>` : ''}
      <div class="location-meta-item wide">
        <span>Współrzędne GPS</span>
        <strong class="mono-detail">${escapeHtml(gpsText)}${hasGps ? ` <a class="text-link" href="${mapsHref}" target="_blank" rel="noopener">Google Maps</a>` : ''}</strong>
      </div>
      ${loc.notes ? `<div class="location-meta-item wide"><span>Notatki</span><strong class="notes-text">${escapeHtml(loc.notes)}</strong></div>` : ''}
    </div>
  </div>`;
}

function renderLocationVisitSection(title, visits, icon, child = false) {
  if (!visits.length) {
    return `<div class="section location-visits-section">
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="inline-empty">Brak wizyt w tej sekcji</div>
    </div>`;
  }
  return `<div class="section location-visits-section">
    <div class="section-header">
      <div class="section-title">${escapeHtml(title)}</div>
      <span class="location-section-count">${visits.length}</span>
    </div>
    <div class="location-visit-list">
      ${visits.map(v => `<button class="location-visit-row" type="button" onclick="openTravel(${v.id})">
        <span class="location-visit-icon">${icon}</span>
        <span class="location-visit-main">
          <span class="location-visit-name">${escapeHtml(v.travel_name || '(bez nazwy)')}</span>
          ${child ? `<span class="location-visit-sub">${escapeHtml(v.child_location_name || '')}</span>` : ''}
          <span class="location-visit-sub">${locationVisitDates(v)}</span>
          ${v.notes ? `<span class="location-visit-note">${escapeHtml(v.notes)}</span>` : ''}
        </span>
        <span class="list-chevron">›</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function locCardHtml(l, showCountry = false) {
  const type = escapeHtml(l.location_type || '');
  const parent = l.parent_name ? ` · ${escapeHtml(l.parent_name)}` : '';
  const country = showCountry ? `${escapeHtml(l.country_name || '')} · ` : '';
  const gpsBadge = locationHasGps(l) ? '' : renderBadge('bez GPS', { tone: 'orange' });
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
    const hasFilter = locationFilterActiveLabels().length > 0;
    list.innerHTML = hasFilter
      ? emptyState({ icon: '🔍', title: 'Brak wyników', message: 'Spróbuj innego zapytania albo wyczyść filtry.' })
      : emptyState({ icon: '📍', title: 'Brak miejsc', message: 'Dodaj pierwsze miejsce do swojej kolekcji podróży.', ctaLabel: '＋ Nowe miejsce', ctaOnclick: 'openNewLocationModal()' });
    return;
  }
  if (currentLocationSort !== 'country_name') {
    list.innerHTML = renderCardList(locs, l => locCardHtml(l, true));
    return;
  }
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  list.innerHTML = Object.entries(grouped).map(([country, items]) => `
    <div class="country-header">${escapeHtml(country)}</div>
    ${renderCardList(items, l => locCardHtml(l), { className: 'card-list compact-card-list' })}`).join('');
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

function resetLocationTodoControls() {
  currentLocationTodoFilter = 'all';
  renderLocationTodo();
}

function renderLocationTodoControls({ filters, totalItems, visibleItems }) {
  const activeFilter = filters.find(f => f.key === currentLocationTodoFilter);
  return renderFilterPanel({
    gridClass: 'aux-filter-grid single',
    controls: [{
      label: 'Typ braku',
      id: 'location-todo-filter-select',
      onchange: 'setLocationTodoFilter(this.value)',
      options: filters,
      selectedValue: currentLocationTodoFilter,
      valueKey: 'key',
      emptyOption: { key: 'all', label: 'Wszystkie braki' },
    }],
    summary: {
      count: visibleItems,
      countLabel: worklistCountLabel(visibleItems),
      detail: activeFilter ? activeFilter.label : `${totalItems} miejsc wymaga uwagi`,
      resetOnclick: activeFilter ? 'resetLocationTodoControls()' : '',
    },
  });
}

function locationTodoCardHtml(item) {
  return `<div class="card" onclick="openLocation(${item.id})">
    <div class="card-inner">
      <div class="card-icon worklist-icon">${locationIcon(item.location_type)}</div>
      <div class="card-body">
        <div class="worklist-card-title-row">
          <div class="card-title worklist-card-title">${escapeHtml(item.name || '(bez nazwy)')}</div>
          <button class="btn-add-small" onclick="event.stopPropagation(); openEditLocationModal(${item.id})">Edytuj</button>
        </div>
        <div class="card-subtitle">${escapeHtml(item.location_type)} · ${escapeHtml(item.country_name)} · ${item.visit_count || 0} wizyt</div>
        <div class="card-meta">${renderBadges(item.missing || [], { tone: 'orange' })}</div>
      </div>
    </div>
  </div>`;
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
  html += renderLocationTodoControls({
    filters,
    totalItems: data.needs_attention?.length || 0,
    visibleItems: items.length,
  });
  html += `<div class="hero-card">
    <div class="hero-label">Jakość miejsc</div>
    ${renderHeroMetrics([
      { value: data.total || 0, label: 'miejsc w bazie' },
      { value: data.needs_attention?.length || 0, label: 'wymaga uwagi' },
      { value: items.length, label: 'na tej liście' },
      { value: filters.length, label: 'typów braków' },
    ])}
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

  html += renderCardList(items, locationTodoCardHtml, { className: 'card-list worklist-list' });
  view.innerHTML = html;
}

async function openLocation(id) {
  setMapViewMode(false);
  const view = document.getElementById('view');
  resetViewScroll(view);
  view.innerHTML = skeletonCards(3);
  const loc = await api('/api/locations/' + id);
  if (!loc || !loc.id || isApiError(loc)) {
    if (loc && loc.error) toast('Nie znaleziono miejsca', 'error');
    showTab('locations');
    return;
  }
  const directVisits = Array.isArray(loc.visits) ? loc.visits : [];
  const childVisits = Array.isArray(loc.child_visits) ? loc.child_visits : [];
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="showTab('locations')">‹ Miejsca</button>
      <div class="detail-title">${escapeHtml(loc.name)}</div>
      <div class="detail-sub">${escapeHtml(loc.location_type)} · ${escapeHtml(loc.country_name)}</div>
    </div>
    <div class="detail-body">
      ${renderLocationDetailProfile(loc, directVisits, childVisits)}
      ${renderLocationVisitSection('Wizyty bezpośrednie', directVisits, '✈️')}
      ${childVisits.length ? renderLocationVisitSection('Wizyty przez miejsca podrzędne', childVisits, '📍', true) : ''}
      <button class="delete-btn" onclick="confirmDeleteLocation(${loc.id})">🗑 Usuń miejsce</button>
      <div style="height:12px"></div>
    </div>
    <button class="fab" onclick="openEditLocationModal(${loc.id})">✎</button>`;
}

async function confirmDeleteLocation(id) {
  return withActionLock(`location-delete-${id}`, async () => {
    const ok = await askConfirm({
      title: 'Usunąć miejsce?',
      message: 'Trafi do Kosza — możesz przywrócić.',
      confirmText: 'Do Kosza', danger: true,
    });
    if (!ok) return;
    const res = await apiDelete('/api/locations/' + id);
    if (res.error) { toastApiError(res, 'Nie udało się przenieść miejsca do kosza'); return; }
    toast('Miejsce w koszu', 'success');
    showTab('locations');
  });
}

async function openEditLocationModal(id) {
  if (!beginOverlayOpen('edit-loc-overlay')) return;
  try {
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
  } finally {
    finishOverlayOpen('edit-loc-overlay');
  }
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
    if (res.error) { toastApiError(res, 'Nie udało się zapisać miejsca'); return; }
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
  return withActionLock(`travel-location-delete-${tlid}`, async () => {
    const ok = await askConfirm({ title: 'Usunąć miejsce z podróży?', confirmText: 'Usuń', danger: true });
    if (!ok) return;
    const res = await apiDelete(`/api/travels/${travelId}/locations/${tlid}`);
    if (res.error) { toastApiError(res, 'Nie udało się usunąć miejsca z podróży'); return; }
    const row = document.getElementById('tl-' + tlid);
    const group = row?.closest('.travel-route-day');
    removeWithSlide(row, () => {
      if (group && !group.querySelector('.loc-row')) group.remove();
      const list = document.getElementById('locations-list');
      if (list && !list.querySelector('.loc-row')) list.innerHTML = `<div class="empty-locs inline-empty">Brak miejsc</div>`;
    });
  });
}

function openEditTravelLocation(travelId, tlid) {
  if (!beginOverlayOpen('edit-tl-overlay')) return;
  const row = document.getElementById('tl-' + tlid);
  if (!row) { finishOverlayOpen('edit-tl-overlay'); return; }
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
  finishOverlayOpen('edit-tl-overlay');
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
    toastApiError(res, 'Nie udało się zapisać pobytu');
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
    const datesEl = document.getElementById('tl-dates-' + tlid);
    if (datesEl) datesEl.textContent = travelVisitDateLabel(arrival, departure);
    const noteWrap = document.getElementById('tl-note-wrap-' + tlid);
    if (noteWrap) noteWrap.innerHTML = travelLocationNoteHtml(tlid, notes);
    else {
      const notesEl = document.getElementById('tl-notes-' + tlid);
      if (notesEl) notesEl.textContent = notes || '';
    }
  }
}

async function openNewLocationModal(travelId, travelStart, travelEnd) {
  if (!beginOverlayOpen('new-loc-overlay')) return;
  try {
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
  } finally {
    finishOverlayOpen('new-loc-overlay');
  }
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
    if (res.error) { toastApiError(res, 'Nie udało się zapisać miejsca'); return; }
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
  if (!beginOverlayOpen('loc-picker-overlay')) return;
  try {
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
  } finally {
    finishOverlayOpen('loc-picker-overlay');
  }
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
    toastApiError(res, 'Nie udało się dodać miejsca do podróży');
    if (btn) { btn.disabled = false; btn.textContent = 'Dodaj miejsce'; }
    return;
  }
  toast('Miejsce dodane', 'success');
  if (addParent) {
    const parentRes = await apiPost(`/api/travels/${travelId}/locations`, { location_id: parentId, arrival_date: arrival, departure_date: departure, notes: null, force_outside_range: true });
    if (parentRes.error) toastApiError(parentRes, 'Miejsce dodane, ale nie udało się dodać miejsca nadrzędnego');
  }
  document.getElementById('loc-confirm-overlay')?.remove();
  document.getElementById('loc-picker-overlay')?.remove();
  openTravel(travelId);
}

/* ── Kosz (soft delete) ───────────────────────────────────── */
async function openTrashModal() {
  if (!beginOverlayOpen('trash-overlay')) return;
  try {
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
  } finally {
    finishOverlayOpen('trash-overlay');
  }
}

function renderTrashBody(data) {
  const body = document.getElementById('trash-body');
  if (!body) return;
  const travels = data.travels || [];
  const locations = data.locations || [];
  if (!travels.length && !locations.length) {
    body.innerHTML = '<div class="trash-empty">Kosz jest pusty</div>';
    return;
  }
  const travelHtml = travels.length ? `
    <div class="form-label trash-section-title">Podróże (${travels.length})</div>
    ${travels.map(t => `
      <div class="trash-row" id="trash-t-${t.id}">
        <div class="loc-icon">✈️</div>
        <div class="trash-row-main">
          <div class="loc-name">${escapeHtml(t.name || '(bez nazwy)')}</div>
          <div class="loc-sub">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</div>
          <div class="loc-sub">usunięto ${fmtDate(t.deleted_at)}</div>
        </div>
        <div class="trash-actions">
          <button class="trash-action restore" onclick="restoreFromTrash('travel', ${t.id})">Przywróć</button>
          <button class="trash-action danger" onclick="hardDeleteFromTrash('travel', ${t.id})">Usuń trwale</button>
        </div>
      </div>`).join('')}
  ` : '';
  const locHtml = locations.length ? `
    <div class="form-label trash-section-title">Miejsca (${locations.length})</div>
    ${locations.map(l => `
      <div class="trash-row" id="trash-l-${l.id}">
        <div class="loc-icon">${locationIcon(l.location_type)}</div>
        <div class="trash-row-main">
          <div class="loc-name">${escapeHtml(l.name)}</div>
          <div class="loc-sub">${escapeHtml(l.location_type)} · ${escapeHtml(l.country_name)}</div>
          <div class="loc-sub">usunięto ${fmtDate(l.deleted_at)}</div>
        </div>
        <div class="trash-actions">
          <button class="trash-action restore" onclick="restoreFromTrash('location', ${l.id})">Przywróć</button>
          <button class="trash-action danger" onclick="hardDeleteFromTrash('location', ${l.id})">Usuń trwale</button>
        </div>
      </div>`).join('')}
  ` : '';
  body.innerHTML = travelHtml + locHtml;
}

async function restoreFromTrash(kind, id) {
  return withActionLock(`trash-restore-${kind}-${id}`, async () => {
    const path = kind === 'travel' ? `/api/travels/${id}/restore` : `/api/locations/${id}/restore`;
    const res = await apiPost(path, {});
    if (res.error) { toastApiError(res, 'Nie udało się przywrócić elementu'); return; }
    const row = document.getElementById(`trash-${kind === 'travel' ? 't' : 'l'}-${id}`);
    removeWithSlide(row, async () => {
      toast('Przywrócono', 'success');
      const data = await api('/api/trash');
      renderTrashBody(data);
    });
  });
}

async function hardDeleteFromTrash(kind, id) {
  return withActionLock(`trash-hard-delete-${kind}-${id}`, async () => {
    const ok = await askConfirm({
      title: 'Usunąć trwale?',
      message: 'Tej operacji NIE można cofnąć.',
      confirmText: 'Usuń trwale', danger: true,
    });
    if (!ok) return;
    const path = (kind === 'travel' ? `/api/travels/${id}` : `/api/locations/${id}`) + '?hard=1';
    const res = await apiDelete(path);
    if (res.error) { toastApiError(res, 'Nie udało się trwale usunąć elementu'); return; }
    const row = document.getElementById(`trash-${kind === 'travel' ? 't' : 'l'}-${id}`);
    removeWithSlide(row, async () => {
      toast('Usunięto trwale', 'success');
      const data = await api('/api/trash');
      renderTrashBody(data);
    });
  });
}
