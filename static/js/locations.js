let currentLocationQualityFilter = getPref('locQuality', 'all');
let currentLocationSort = getPref('locSort', 'country_name');
let currentLocationSearch = '';
let currentLocationCountry = getPref('locCountry', '');
let currentLocationType = getPref('locType', '');
let locationScreenRenderGeneration = 0;
let locationListRenderGeneration = 0;
let locationDetailRenderGeneration = 0;

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

const LOCATION_COLLATOR = typeof Intl !== 'undefined' && Intl.Collator
  ? new Intl.Collator('pl', { sensitivity: 'base' })
  : null;

async function renderLocations(q) {
  const renderGeneration = ++locationScreenRenderGeneration;
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
  if (!allLocationsCacheLoaded) list.innerHTML = skeletonCards(4);
  const locs = await getAllLocations();
  if (
    renderGeneration !== locationScreenRenderGeneration
    || document.getElementById('loc-list') !== list
  ) return;
  if (isApiError(locs)) {
    list.innerHTML = emptyState({ icon: '📍', title: 'Nie udało się wczytać miejsc', message: locs.error });
    return;
  }
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
          <button class="location-tool-button" type="button" onclick="runLocationTool('inspirations')">
            <span class="location-tool-icon">☆</span>
            <span class="location-tool-text"><span class="location-tool-label">Inspiracje</span><span class="location-tool-sub">Lista marzeń i kolekcje miejsc.</span></span>
          </button>
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
    else if (action === 'inspirations') openLocationInspirationsView();
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
    const selected = countryEl.value || currentLocationCountry;
    const countries = [...new Set(locs.map(l => l.country_name).filter(Boolean))].sort(compareLocationText);
    countryEl.innerHTML = renderSelectOptions(countries, selected, { emptyOption: 'Wszystkie kraje' });
  }
  if (typeEl) {
    const selected = typeEl.value || currentLocationType;
    const types = [...new Set(locs.map(l => l.location_type).filter(Boolean))].sort(compareLocationText);
    typeEl.innerHTML = renderSelectOptions(types, selected, { emptyOption: 'Wszystkie typy' });
  }
}

function applyLocTypeFilter() {
  applyLocationFilters();
}

function setLocQualityFilter(filter) {
  currentLocationQualityFilter = filter || 'all';
  savePref('locQuality', currentLocationQualityFilter);
  applyLocationFilters();
}

function setLocSort(sort) {
  currentLocationSort = sort || 'country_name';
  savePref('locSort', currentLocationSort);
  applyLocationFilters();
}

function locationResultLabel(count) {
  return polishPlural(count, 'wynik', 'wyniki', 'wyników');
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
  currentLocationCountry = '';
  currentLocationType = '';
  savePref('locQuality', null);
  savePref('locSort', null);
  savePref('locCountry', null);
  savePref('locType', null);
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

function compareLocationText(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  return LOCATION_COLLATOR
    ? LOCATION_COLLATOR.compare(left, right)
    : left.localeCompare(right, 'pl', { sensitivity: 'base' });
}

function compareLocationDateDesc(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left === right) return 0;
  return right > left ? 1 : -1;
}

function compareLocName(a, b) {
  return compareLocationText(a.name, b.name);
}

function compareLocCountryName(a, b) {
  const country = compareLocationText(a.country_name, b.country_name);
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
  currentLocationType = type;
  currentLocationCountry = country;
  savePref('locType', type);
  savePref('locCountry', country);
  const quality = currentLocationQualityFilter || 'all';
  let locs = Array.isArray(allLocationsCache) ? [...allLocationsCache] : [];
  const search = String(currentLocationSearch || '').trim().toLocaleLowerCase('pl');
  if (search) {
    locs = locs.filter(l =>
      String(l.name || '').toLocaleLowerCase('pl').includes(search)
      || String(l.country_name || '').toLocaleLowerCase('pl').includes(search)
    );
  }
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
    locs.sort((a, b) => compareLocationDateDesc(a.last_visit, b.last_visit) || compareLocCountryName(a, b));
  } else {
    locs.sort(compareLocCountryName);
  }
  updateLocQualityButtons();
  updateLocationFilterSummary(locs.length);
  renderLocList(locs);
}

function locVisitCountLabel(count) {
  count = Number(count || 0);
  return `${count} ${polishPlural(count, 'wizyta', 'wizyty', 'wizyt')}`;
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

function locationHistoryVisits(directVisits, childVisits) {
  const rows = [
    ...(directVisits || []).map(visit => ({ ...visit, _source: 'direct' })),
    ...(childVisits || []).map(visit => ({ ...visit, _source: 'child' })),
  ];
  return rows.sort((a, b) => {
    const right = b.departure_date || b.arrival_date || b.end_date || b.start_date || '';
    const left = a.departure_date || a.arrival_date || a.end_date || a.start_date || '';
    return String(right).localeCompare(String(left));
  });
}

function locationQuality(loc) {
  const quality = loc.quality || {};
  const missing = Array.isArray(quality.missing) ? quality.missing : [];
  const complete = quality.complete === undefined ? missing.length === 0 : Boolean(quality.complete);
  return {
    complete,
    score: Number.isFinite(Number(quality.score)) ? Number(quality.score) : Math.max(0, 100 - missing.length * 25),
    missing,
    missingKeys: Array.isArray(quality.missing_keys) ? quality.missing_keys : missing.map(item => item.key),
  };
}

function locationPassportText(loc) {
  const visits = locationVisitCount(loc);
  const children = Number(loc.child_location_count || (loc.children || []).length || 0);
  if (!visits) {
    return children
      ? `Miejsce ma ${children} ${polishPlural(children, 'miejsce podrzędne', 'miejsca podrzędne', 'miejsc podrzędnych')}, ale czeka jeszcze na pierwszą wizytę w podróży.`
      : 'To miejsce czeka jeszcze na pierwszą wizytę w podróży.';
  }
  const range = loc.first_visit && loc.last_visit
    ? `Historia wizyt obejmuje okres od ${fmtDate(loc.first_visit)} do ${fmtDate(loc.last_visit)}.`
    : 'Historia wizyt ma już zapisane podróże, ale nie wszystkie daty są kompletne.';
  const childPart = children
    ? ` Obejmuje też ${children} ${polishPlural(children, 'miejsce podrzędne', 'miejsca podrzędne', 'miejsc podrzędnych')}.`
    : '';
  return `${range} Łącznie: ${visits} ${polishPlural(visits, 'powiązana podróż', 'powiązane podróże', 'powiązanych podróży')}.${childPart}`;
}

function locationQuickActionsHtml(loc) {
  const quality = locationQuality(loc);
  const actionMap = {
    missing_gps: { label: 'Uzupełnij GPS', focus: 'gps' },
    missing_address: { label: 'Uzupełnij adres', focus: 'address' },
    missing_notes: { label: 'Uzupełnij notatki', focus: 'notes' },
  };
  const actions = quality.missingKeys
    .map(key => ({ key, ...(actionMap[key] || {}) }))
    .filter(action => action.label);
  const visitHint = quality.missingKeys.includes('not_visited')
    ? '<span class="location-action-hint">Brak wizyt: dodaj to miejsce do trasy z poziomu szczegółu podróży.</span>'
    : '';
  if (!actions.length && !visitHint) {
    return '<div class="location-action-hint ok">Dane miejsca wyglądają kompletnie.</div>';
  }
  return `<div class="location-action-row">
    ${actions.map(action => `<button type="button" class="location-quick-action" onclick="openEditLocationModal(${loc.id}, { focus: '${jsStringArg(action.focus)}' })">${escapeHtml(action.label)}</button>`).join('')}
    ${visitHint}
  </div>`;
}

function locationDetailInspirationItem(loc) {
  const inspiration = loc?.inspiration || null;
  if (!inspiration) return null;
  const collections = Array.isArray(loc.collections) ? loc.collections : [];
  return {
    ...loc,
    ...inspiration,
    id: loc.id,
    location_id: loc.id,
    inspiration_notes: inspiration.notes || '',
    collection_count: collections.length,
    collection_names: collections.map(collection => collection.name).filter(Boolean).join(', '),
  };
}

function getLocationInspirationItem(locationId) {
  const cached = (locationInspirationDataCache?.items || [])
    .find(entry => Number(entry.id) === Number(locationId));
  if (cached) return cached;
  const current = window._currentLocationDetail;
  if (Number(current?.id) === Number(locationId)) {
    return locationDetailInspirationItem(current);
  }
  return null;
}

function refreshLocationInspirationSurface(locationId) {
  if (
    currentTab === 'locationDetail'
    && Number(window._currentLocationDetail?.id) === Number(locationId)
  ) {
    openLocation(locationId, { fromRouter: true });
    return;
  }
  if (currentTab === 'locationWishlist') renderLocationInspirations();
}

function renderLocationInspirationPanel(loc) {
  const item = locationDetailInspirationItem(loc);
  const collections = Array.isArray(loc.collections) ? loc.collections : [];
  const collectionChips = collections.length
    ? `<div class="location-inspiration-chips">
        ${collections.map(collection => `<button type="button" class="location-inspiration-chip" onclick="openLocationCollectionModal(${collection.id})">${escapeHtml(collection.name || 'Kolekcja')}</button>`).join('')}
      </div>`
    : '<div class="location-inspiration-empty">Brak kolekcji przy tym miejscu.</div>';
  const collectionAction = `<button type="button" class="location-quick-action" onclick="openAddInspirationToCollectionModal(${loc.id})">Dodaj do kolekcji</button>`;

  if (!item) {
    return `<div class="location-inspiration-panel empty">
      <div class="location-inspiration-main">
        <div class="location-passport-label">Inspiracje</div>
        <div class="location-inspiration-title">Nie ma go jeszcze na liscie marzen</div>
        <div class="location-inspiration-sub">Dodaj miejsce jako pomysl na przyszla podroz albo przypnij je do kolekcji.</div>
        ${collectionChips}
      </div>
      <div class="location-inspiration-actions">
        <button type="button" class="location-quick-action" onclick="addExistingLocationInspiration(${loc.id})">Dodaj do inspiracji</button>
        ${collectionAction}
      </div>
    </div>`;
  }

  const statusButtons = [
    ['planning', 'W planie'],
    ['want', 'Chce odwiedzic'],
    ['paused', 'Odloz'],
  ].filter(([status]) => status !== item.status);
  const summary = [
    locationInspirationStatusLabel(item.status),
    `priorytet ${locationInspirationPriorityLabel(item.priority)}`,
    item.season || '',
  ].filter(Boolean).join(' · ');

  return `<div class="location-inspiration-panel">
    <div class="location-inspiration-main">
      <div class="location-passport-label">Inspiracje</div>
      <div class="location-inspiration-title">${escapeHtml(summary)}</div>
      ${item.inspiration_notes ? `<div class="location-inspiration-note-detail">${escapeHtml(item.inspiration_notes)}</div>` : ''}
      ${collectionChips}
    </div>
    <div class="location-inspiration-actions">
      ${statusButtons.map(([status, label]) => `<button type="button" class="location-quick-action" onclick="updateLocationInspiration(${loc.id}, '${jsStringArg(status)}')">${escapeHtml(label)}</button>`).join('')}
      <button type="button" class="location-quick-action" onclick="openEditLocationInspirationModal(${loc.id})">Edytuj</button>
      ${collectionAction}
      <button type="button" class="location-quick-action danger-text" onclick="removeLocationInspiration(${loc.id})">Usun</button>
    </div>
  </div>`;
}

function renderLocationChildren(loc) {
  const children = Array.isArray(loc.children) ? loc.children : [];
  if (!children.length) return '';
  return `<div class="section location-children-section">
    <div class="section-header">
      <div class="section-title">Miejsca podrzędne</div>
      <span class="location-section-count">${children.length}</span>
    </div>
    <div class="location-child-list">
      ${children.map(child => `<button class="location-child-row" type="button" onclick="openLocation(${child.id})">
        <span class="location-visit-icon">${locationIcon(child.location_type)}</span>
        <span class="location-child-main">
          <span class="location-visit-name">${escapeHtml(child.name || '(bez nazwy)')}</span>
          <span class="location-visit-sub">${escapeHtml(child.location_type || 'typ nieznany')} · ${locVisitSummary(child)}</span>
        </span>
        <span class="list-chevron">›</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderLocationExpandableText(text, className = '') {
  const value = String(text || '').trim();
  const escaped = escapeHtml(value);
  if (value.length <= 180) {
    return `<strong class="${escapeAttr(className)}">${escaped}</strong>`;
  }
  return `<details class="location-expandable-text">
    <summary>
      <span class="location-text-preview ${escapeAttr(className)}">${escaped}</span>
      <span class="location-text-toggle" aria-hidden="true"></span>
    </summary>
    <div class="location-text-full ${escapeAttr(className)}">${escaped}</div>
  </details>`;
}

function renderLocationDetailProfile(loc, directVisits, childVisits) {
  const hasGps = locationHasGps(loc);
  const quality = locationQuality(loc);
  const qualityTone = quality.complete ? 'ok' : 'warn';
  const gpsText = hasGps
    ? `${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}`
    : 'Brak współrzędnych';
  const mapsHref = hasGps ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.latitude},${loc.longitude}`)}` : '';
  const totalVisits = locationVisitCount(loc);
  const directCount = Number(loc.direct_visit_count ?? directVisits.length);
  const childCount = Number(loc.child_visit_count ?? childVisits.length);
  const childLocationCount = Number(loc.child_location_count ?? (loc.children || []).length);
  const inspirationItem = locationDetailInspirationItem(loc);
  return `<div class="section location-detail-card">
    <div class="location-profile-top">
      <div class="location-profile-icon">${locationIcon(loc.location_type)}</div>
      <div class="location-profile-main">
        <div class="location-profile-title">${escapeHtml(loc.name || '(bez nazwy)')}</div>
        <div class="location-profile-sub">${escapeHtml(loc.location_type || 'typ nieznany')} · ${escapeHtml(loc.country_name || 'kraj nieznany')}</div>
        <div class="location-detail-badges">
          <span class="location-detail-badge">${escapeHtml(locVisitSummary(loc))}</span>
          <span class="location-detail-badge ${hasGps ? 'ok' : 'warn'}">${hasGps ? 'GPS zapisany' : 'Bez GPS'}</span>
          <span class="location-detail-badge ${qualityTone}">${quality.complete ? 'Kompletne' : `${quality.score}% kompletności`}</span>
          ${inspirationItem ? `<span class="location-detail-badge inspiration">${escapeHtml(locationInspirationStatusLabel(inspirationItem.status))}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="location-passport">
      <div>
        <div class="location-passport-label">Paszport miejsca</div>
        <div class="location-passport-text">${escapeHtml(locationPassportText(loc))}</div>
      </div>
      ${locationQuickActionsHtml(loc)}
    </div>
    ${renderLocationInspirationPanel(loc)}
    ${renderMetricGrid([
      { label: 'Pierwsza wizyta', value: loc.first_visit ? fmtDate(loc.first_visit) : '—' },
      { label: 'Ostatnia wizyta', value: loc.last_visit ? fmtDate(loc.last_visit) : '—' },
      { label: 'Podróże', value: totalVisits || 0 },
      { label: 'Bezpośrednie', value: directCount || 0 },
      { label: 'Przez podrzędne', value: childCount || 0 },
      { label: 'Miejsca podrzędne', value: childLocationCount || 0 },
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
      ${loc.address ? `<div class="location-meta-item wide"><span>Opis / adres</span>${renderLocationExpandableText(loc.address)}</div>` : ''}
      <div class="location-meta-item wide">
        <span>Współrzędne GPS</span>
        <strong class="mono-detail">${escapeHtml(gpsText)}${hasGps ? ` <a class="text-link" href="${mapsHref}" target="_blank" rel="noopener">Google Maps</a>` : ''}</strong>
      </div>
      ${loc.notes ? `<div class="location-meta-item wide"><span>Notatki</span>${renderLocationExpandableText(loc.notes, 'notes-text')}</div>` : ''}
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
          ${child || v.child_location_name ? `<span class="location-visit-sub">${escapeHtml(v.child_location_name || '')}</span>` : ''}
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
  return renderEntityCard({
    onclick: `openLocation(${l.id})`,
    iconHtml: locationIcon(l.location_type),
    iconStyle: 'background:var(--blue-light)',
    title: l.name || '(bez nazwy)',
    subtitles: [
      { html: `${country}${type}${parent}` },
      locVisitSummary(l),
      l.address ? { text: l.address, className: 'card-subtitle location-card-description' } : '',
    ],
    metaHtml: gpsBadge ? `<div class="card-meta">${gpsBadge}</div>` : '',
    trailingHtml: '<div class="card-chevron">›</div>',
  });
}

function locationCardBatches(locs, batchSize = 60) {
  if (currentLocationSort !== 'country_name') {
    const batches = [];
    for (let i = 0; i < locs.length; i += batchSize) {
      batches.push(renderCardList(
        locs.slice(i, i + batchSize),
        l => locCardHtml(l, true),
        {
          className: `card-list progressive-card-list${batches.length === 0 ? ' animate-card-list' : ''}`,
        },
      ));
    }
    return batches;
  }

  const grouped = {};
  locs.forEach(l => {
    if (!grouped[l.country_name]) grouped[l.country_name] = [];
    grouped[l.country_name].push(l);
  });
  const batches = [];
  Object.entries(grouped).forEach(([country, items]) => {
    for (let i = 0; i < items.length; i += batchSize) {
      const header = i === 0
        ? `<div class="country-header">${escapeHtml(country)}</div>`
        : '';
      batches.push(header + renderCardList(
        items.slice(i, i + batchSize),
        l => locCardHtml(l),
        {
          className: `card-list compact-card-list progressive-card-list${batches.length === 0 ? ' animate-card-list' : ''}`,
        },
      ));
    }
  });
  return batches;
}

function renderLocationBatches(list, batches) {
  const generation = ++locationListRenderGeneration;
  list.innerHTML = '';
  if (typeof list.insertAdjacentHTML !== 'function') {
    list.innerHTML = batches.join('');
    applyRestoreScroll();
    return;
  }

  let index = 0;
  const appendNext = () => {
    if (
      generation !== locationListRenderGeneration
      || document.getElementById('loc-list') !== list
    ) return;
    const end = Math.min(index + 2, batches.length);
    while (index < end) {
      list.insertAdjacentHTML('beforeend', batches[index]);
      index += 1;
    }
    if (index < batches.length) {
      const schedule = typeof window !== 'undefined' && window.requestIdleCallback
        ? callback => window.requestIdleCallback(callback, { timeout: 80 })
        : callback => setTimeout(callback, 0);
      schedule(appendNext);
    } else {
      applyRestoreScroll();
    }
  };
  appendNext();
}

function renderLocList(locs) {
  const list = document.getElementById('loc-list');
  if (!locs.length) {
    locationListRenderGeneration += 1;
    const hasFilter = locationFilterActiveLabels().length > 0;
    list.innerHTML = hasFilter
      ? emptyState({ icon: '🔍', title: 'Brak wyników', message: 'Spróbuj innego zapytania albo wyczyść filtry.' })
      : emptyState({ icon: '📍', title: 'Brak miejsc', message: 'Dodaj pierwsze miejsce do swojej kolekcji podróży.', ctaLabel: '＋ Nowe miejsce', ctaOnclick: 'openNewLocationModal()' });
    applyRestoreScroll();
    return;
  }
  renderLocationBatches(list, locationCardBatches(locs));
}

function onLocSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => renderLocations(val), 400); }

let currentLocationTodoFilter = getPref('locationTodoFilter', 'all');
let currentLocationTodoSort = getPref('locationTodoSort', 'priority');
let currentLocationTodoGroup = getPref('locationTodoGroup', 'none');
let locationTodoDataCache = null;
let locationTodoLoadPromise = null;
let locationTodoRenderGeneration = 0;

async function getLocationTodoData() {
  if (locationTodoDataCache) return locationTodoDataCache;
  if (locationTodoLoadPromise) return locationTodoLoadPromise;
  const requestVersion = getFrontendDataCacheVersion();
  const pending = api('/api/locations/todo').then(data => {
    if (requestVersion !== getFrontendDataCacheVersion()) {
      return getLocationTodoData();
    }
    if (data && !data.error) locationTodoDataCache = data;
    return data;
  }).finally(() => {
    if (locationTodoLoadPromise === pending) locationTodoLoadPromise = null;
  });
  locationTodoLoadPromise = pending;
  return pending;
}

registerDataCacheInvalidator(() => {
  locationTodoDataCache = null;
  locationTodoLoadPromise = null;
});

const LOCATION_TODO_SORTS = [
  { key: 'priority', label: 'Priorytet' },
  { key: 'missing_desc', label: 'Najwięcej braków' },
  { key: 'country_name', label: 'Kraj i nazwa' },
  { key: 'name_asc', label: 'Nazwa A-Z' },
  { key: 'visit_count_asc', label: 'Najmniej wizyt' },
];

const LOCATION_TODO_BADGE_TONES = {
  missing_gps: 'orange',
  missing_address: 'purple',
  missing_notes: 'blue',
  not_visited: 'green',
};

const LOCATION_TODO_GROUPS = [
  { key: 'none', label: 'Bez grupowania' },
  { key: 'country', label: 'Kraj' },
  { key: 'missing', label: 'Typ braku' },
];

const LOCATION_TODO_MISSING_GROUP_ORDER = [
  'missing_gps',
  'missing_address',
  'missing_notes',
  'not_visited',
];

const LOCATION_TODO_ACTIONS = {
  missing_gps: { label: 'GPS', focus: 'gps' },
  missing_address: { label: 'Adres', focus: 'address' },
  missing_notes: { label: 'Notatki', focus: 'notes' },
  not_visited: { label: 'Przypisz', view: 'assign' },
};

function openLocationTodoView() {
  showTab('locationTodo');
}

function setLocationTodoFilter(filter) {
  currentLocationTodoFilter = filter || 'all';
  savePref('locationTodoFilter', currentLocationTodoFilter === 'all' ? null : currentLocationTodoFilter);
  syncLocationTodoRoute();
  renderLocationTodo();
}

function setLocationTodoSort(sort) {
  currentLocationTodoSort = sort || 'priority';
  savePref('locationTodoSort', currentLocationTodoSort === 'priority' ? null : currentLocationTodoSort);
  syncLocationTodoRoute();
  renderLocationTodo();
}

function setLocationTodoGroup(group) {
  currentLocationTodoGroup = group || 'none';
  savePref('locationTodoGroup', currentLocationTodoGroup === 'none' ? null : currentLocationTodoGroup);
  syncLocationTodoRoute();
  renderLocationTodo();
}

function resetLocationTodoControls() {
  currentLocationTodoFilter = 'all';
  currentLocationTodoSort = 'priority';
  currentLocationTodoGroup = 'none';
  savePref('locationTodoFilter', null);
  savePref('locationTodoSort', null);
  savePref('locationTodoGroup', null);
  syncLocationTodoRoute();
  renderLocationTodo();
}

function renderLocationTodoControls({ filters, totalItems, visibleItems }) {
  const activeFilter = filters.find(f => f.key === currentLocationTodoFilter);
  const activeSort = LOCATION_TODO_SORTS.find(s => s.key === currentLocationTodoSort) || LOCATION_TODO_SORTS[0];
  const activeGroup = LOCATION_TODO_GROUPS.find(g => g.key === currentLocationTodoGroup) || LOCATION_TODO_GROUPS[0];
  const details = [];
  if (activeFilter) details.push(activeFilter.label);
  if (activeSort.key !== 'priority') details.push(activeSort.label);
  if (activeGroup.key !== 'none') details.push(`Grupowanie: ${activeGroup.label}`);
  const hasActiveControls = currentLocationTodoFilter !== 'all'
    || currentLocationTodoSort !== 'priority'
    || currentLocationTodoGroup !== 'none';
  return renderFilterPanel({
    controls: [
      {
        label: 'Typ braku',
        id: 'location-todo-filter-select',
        onchange: 'setLocationTodoFilter(this.value)',
        options: filters,
        selectedValue: currentLocationTodoFilter,
        valueKey: 'key',
        emptyOption: { key: 'all', label: 'Wszystkie braki' },
      },
      {
        label: 'Sortowanie',
        id: 'location-todo-sort-select',
        onchange: 'setLocationTodoSort(this.value)',
        options: LOCATION_TODO_SORTS,
        selectedValue: currentLocationTodoSort,
        valueKey: 'key',
      },
      {
        label: 'Grupowanie',
        id: 'location-todo-group-select',
        onchange: 'setLocationTodoGroup(this.value)',
        options: LOCATION_TODO_GROUPS,
        selectedValue: currentLocationTodoGroup,
        valueKey: 'key',
      },
    ],
    gridClass: 'aux-filter-grid location-todo-filter-grid',
    summary: {
      count: visibleItems,
      countLabel: worklistCountLabel(visibleItems),
      detail: details.length ? details : `${totalItems} miejsc wymaga uwagi`,
      resetOnclick: hasActiveControls ? 'resetLocationTodoControls()' : '',
    },
  });
}

function locationTodoRouteQuery() {
  const parts = [];
  if (currentLocationTodoFilter && currentLocationTodoFilter !== 'all') {
    parts.push(`missing=${encodeURIComponent(currentLocationTodoFilter)}`);
  }
  if (currentLocationTodoSort && currentLocationTodoSort !== 'priority') {
    parts.push(`sort=${encodeURIComponent(currentLocationTodoSort)}`);
  }
  if (currentLocationTodoGroup && currentLocationTodoGroup !== 'none') {
    parts.push(`group=${encodeURIComponent(currentLocationTodoGroup)}`);
  }
  return parts.join('&');
}

function syncLocationTodoRoute() {
  if (!canUseHashRouter() || !window.history || !window.history.replaceState) return;
  const query = locationTodoRouteQuery();
  window.history.replaceState(null, '', '#/locations/todo' + (query ? '?' + query : ''));
}

function applyLocationTodoRouteParams(params = {}) {
  const filter = params.missing || params.filter;
  const sort = params.sort;
  const group = params.group;
  if (filter) currentLocationTodoFilter = filter;
  if (sort) currentLocationTodoSort = sort;
  if (group) currentLocationTodoGroup = group;
}

function locationTodoPriorityScore(item) {
  const keys = item.missing_keys || [];
  return (Number(item.missing_count || 0) * 10)
    + (keys.includes('missing_gps') ? 4 : 0)
    + (keys.includes('missing_address') ? 3 : 0)
    + (keys.includes('missing_notes') ? 2 : 0)
    + (keys.includes('not_visited') ? 1 : 0);
}

function compareLocationTodoText(a, b) {
  return compareLocationText(a, b);
}

function locationTodoSortRecord(item, index) {
  return {
    item,
    index,
    countryName: item.country_name || '',
    name: item.name || '',
    missingCount: Number(item.missing_count || 0),
    priorityScore: locationTodoPriorityScore(item),
    visitCount: Number(item.visit_count || 0),
  };
}

function compareLocationTodoName(a, b) {
  return compareLocationTodoText(a.name, b.name) || (a.index - b.index);
}

function compareLocationTodoCountryName(a, b) {
  return compareLocationTodoText(a.countryName, b.countryName)
    || compareLocationTodoText(a.name, b.name)
    || (a.index - b.index);
}

function sortLocationTodoItems(items) {
  const sorted = (items || []).map(locationTodoSortRecord);
  if (currentLocationTodoSort === 'missing_desc') {
    sorted.sort((a, b) => (b.missingCount - a.missingCount) || compareLocationTodoCountryName(a, b));
    return sorted.map(record => record.item);
  }
  if (currentLocationTodoSort === 'country_name') return sorted.sort(compareLocationTodoCountryName).map(record => record.item);
  if (currentLocationTodoSort === 'name_asc') return sorted.sort(compareLocationTodoName).map(record => record.item);
  if (currentLocationTodoSort === 'visit_count_asc') {
    sorted.sort((a, b) => (a.visitCount - b.visitCount) || compareLocationTodoCountryName(a, b));
    return sorted.map(record => record.item);
  }
  sorted.sort((a, b) => (b.priorityScore - a.priorityScore) || compareLocationTodoCountryName(a, b));
  return sorted.map(record => record.item);
}

function locationTodoBadgeItems(item, labels) {
  return (item.missing_keys || []).map(key => ({
    label: labels[key] || key,
    tone: LOCATION_TODO_BADGE_TONES[key] || 'orange',
  }));
}

function openLocationTodoAction(id, missingKey) {
  const action = LOCATION_TODO_ACTIONS[missingKey];
  if (!action) return openLocation(id);
  if (action.view === 'assign') return openLocationTodoTravelPicker(id);
  return openEditLocationModal(id, { focus: action.focus, returnToLocationTodo: true });
}

async function openLocationTodoTravelPicker(locationId) {
  if (!beginOverlayOpen('location-todo-travel-picker-overlay')) return;
  try {
    const [data, travels] = await Promise.all([getLocationTodoData(), getTravelList()]);
    const location = (data?.needs_attention || []).find(item => Number(item.id) === Number(locationId));
    if (!location) { toast('Nie znaleziono miejsca na liście braków', 'error'); return; }
    if (!Array.isArray(travels) || !travels.length) {
      toast('Najpierw dodaj podróż', 'info');
      return;
    }
    document.getElementById('location-todo-travel-picker-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'location-todo-travel-picker-overlay';
    overlay._location = location;
    overlay._travels = travels;
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">Przypisz do podróży</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('location-todo-travel-picker-overlay'))">Anuluj</button></div>
      <div class="form-section">
        <div class="form-hint">${escapeHtml(location.name)} · wybierz podróż</div>
        <div class="modal-scroll-list">
          ${travels.map(travel => renderPickerRow({
            onclick: `selectLocationTodoTravel(${travel.id})`,
            iconHtml: purposeIcon(travel.purpose),
            iconClass: 'picker-row-icon',
            title: travel.name,
            subtitle: `${fmtDate(travel.start_date)} – ${fmtDate(travel.end_date)}`,
          })).join('')}
        </div>
      </div></div>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal(overlay);
    });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('location-todo-travel-picker-overlay');
  }
}

function selectLocationTodoTravel(travelId) {
  const overlay = document.getElementById('location-todo-travel-picker-overlay');
  const location = overlay?._location;
  const travel = (overlay?._travels || []).find(item => Number(item.id) === Number(travelId));
  if (!location || !travel) return;
  closeModal(overlay);
  openConfirmAddLocation(
    travel.id,
    location.id,
    location.name,
    location.location_type,
    travel.start_date,
    travel.end_date,
    location.parent_location_id || null,
    location.parent_name || '',
  );
  const confirmOverlay = document.getElementById('loc-confirm-overlay');
  if (confirmOverlay) confirmOverlay._returnToLocationTodo = true;
}

function locationTodoActionsHtml(item) {
  const actions = (item.missing_keys || [])
    .map(key => ({ key, ...(LOCATION_TODO_ACTIONS[key] || {}) }))
    .filter(action => action.label);
  if (!actions.length) return '';
  return `<div class="worklist-card-actions">
    ${actions.map(action => `<button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); openLocationTodoAction(${item.id}, '${jsStringArg(action.key)}')">${escapeHtml(action.label)}</button>`).join('')}
  </div>`;
}

function locationTodoTravelsHtml(item) {
  const travels = Array.isArray(item.travels) ? item.travels : [];
  if (!travels.length) {
    return `<div class="worklist-card-actions">
      <button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); openLocation(${item.id})">Brak podróży · otwórz miejsce</button>
    </div>`;
  }
  return `<div class="worklist-card-actions">
    ${travels.map(travel => `<button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); openTravel(${travel.id})">Podróż: ${escapeHtml(travel.name || '(bez nazwy)')}</button>`).join('')}
  </div>`;
}

function locationTodoCardHtml(item, labels) {
  const missingCount = Number(item.missing_count || (item.missing_keys || []).length || 0);
  const missingLabel = polishPlural(missingCount, 'brak', 'braki', 'braków');
  return renderWorklistCard({
    onclick: `openLocation(${item.id})`,
    iconHtml: locationIcon(item.location_type),
    title: item.name || '(bez nazwy)',
    editOnclick: `openEditLocationModal(${item.id}, { returnToLocationTodo: true })`,
    subtitle: `${item.location_type || ''} · ${item.country_name || ''} · ${item.visit_count || 0} wizyt · ${missingCount} ${missingLabel}`,
    badges: locationTodoBadgeItems(item, labels),
    actionsHtml: locationTodoTravelsHtml(item) + locationTodoActionsHtml(item),
  });
}

function locationTodoPrimaryMissingKey(item) {
  const keys = item.missing_keys || [];
  if (currentLocationTodoFilter !== 'all' && keys.includes(currentLocationTodoFilter)) {
    return currentLocationTodoFilter;
  }
  return LOCATION_TODO_MISSING_GROUP_ORDER.find(key => keys.includes(key)) || keys[0] || 'other';
}

function locationTodoGroupInfo(item, labels) {
  if (currentLocationTodoGroup === 'country') {
    const label = item.country_name || 'Bez kraju';
    return { key: `country:${label}`, label };
  }
  if (currentLocationTodoGroup === 'missing') {
    const key = locationTodoPrimaryMissingKey(item);
    return { key: `missing:${key}`, label: labels[key] || key };
  }
  return { key: 'all', label: '' };
}

function locationTodoGroupSortValue(group) {
  if (currentLocationTodoGroup !== 'missing') return group.label;
  const key = group.key.replace('missing:', '');
  const index = LOCATION_TODO_MISSING_GROUP_ORDER.indexOf(key);
  return index === -1 ? LOCATION_TODO_MISSING_GROUP_ORDER.length : index;
}

function groupLocationTodoItems(items, labels) {
  if (currentLocationTodoGroup === 'none') {
    return [{ key: 'all', label: '', items }];
  }
  const groups = new Map();
  items.forEach(item => {
    const info = locationTodoGroupInfo(item, labels);
    if (!groups.has(info.key)) groups.set(info.key, { ...info, items: [] });
    groups.get(info.key).items.push(item);
  });
  const grouped = [...groups.values()];
  if (currentLocationTodoGroup === 'missing') {
    grouped.sort((a, b) => {
      const av = locationTodoGroupSortValue(a);
      const bv = locationTodoGroupSortValue(b);
      return (av - bv) || compareLocationTodoText(a.label, b.label);
    });
    return grouped;
  }
  grouped.sort((a, b) => compareLocationTodoText(a.label, b.label));
  return grouped;
}

function renderLocationTodoGroupedList(items, labels) {
  const groups = groupLocationTodoItems(items, labels);
  if (currentLocationTodoGroup === 'none') {
    return renderCardList(items, item => locationTodoCardHtml(item, labels), { className: 'card-list worklist-list' });
  }
  return `<div class="card-list worklist-list location-todo-grouped-list">
    ${groups.map(group => `<section class="worklist-group">
      <div class="worklist-group-header">
        <div class="worklist-group-title">${escapeHtml(group.label)}</div>
        <div class="worklist-group-count">${group.items.length} ${worklistCountLabel(group.items.length)}</div>
      </div>
      <div class="worklist-group-items">
        ${group.items.map(item => locationTodoCardHtml(item, labels)).join('')}
      </div>
    </section>`).join('')}
  </div>`;
}

async function renderLocationTodo(params = {}) {
  const renderGeneration = ++locationTodoRenderGeneration;
  applyLocationTodoRouteParams(params);
  const view = document.getElementById('view');
  if (!locationTodoDataCache) {
    view.innerHTML = `<div class="page-header"><div class="page-title">Miejsca do uzupełnienia</div></div>` + skeletonCards(3);
  }
  const data = await getLocationTodoData();
  if (
    renderGeneration !== locationTodoRenderGeneration
    || document.getElementById('view') !== view
    || currentTab !== 'locationTodo'
  ) return;
  if (data.error) {
    view.innerHTML = emptyState({ icon: '📍', title: 'Nie udało się wczytać listy', message: data.error });
    return;
  }

  const labels = data.labels || {};
  const filters = Object.entries(labels)
    .map(([key, label]) => ({ key, label, count: data.counts?.[key] || 0 }))
    .filter(f => f.count > 0 || f.key === currentLocationTodoFilter);
  if (currentLocationTodoFilter !== 'all' && !filters.some(f => f.key === currentLocationTodoFilter)) {
    currentLocationTodoFilter = 'all';
  }
  if (!LOCATION_TODO_SORTS.some(s => s.key === currentLocationTodoSort)) {
    currentLocationTodoSort = 'priority';
  }
  if (!LOCATION_TODO_GROUPS.some(g => g.key === currentLocationTodoGroup)) {
    currentLocationTodoGroup = 'none';
  }
  const filteredItems = (data.needs_attention || []).filter(item =>
    currentLocationTodoFilter === 'all' || (item.missing_keys || []).includes(currentLocationTodoFilter)
  );
  const items = sortLocationTodoItems(filteredItems);
  const highPriorityCount = (data.needs_attention || []).filter(item => Number(item.missing_count || 0) >= 3).length;

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
      { value: highPriorityCount, label: 'wysoki priorytet' },
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

  html += renderLocationTodoGroupedList(items, labels);
  view.innerHTML = html;
}

async function openLocation(id, options = {}) {
  if (!options.fromRouter && currentTab !== 'map') clearTravelMapReturnContext();
  if (!options.fromRouter && canUseHashRouter()) {
    navigateTo('locationDetail', { id });
    return;
  }
  setMapViewMode(false);
  const renderGeneration = ++locationDetailRenderGeneration;
  const view = document.getElementById('view');
  resetViewScroll(view);
  view.innerHTML = skeletonCards(3);
  const loc = await api('/api/locations/' + id);
  if (
    renderGeneration !== locationDetailRenderGeneration
    || currentTab !== 'locationDetail'
  ) return;
  if (!loc || !loc.id || isApiError(loc)) {
    if (loc && loc.error) toast('Nie znaleziono miejsca', 'error');
    showTab('locations');
    return;
  }
  const directVisits = Array.isArray(loc.visits) ? loc.visits : [];
  const childVisits = Array.isArray(loc.child_visits) ? loc.child_visits : [];
  const historyVisits = locationHistoryVisits(directVisits, childVisits);
  window._currentLocationDetail = loc;
  const backButton = hasTravelMapReturnContext()
    ? '<button class="back-btn" onclick="returnToTravelMap()">‹ Trasa na mapie</button>'
    : '<button class="back-btn" onclick="showTab(\'locations\')">‹ Miejsca</button>';
  view.innerHTML = `
    <div class="detail-header">
      ${backButton}
      <div class="detail-title">${escapeHtml(loc.name)}</div>
      <div class="detail-sub">${escapeHtml(loc.location_type)} · ${escapeHtml(loc.country_name)}</div>
    </div>
    <div class="detail-body">
      ${renderLocationDetailProfile(loc, directVisits, childVisits)}
      ${renderLocationChildren(loc)}
      ${renderLocationVisitSection('Historia wizyt', historyVisits, '✈️')}
      <button class="delete-btn" onclick="confirmDeleteLocation(${loc.id})">🗑 Usuń miejsce</button>
      <div style="height:12px"></div>
    </div>
    <button class="fab" onclick="openEditLocationModal(${loc.id})">✎</button>`;
}

async function confirmDeleteLocation(id) {
  return withActionLock(`location-delete-${id}`, async () => {
    const res = await apiDelete('/api/locations/' + id);
    if (res.error) { toastApiError(res, 'Nie udało się przenieść miejsca do kosza'); return; }
    showTab('locations');
    toastAction('Miejsce przeniesione do kosza', 'Cofnij', async () => {
      const r = await apiPost('/api/locations/' + id + '/restore', {});
      if (r.error) { toastApiError(r, 'Nie udało się przywrócić miejsca'); return; }
      toast('Przywrócono miejsce', 'success');
      showTab('locations');
    });
  });
}

function focusEditLocationField(focus) {
  const targetId = {
    gps: 'el-lat',
    address: 'el-address',
    notes: 'el-notes',
  }[focus];
  if (!targetId) return;
  setTimeout(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); }
      catch { el.focus(); }
    }
    if (typeof el.select === 'function' && el.tagName !== 'TEXTAREA') el.select();
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
  }, 40);
}

function closeEditLocationModal() {
  const overlay = document.getElementById('edit-loc-overlay');
  const discardMapReturn = Boolean(overlay?._returnToTravelMap && currentTab === 'map');
  closeModal(overlay);
  if (discardMapReturn) discardTravelMapReturnContext();
}

async function openEditLocationModal(id, options = {}) {
  if (!beginOverlayOpen('edit-loc-overlay')) return;
  try {
  const [loc, countries, locTypes, allLocs] = await Promise.all([
    api('/api/locations/' + id),
    api('/api/countries'),
    api('/api/location_types'),
    getAllLocations()
  ]);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'edit-loc-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Edytuj miejsce</span>
      <button class="modal-save" onclick="closeEditLocationModal()">Anuluj</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa miejsca *</div>
      <input class="form-input" id="el-name" value="${escapeAttr(loc.name || '')}">
      <div class="form-row">
        <div><div class="form-label">Kraj *</div>
          <select class="form-input" id="el-country" onchange="updateParentLocListFor('edit-loc-overlay','el')">
            ${renderSelectOptions(countries, loc.country_id, { emptyOption: '– wybierz –', valueKey: 'id', labelKey: 'name' })}
          </select></div>
        <div><div class="form-label">Typ miejsca *</div>
          <select class="form-input" id="el-type">
            ${renderSelectOptions(locTypes, loc.location_type_id, { emptyOption: '– wybierz –', valueKey: 'id', labelKey: 'name' })}
          </select></div>
      </div>
      <div class="form-label">Miejsce nadrzędne (opcjonalnie)</div>
      <select class="form-input" id="el-parent"><option value="">– brak –</option></select>
      <div class="form-label">Adres / opis (opcjonalnie)</div>
      <input class="form-input" id="el-address" value="${escapeAttr(loc.address || '')}">
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
  overlay._returnToTravelMap = options.returnToTravelMap === true
    || (options.returnToTravelMap !== false && hasTravelMapReturnContext());
  overlay._returnToLocationTodo = options.returnToLocationTodo === true;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEditLocationModal(); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', closeEditLocationModal);
  document.getElementById('el-notes').value = loc.notes || '';
  updateParentLocListFor('edit-loc-overlay', 'el');
  focusEditLocationField(options.focus);
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
        <div onclick="selectGeoResult('${jsStringArg(prefix)}',${parseFloat(r.lat).toFixed(5)},${parseFloat(r.lon).toFixed(5)})"
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
  const options = filtered.map(l => ({
    id: l.id,
    label: `${l.name || ''} (${l.location_type || ''})`,
  }));
  document.getElementById(prefix+'-parent').innerHTML = renderSelectOptions(options, currentParentId, {
    emptyOption: '– brak –',
    valueKey: 'id',
    labelKey: 'label',
  });
}

async function saveEditLocation(id) {
  const btn = document.getElementById('el-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;
  const overlay = document.getElementById('edit-loc-overlay');
  const returnToMap = Boolean(overlay?._returnToTravelMap);
  const returnToLocationTodo = Boolean(overlay?._returnToLocationTodo);
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
    closeModal(overlay);
    toast('Zapisano', 'success');
    if (returnToMap) returnToTravelMap();
    else if (returnToLocationTodo) renderLocationTodo();
    else openLocation(id);
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
    removeWithSlide(row, () => {
      if (window._currentTravel?.locations) {
        window._currentTravel.locations = window._currentTravel.locations.filter(
          location => Number(location.id) !== Number(tlid),
        );
      }
      rerenderCurrentTravelRoute();
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
      <input class="form-input" id="etl-notes" value="${escapeAttr(notes)}">
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
  const currentLocation = window._currentTravel?.locations?.find(
    location => Number(location.id) === Number(tlid),
  );
  if (currentLocation) {
    currentLocation.arrival_date = arrival;
    currentLocation.departure_date = departure;
    currentLocation.notes = notes;
    if (res.visit_order != null) currentLocation.visit_order = Number(res.visit_order);
    rerenderCurrentTravelRoute();
    return;
  }
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
  const [countries, locTypes, allLocs] = await Promise.all([api('/api/countries'), api('/api/location_types'), getAllLocations()]);
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
  const locs = await getAllLocations();
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
      <button class="form-secondary-btn" onclick="openNewLocationModal(${travelId}, '${jsStringArg(travelStart)}', '${jsStringArg(travelEnd)}')">
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
  if (!locs.length) return `<div class="modal-list-empty">Brak wyników</div>`;
  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  return Object.entries(grouped).map(([country, items]) => `
    <div class="picker-group-label">${escapeHtml(country)}</div>
    ${items.map(l => renderPickerRow({
      onclick: `openConfirmAddLocation(${travelId}, ${l.id}, '${jsStringArg(l.name)}', '${jsStringArg(l.location_type)}', '${jsStringArg(travelStart)}', '${jsStringArg(travelEnd)}', ${l.parent_location_id || 'null'}, '${jsStringArg(l.parent_name || '')}')`,
      iconHtml: locationIcon(l.location_type),
      iconClass: 'picker-row-icon',
      title: l.name,
      subtitle: `${l.location_type || ''}${l.parent_name ? ' · ' + l.parent_name : ''}`,
    })).join('')}`).join('');
}

function filterLocPicker(q) {
  const overlay = document.getElementById('loc-picker-overlay'); if (!overlay) return;
  const all = overlay._allLocs || [];
  const query = String(q || '').trim().toLowerCase();
  const filtered = query
    ? all.filter(l => (l.name || '').toLowerCase().includes(query) || (l.country_name || '').toLowerCase().includes(query))
    : all;
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
  const returnToLocationTodo = Boolean(document.getElementById('loc-confirm-overlay')?._returnToLocationTodo);
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
  if (returnToLocationTodo) renderLocationTodo();
  else openTravel(travelId);
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
