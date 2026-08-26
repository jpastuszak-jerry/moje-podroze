/* Location inspirations and collections views, forms and cache. */

let currentLocationInspirationTab = getPref('locationInspirationTab', 'wishlist');
let currentLocationInspirationStatus = getPref('locationInspirationStatus', 'all');
let currentLocationInspirationSort = getPref('locationInspirationSort', 'priority');
let locationInspirationDataCache = null;
let locationInspirationLoadPromise = null;
let locationCollectionsDataCache = null;
let locationCollectionsLoadPromise = null;
let locationInspirationRenderGeneration = 0;

const LOCATION_INSPIRATION_TABS = [
  { id: 'wishlist', label: 'Lista marzen' },
  { id: 'collections', label: 'Kolekcje' },
];

const LOCATION_INSPIRATION_STATUS_OPTIONS = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'planning', label: 'W planie' },
  { key: 'want', label: 'Chce odwiedzic' },
  { key: 'paused', label: 'Odlozone' },
];

const LOCATION_INSPIRATION_SORTS = [
  { key: 'priority', label: 'Priorytet' },
  { key: 'country_name', label: 'Kraj i nazwa' },
  { key: 'name_asc', label: 'Nazwa A-Z' },
  { key: 'updated_desc', label: 'Ostatnio zmienione' },
];

const LOCATION_INSPIRATION_STATUS_TONES = {
  want: 'blue',
  planning: 'green',
  paused: 'orange',
};

const LOCATION_INSPIRATION_STATUS_ORDER = {
  planning: 1,
  want: 2,
  paused: 3,
};

async function getLocationInspirationsData() {
  if (locationInspirationDataCache) return locationInspirationDataCache;
  if (locationInspirationLoadPromise) return locationInspirationLoadPromise;
  const requestVersion = getFrontendDataCacheVersion();
  const pending = api('/api/location-inspirations').then(data => {
    if (requestVersion !== getFrontendDataCacheVersion()) {
      return getLocationInspirationsData();
    }
    if (data && !data.error) locationInspirationDataCache = data;
    return data;
  }).finally(() => {
    if (locationInspirationLoadPromise === pending) locationInspirationLoadPromise = null;
  });
  locationInspirationLoadPromise = pending;
  return pending;
}

async function getLocationCollectionsData() {
  if (locationCollectionsDataCache) return locationCollectionsDataCache;
  if (locationCollectionsLoadPromise) return locationCollectionsLoadPromise;
  const requestVersion = getFrontendDataCacheVersion();
  const pending = api('/api/location-collections').then(data => {
    if (requestVersion !== getFrontendDataCacheVersion()) {
      return getLocationCollectionsData();
    }
    if (data && !data.error) locationCollectionsDataCache = data;
    return data;
  }).finally(() => {
    if (locationCollectionsLoadPromise === pending) locationCollectionsLoadPromise = null;
  });
  locationCollectionsLoadPromise = pending;
  return pending;
}

registerDataCacheInvalidator(() => {
  locationInspirationDataCache = null;
  locationInspirationLoadPromise = null;
  locationCollectionsDataCache = null;
  locationCollectionsLoadPromise = null;
});

function openLocationInspirationsView() {
  navigateTo('locationWishlist', {
    tab: currentLocationInspirationTab,
    status: currentLocationInspirationStatus,
    sort: currentLocationInspirationSort,
  }, { force: true });
}

function locationInspirationRouteQuery() {
  const parts = [];
  if (currentLocationInspirationTab && currentLocationInspirationTab !== 'wishlist') {
    parts.push(`tab=${encodeURIComponent(currentLocationInspirationTab)}`);
  }
  if (currentLocationInspirationStatus && currentLocationInspirationStatus !== 'all') {
    parts.push(`status=${encodeURIComponent(currentLocationInspirationStatus)}`);
  }
  if (currentLocationInspirationSort && currentLocationInspirationSort !== 'priority') {
    parts.push(`sort=${encodeURIComponent(currentLocationInspirationSort)}`);
  }
  return parts.join('&');
}

function syncLocationInspirationRoute() {
  if (!canUseHashRouter() || !window.history || !window.history.replaceState) return;
  const query = locationInspirationRouteQuery();
  window.history.replaceState(null, '', '#/locations/wishlist' + (query ? '?' + query : ''));
}

function applyLocationInspirationRouteParams(params = {}) {
  if (params.tab) currentLocationInspirationTab = params.tab;
  if (params.status) currentLocationInspirationStatus = params.status;
  if (params.sort) currentLocationInspirationSort = params.sort;
  if (!LOCATION_INSPIRATION_TABS.some(tab => tab.id === currentLocationInspirationTab)) {
    currentLocationInspirationTab = 'wishlist';
  }
  if (!LOCATION_INSPIRATION_STATUS_OPTIONS.some(option => option.key === currentLocationInspirationStatus)) {
    currentLocationInspirationStatus = 'all';
  }
  if (!LOCATION_INSPIRATION_SORTS.some(option => option.key === currentLocationInspirationSort)) {
    currentLocationInspirationSort = 'priority';
  }
}

function setLocationInspirationTab(tab) {
  currentLocationInspirationTab = tab || 'wishlist';
  savePref('locationInspirationTab', currentLocationInspirationTab === 'wishlist' ? null : currentLocationInspirationTab);
  syncLocationInspirationRoute();
  renderLocationInspirations();
}

function setLocationInspirationStatus(status) {
  currentLocationInspirationStatus = status || 'all';
  savePref('locationInspirationStatus', currentLocationInspirationStatus === 'all' ? null : currentLocationInspirationStatus);
  syncLocationInspirationRoute();
  renderLocationInspirations();
}

function setLocationInspirationSort(sort) {
  currentLocationInspirationSort = sort || 'priority';
  savePref('locationInspirationSort', currentLocationInspirationSort === 'priority' ? null : currentLocationInspirationSort);
  syncLocationInspirationRoute();
  renderLocationInspirations();
}

function resetLocationInspirationControls() {
  currentLocationInspirationStatus = 'all';
  currentLocationInspirationSort = 'priority';
  savePref('locationInspirationStatus', null);
  savePref('locationInspirationSort', null);
  syncLocationInspirationRoute();
  renderLocationInspirations();
}

function locationInspirationStatusLabel(status, data) {
  return data?.labels?.[status]
    || LOCATION_INSPIRATION_STATUS_OPTIONS.find(option => option.key === status)?.label
    || status;
}

function locationInspirationPriorityLabel(priority, data) {
  return data?.priority_labels?.[String(priority)] || `${priority}`;
}

function locationInspirationSortRecord(item, index) {
  return {
    item,
    index,
    statusOrder: LOCATION_INSPIRATION_STATUS_ORDER[item.status] || 9,
    priority: Number(item.priority || 2),
    countryName: item.country_name || '',
    name: item.name || '',
    updatedAt: item.updated_at || '',
  };
}

function sortLocationInspirations(items) {
  const sorted = (items || []).map(locationInspirationSortRecord);
  if (currentLocationInspirationSort === 'country_name') {
    sorted.sort((a, b) =>
      compareLocationText(a.countryName, b.countryName)
      || compareLocationText(a.name, b.name)
      || (a.index - b.index)
    );
    return sorted.map(record => record.item);
  }
  if (currentLocationInspirationSort === 'name_asc') {
    sorted.sort((a, b) => compareLocationText(a.name, b.name) || (a.index - b.index));
    return sorted.map(record => record.item);
  }
  if (currentLocationInspirationSort === 'updated_desc') {
    sorted.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || (a.index - b.index));
    return sorted.map(record => record.item);
  }
  sorted.sort((a, b) =>
    (a.statusOrder - b.statusOrder)
    || (a.priority - b.priority)
    || compareLocationText(a.countryName, b.countryName)
    || compareLocationText(a.name, b.name)
    || (a.index - b.index)
  );
  return sorted.map(record => record.item);
}

function renderLocationInspirationControls({ totalItems, visibleItems }) {
  const activeStatus = LOCATION_INSPIRATION_STATUS_OPTIONS
    .find(option => option.key === currentLocationInspirationStatus);
  const activeSort = LOCATION_INSPIRATION_SORTS
    .find(option => option.key === currentLocationInspirationSort) || LOCATION_INSPIRATION_SORTS[0];
  const hasActiveControls = currentLocationInspirationStatus !== 'all'
    || currentLocationInspirationSort !== 'priority';
  const detail = [];
  if (activeStatus && activeStatus.key !== 'all') detail.push(activeStatus.label);
  if (activeSort.key !== 'priority') detail.push(activeSort.label);
  return renderFilterPanel({
    controls: [
      {
        label: 'Status',
        id: 'location-inspiration-status-select',
        onchange: 'setLocationInspirationStatus(this.value)',
        options: LOCATION_INSPIRATION_STATUS_OPTIONS,
        selectedValue: currentLocationInspirationStatus,
        valueKey: 'key',
      },
      {
        label: 'Sortowanie',
        id: 'location-inspiration-sort-select',
        onchange: 'setLocationInspirationSort(this.value)',
        options: LOCATION_INSPIRATION_SORTS,
        selectedValue: currentLocationInspirationSort,
        valueKey: 'key',
      },
    ],
    gridClass: 'aux-filter-grid',
    summary: {
      count: visibleItems,
      countLabel: worklistCountLabel(visibleItems),
      detail: detail.length ? detail : `${totalItems} miejsc na liscie marzen`,
      resetOnclick: hasActiveControls ? 'resetLocationInspirationControls()' : '',
    },
  });
}

function locationInspirationBadges(item, data) {
  const badges = [{
    label: locationInspirationStatusLabel(item.status, data),
    tone: LOCATION_INSPIRATION_STATUS_TONES[item.status] || 'blue',
  }, {
    label: `Priorytet: ${locationInspirationPriorityLabel(item.priority, data)}`,
    tone: Number(item.priority) === 1 ? 'orange' : 'purple',
  }];
  if (item.season) badges.push({ label: item.season, tone: 'blue' });
  if (Number(item.collection_count || 0) > 0) {
    badges.push({
      label: `${item.collection_count} ${polishPlural(item.collection_count, 'kolekcja', 'kolekcje', 'kolekcji')}`,
      tone: 'green',
    });
  }
  if (!locationHasGps(item)) badges.push({ label: 'bez GPS', tone: 'orange' });
  if (locationVisitCount(item) > 0) badges.push({ label: 'odwiedzone', tone: 'green' });
  return badges;
}

function locationInspirationActionsHtml(item) {
  const statusButtons = [
    ['planning', 'W planie'],
    ['want', 'Chce odwiedzic'],
    ['paused', 'Odloz'],
  ].filter(([status]) => status !== item.status);
  return `<div class="worklist-card-actions">
    ${statusButtons.map(([status, label]) => `<button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); updateLocationInspiration(${item.id}, '${jsStringArg(status)}')">${escapeHtml(label)}</button>`).join('')}
    <button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); openEditLocationInspirationModal(${item.id})">Edytuj</button>
    <button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); openAddInspirationToCollectionModal(${item.id})">Kolekcja</button>
    <button type="button" class="worklist-action-btn" onclick="event.stopPropagation(); removeLocationInspiration(${item.id})">Usun</button>
  </div>`;
}

function locationInspirationCardHtml(item, data) {
  const subtitleParts = [
    item.location_type || '',
    item.country_name || '',
    locVisitSummary(item),
  ].filter(Boolean).join(' · ');
  return renderEntityCard({
    className: 'card inspiration-card',
    onclick: `openLocation(${item.id})`,
    iconHtml: locationIcon(item.location_type),
    iconClass: 'card-icon inspiration-icon',
    title: item.name || '(bez nazwy)',
    subtitles: [
      subtitleParts,
      item.parent_name ? `W: ${item.parent_name}` : '',
      item.inspiration_notes ? { text: item.inspiration_notes, className: 'card-subtitle inspiration-note' } : '',
      item.collection_names ? { text: `Kolekcje: ${item.collection_names}`, className: 'card-subtitle' } : '',
    ],
    metaHtml: `<div class="card-meta">${renderBadges(locationInspirationBadges(item, data))}</div>${locationInspirationActionsHtml(item)}`,
    trailingHtml: '<div class="card-chevron">›</div>',
  });
}

function renderLocationInspirationList(items, data) {
  if (!items.length) {
    return emptyState({
      icon: '☆',
      title: currentLocationInspirationStatus === 'all' ? 'Lista marzen jest pusta' : 'Brak miejsc w tym statusie',
      message: currentLocationInspirationStatus === 'all'
        ? 'Dodaj miejsce, ktore chcesz kiedys odwiedzic, albo przypnij istniejace miejsce z bazy.'
        : 'Zmien filtr albo dodaj nowe miejsce do tego statusu.',
      ctaLabel: '+ Dodaj marzenie',
      ctaOnclick: 'openNewInspirationModal()',
    });
  }
  return renderCardList(items, item => locationInspirationCardHtml(item, data), {
    className: 'card-list worklist-list inspiration-list',
  });
}

function collectionCardHtml(collection) {
  const itemCount = Number(collection.item_count || 0);
  const visited = Number(collection.visited_count || 0);
  const planned = Math.max(0, itemCount - visited);
  const subtitle = [
    `${itemCount} ${polishPlural(itemCount, 'miejsce', 'miejsca', 'miejsc')}`,
    `${visited} odwiedzonych`,
    `${planned} w planach`,
  ].join(' · ');
  return renderEntityCard({
    className: 'card collection-card',
    onclick: `openLocationCollectionModal(${collection.id})`,
    iconHtml: '#',
    iconClass: 'card-icon collection-icon',
    title: collection.name,
    subtitles: [
      subtitle,
      collection.description ? { text: collection.description, className: 'card-subtitle inspiration-note' } : '',
    ],
    trailingHtml: '<div class="card-chevron">›</div>',
  });
}

function renderLocationCollectionsPanel(collections) {
  if (!collections.length) {
    return emptyState({
      icon: '#',
      title: 'Nie ma jeszcze kolekcji',
      message: 'Utworz pierwsza kolekcje, np. UNESCO, wyspy, stolice albo najlepsze widoki.',
      ctaLabel: '+ Nowa kolekcja',
      ctaOnclick: 'openNewLocationCollectionModal()',
    });
  }
  return renderCardList(collections, collectionCardHtml, {
    className: 'card-list worklist-list collection-list',
  });
}

async function renderLocationInspirations(params = {}) {
  const renderGeneration = ++locationInspirationRenderGeneration;
  applyLocationInspirationRouteParams(params);
  const view = document.getElementById('view');
  if (!locationInspirationDataCache || !locationCollectionsDataCache) {
    view.innerHTML = `<div class="page-header"><div class="page-title">Inspiracje</div></div>` + skeletonCards(3);
  }
  const [inspirations, collectionsPayload] = await Promise.all([
    getLocationInspirationsData(),
    getLocationCollectionsData(),
  ]);
  if (
    renderGeneration !== locationInspirationRenderGeneration
    || document.getElementById('view') !== view
    || currentTab !== 'locationWishlist'
  ) return;
  if (inspirations.error || collectionsPayload.error) {
    const err = inspirations.error || collectionsPayload.error;
    view.innerHTML = emptyState({ icon: '☆', title: 'Nie udalo sie wczytac inspiracji', message: err });
    return;
  }

  const itemsAll = inspirations.items || [];
  const collections = collectionsPayload.collections || [];
  const filtered = itemsAll.filter(item =>
    currentLocationInspirationStatus === 'all' || item.status === currentLocationInspirationStatus
  );
  const items = sortLocationInspirations(filtered);
  const planningCount = Number(inspirations.counts?.planning || 0);
  const wantCount = Number(inspirations.counts?.want || 0);
  const pausedCount = Number(inspirations.counts?.paused || 0);
  const collectionItemCount = collections.reduce((sum, collection) => sum + Number(collection.item_count || 0), 0);

  let html = `<div class="page-header">
    <div>
      <button class="back-btn" onclick="showTab('locations')">‹ Miejsca</button>
      <div class="page-title">Inspiracje</div>
    </div>
  </div>`;
  html += renderTabs(LOCATION_INSPIRATION_TABS, currentLocationInspirationTab, {
    containerClass: 'stats-section-tabs inspiration-tabs',
    buttonClass: 'stats-section-tab',
    ariaLabel: 'Inspiracje',
    onClick: item => `setLocationInspirationTab('${item.id}')`,
  });
  html += `<div class="hero-card">
    <div class="hero-label">Planowanie miejsc</div>
    ${renderHeroMetrics([
      { value: itemsAll.length, label: 'na liscie' },
      { value: planningCount, label: 'w planie' },
      { value: wantCount, label: 'chce odwiedzic' },
      { value: collections.length, label: 'kolekcje' },
    ])}
  </div>`;

  if (currentLocationInspirationTab === 'collections') {
    html += `<div class="action-strip inspiration-actions">
      <button class="action-button" type="button" onclick="openNewLocationCollectionModal()"><span class="action-button-icon">+</span><span>Nowa kolekcja</span></button>
      <button class="action-button" type="button" onclick="setLocationInspirationTab('wishlist')"><span class="action-button-icon">☆</span><span>Lista marzen</span></button>
    </div>`;
    html += `<div class="hero-card inspiration-mini-hero">
      <div class="hero-label">Kolekcje</div>
      ${renderHeroMetrics([
        { value: collections.length, label: 'kolekcje' },
        { value: collectionItemCount, label: 'przypietych miejsc' },
        { value: pausedCount, label: 'odlozone' },
      ])}
    </div>`;
    html += renderLocationCollectionsPanel(collections);
    html += `<button class="fab" onclick="openNewLocationCollectionModal()">+</button>`;
    view.innerHTML = html;
    applyRestoreScroll();
    return;
  }

  html += renderLocationInspirationControls({
    totalItems: itemsAll.length,
    visibleItems: items.length,
  });
  html += `<div class="action-strip inspiration-actions">
    <button class="action-button" type="button" onclick="openNewInspirationModal()"><span class="action-button-icon">+</span><span>Nowe miejsce</span></button>
    <button class="action-button" type="button" onclick="openExistingInspirationPicker()"><span class="action-button-icon">☆</span><span>Istniejace</span></button>
    <button class="action-button" type="button" onclick="setLocationInspirationTab('collections')"><span class="action-button-icon">#</span><span>Kolekcje</span></button>
  </div>`;
  html += renderLocationInspirationList(items, inspirations);
  html += `<button class="fab" onclick="openNewInspirationModal()">+</button>`;
  view.innerHTML = html;
  applyRestoreScroll();
}

function inspirationMetaFieldsHtml(prefix, item = {}) {
  const status = item.status || 'want';
  const priority = String(item.priority || 2);
  return `
    <div class="form-row">
      <div><div class="form-label">Status</div>
        <select class="form-input" id="${prefix}-inspiration-status">
          ${renderSelectOptions(LOCATION_INSPIRATION_STATUS_OPTIONS.filter(option => option.key !== 'all'), status, { valueKey: 'key' })}
        </select>
      </div>
      <div><div class="form-label">Priorytet</div>
        <select class="form-input" id="${prefix}-inspiration-priority">
          ${renderSelectOptions([
            { value: '1', label: 'Wysoki' },
            { value: '2', label: 'Sredni' },
            { value: '3', label: 'Niski' },
          ], priority)}
        </select>
      </div>
    </div>
    <div class="form-label">Sezon / moment (opcjonalnie)</div>
    <input class="form-input" id="${prefix}-inspiration-season" placeholder="np. wiosna, grudzien, za 2 lata" value="${escapeAttr(item.season || '')}">
    <div class="form-label">Notatka planu (opcjonalnie)</div>
    <textarea class="form-input form-textarea" id="${prefix}-inspiration-notes" placeholder="Dlaczego to miejsce?">${escapeHtml(item.inspiration_notes || item.notes || '')}</textarea>
  `;
}

function readInspirationPayload(prefix) {
  const priority = parseInt(document.getElementById(`${prefix}-inspiration-priority`)?.value || '2', 10);
  return {
    status: document.getElementById(`${prefix}-inspiration-status`)?.value || 'want',
    priority: Number.isFinite(priority) ? priority : 2,
    season: document.getElementById(`${prefix}-inspiration-season`)?.value.trim() || null,
    notes: document.getElementById(`${prefix}-inspiration-notes`)?.value.trim() || null,
  };
}

async function openNewInspirationModal() {
  if (!beginOverlayOpen('new-inspiration-overlay')) return;
  try {
    const [countries, locTypes, allLocs] = await Promise.all([
      api('/api/countries'),
      api('/api/location_types'),
      getAllLocations(),
    ]);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'new-inspiration-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">Nowe marzenie</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('new-inspiration-overlay'))">Anuluj</button></div>
      <div class="form-section">
        ${locationFormHtml({
          prefix: 'in',
          countries,
          locTypes,
          parentChangeHandler: "updateParentLocListFor('new-inspiration-overlay','in')",
          extraFieldsHtml: inspirationMetaFieldsHtml('in'),
          saveBtnId: 'in-save-btn',
          saveBtnOnclick: 'saveNewInspiration()',
          saveBtnLabel: 'Zapisz na liscie marzen',
        })}
      </div></div>`;
    overlay._allLocs = allLocs;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('new-inspiration-overlay');
  }
}

async function saveNewInspiration() {
  const btn = document.getElementById('in-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;
  try {
    const name = document.getElementById('in-name').value.trim();
    const countryId = document.getElementById('in-country').value;
    const typeId = document.getElementById('in-type').value;
    const parentId = document.getElementById('in-parent').value;
    const address = document.getElementById('in-address').value.trim();
    const notes = document.getElementById('in-notes').value.trim();
    const cSel = document.getElementById('in-country');
    const countryName = cSel.options[cSel.selectedIndex]?.text || '';
    if (!name) { toast('Podaj nazwe miejsca', 'error'); return; }
    if (!countryId) { toast('Wybierz kraj', 'error'); return; }
    if (!typeId) { toast('Wybierz typ miejsca', 'error'); return; }

    const overlay = document.getElementById('new-inspiration-overlay');
    const allLocs = overlay?._allLocs || allLocationsCache || [];
    const latVal = parseCoord(document.getElementById('in-lat').value);
    const lngVal = parseCoord(document.getElementById('in-lng').value);
    const dup = findDuplicateLocation(allLocs, name, countryName, parentId);
    let force = false;
    if (dup) {
      if (!await confirmDuplicateLocation(dup, countryName)) return;
      force = true;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Zapisuje...'; }
    const body = {
      name,
      country_id: parseInt(countryId),
      location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null,
      notes: notes || null,
      latitude: latVal,
      longitude: lngVal,
    };
    if (force) body.force_duplicate = true;
    let res = await apiPost('/api/locations', body);
    if (res.error && res.duplicate && res.existing) {
      if (!await confirmDuplicateLocation(res.existing, countryName)) return;
      res = await apiPost('/api/locations', { ...body, force_duplicate: true });
    }
    if (res.error) { toastApiError(res, 'Nie udalo sie zapisac miejsca'); return; }
    const inspirationRes = await apiPost(`/api/location-inspirations/${res.id}`, readInspirationPayload('in'));
    if (inspirationRes.error) { toastApiError(inspirationRes, 'Miejsce zapisane, ale nie udalo sie dodac go do marzen'); return; }
    closeModal(overlay);
    toast('Dodano do inspiracji', 'success');
    currentLocationInspirationTab = 'wishlist';
    renderLocationInspirations();
  } catch (err) {
    toast('Nieoczekiwany blad: ' + err.message, 'error');
  } finally {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

function buildExistingInspirationPicker(locs, inspiredIds, query = '') {
  const normalized = String(query || '').trim().toLocaleLowerCase('pl');
  const filtered = (locs || [])
    .filter(loc => !inspiredIds.has(Number(loc.id)))
    .filter(loc => !normalized
      || String(loc.name || '').toLocaleLowerCase('pl').includes(normalized)
      || String(loc.country_name || '').toLocaleLowerCase('pl').includes(normalized))
    .sort(compareLocCountryName);
  if (!filtered.length) return '<div class="modal-list-empty">Brak miejsc do dodania</div>';
  const grouped = {};
  filtered.slice(0, 120).forEach(loc => {
    const country = loc.country_name || 'Bez kraju';
    if (!grouped[country]) grouped[country] = [];
    grouped[country].push(loc);
  });
  return Object.entries(grouped).map(([country, items]) => `
    <div class="picker-group-label">${escapeHtml(country)}</div>
    ${items.map(loc => renderPickerRow({
      onclick: `addExistingLocationInspiration(${loc.id})`,
      iconHtml: locationIcon(loc.location_type),
      iconClass: 'picker-row-icon',
      title: loc.name,
      subtitle: `${loc.location_type || ''}${loc.parent_name ? ' · ' + loc.parent_name : ''} · ${locVisitSummary(loc)}`,
    })).join('')}`).join('');
}

async function openExistingInspirationPicker() {
  if (!beginOverlayOpen('existing-inspiration-overlay')) return;
  try {
    const [locs, inspirations] = await Promise.all([getAllLocations(), getLocationInspirationsData()]);
    const inspiredIds = new Set((inspirations.items || []).map(item => Number(item.id)));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'existing-inspiration-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">Dodaj istniejace miejsce</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('existing-inspiration-overlay'))">Anuluj</button></div>
      <div class="form-section">
        <div class="search-box modal-search"><input type="search" placeholder="Szukaj miejsca lub kraju..." oninput="filterExistingInspirationPicker(this.value)"></div>
        <div id="existing-inspiration-list" class="modal-scroll-list">${buildExistingInspirationPicker(locs, inspiredIds)}</div>
      </div></div>`;
    overlay._allLocs = locs;
    overlay._inspiredIds = inspiredIds;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('existing-inspiration-overlay');
  }
}

function filterExistingInspirationPicker(query) {
  const overlay = document.getElementById('existing-inspiration-overlay');
  if (!overlay) return;
  const list = document.getElementById('existing-inspiration-list');
  if (list) list.innerHTML = buildExistingInspirationPicker(overlay._allLocs || [], overlay._inspiredIds || new Set(), query);
}

async function addExistingLocationInspiration(locationId) {
  return withActionLock(`location-inspiration-add-${locationId}`, async () => {
    const res = await apiPost(`/api/location-inspirations/${locationId}`, {
      status: 'want',
      priority: 2,
      season: null,
      notes: null,
    });
    if (res.error) { toastApiError(res, 'Nie udalo sie dodac miejsca do inspiracji'); return; }
    closeModal(document.getElementById('existing-inspiration-overlay'));
    toast('Dodano do listy marzen', 'success');
    refreshLocationInspirationSurface(locationId);
  });
}

async function updateLocationInspiration(locationId, status) {
  const item = getLocationInspirationItem(locationId);
  const payload = {
    status,
    priority: Number(item?.priority || 2),
    season: item?.season || null,
    notes: item?.inspiration_notes || null,
  };
  const res = await apiPost(`/api/location-inspirations/${locationId}`, payload);
  if (res.error) { toastApiError(res, 'Nie udalo sie zmienic statusu'); return; }
  toast('Zmieniono status', 'success');
  refreshLocationInspirationSurface(locationId);
}

function openEditLocationInspirationModal(locationId) {
  const item = getLocationInspirationItem(locationId);
  if (!item) { toast('Nie znaleziono inspiracji', 'error'); return; }
  document.getElementById('edit-inspiration-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'edit-inspiration-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${escapeHtml(item.name || 'Inspiracja')}</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('edit-inspiration-overlay'))">Anuluj</button></div>
    <div class="form-section">
      ${inspirationMetaFieldsHtml('ei', item)}
      <button class="form-primary-btn" id="ei-save-btn" onclick="saveLocationInspirationMeta(${item.id})">Zapisz inspiracje</button>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function saveLocationInspirationMeta(locationId) {
  const btn = document.getElementById('ei-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Zapisuje...'; }
  const res = await apiPost(`/api/location-inspirations/${locationId}`, readInspirationPayload('ei'));
  if (res.error) {
    toastApiError(res, 'Nie udalo sie zapisac inspiracji');
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    return;
  }
  closeModal(document.getElementById('edit-inspiration-overlay'));
  toast('Zapisano inspiracje', 'success');
  refreshLocationInspirationSurface(locationId);
}

async function removeLocationInspiration(locationId) {
  const ok = await askConfirm({
    title: 'Usunac z listy marzen?',
    message: 'Miejsce zostanie w bazie, zniknie tylko z Inspiracji.',
    confirmText: 'Usun z listy',
    danger: true,
  });
  if (!ok) return;
  const res = await apiDelete(`/api/location-inspirations/${locationId}`);
  if (res.error) { toastApiError(res, 'Nie udalo sie usunac inspiracji'); return; }
  toast('Usunieto z inspiracji', 'success');
  refreshLocationInspirationSurface(locationId);
}

function openNewLocationCollectionModal() {
  document.getElementById('new-collection-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'new-collection-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Nowa kolekcja</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('new-collection-overlay'))">Anuluj</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa</div>
      <input class="form-input" id="nc-name" placeholder="np. UNESCO, wyspy, stolice">
      <div class="form-label">Opis (opcjonalnie)</div>
      <textarea class="form-input form-textarea" id="nc-description" placeholder="Co laczy te miejsca?"></textarea>
      <button class="form-primary-btn" id="nc-save-btn" onclick="saveNewLocationCollection()">Utworz kolekcje</button>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function saveNewLocationCollection() {
  const btn = document.getElementById('nc-save-btn');
  if (btn?.disabled) return;
  const name = document.getElementById('nc-name').value.trim();
  const description = document.getElementById('nc-description').value.trim() || null;
  if (!name) { toast('Podaj nazwe kolekcji', 'error'); return; }
  const origLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Zapisuje...'; }
  const res = await apiPost('/api/location-collections', { name, description });
  if (res.error) {
    toastApiError(res, 'Nie udalo sie utworzyc kolekcji');
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    return;
  }
  closeModal(document.getElementById('new-collection-overlay'));
  toast('Utworzono kolekcje', 'success');
  currentLocationInspirationTab = 'collections';
  renderLocationInspirations();
}

async function openLocationCollectionModal(collectionId) {
  if (!beginOverlayOpen('collection-detail-overlay')) return;
  try {
    const data = await api(`/api/location-collections/${collectionId}`);
    if (data.error) { toastApiError(data, 'Nie udalo sie wczytac kolekcji'); return; }
    const items = data.items || [];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'collection-detail-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">${escapeHtml(data.name || 'Kolekcja')}</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('collection-detail-overlay'))">Gotowe</button></div>
      <div class="form-section">
        ${data.description ? `<div class="collection-description">${escapeHtml(data.description)}</div>` : ''}
        <div class="collection-actions">
          <button class="form-secondary-btn" onclick="openCollectionLocationPicker(${data.id})">Dodaj miejsce</button>
          <button class="form-tertiary-btn danger-text" onclick="deleteLocationCollection(${data.id})">Usun kolekcje</button>
        </div>
        <div id="collection-items" class="modal-scroll-list">
          ${items.length ? items.map(item => collectionItemRowHtml(data.id, item)).join('') : '<div class="modal-list-empty">Ta kolekcja jest pusta</div>'}
        </div>
      </div></div>`;
    overlay._collection = data;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('collection-detail-overlay');
  }
}

function collectionItemRowHtml(collectionId, item) {
  return `<div class="trash-row collection-item-row">
    <div class="loc-icon">${locationIcon(item.location_type)}</div>
    <div class="trash-row-main">
      <div class="loc-name">${escapeHtml(item.name || '(bez nazwy)')}</div>
      <div class="loc-sub">${escapeHtml(item.location_type || '')} · ${escapeHtml(item.country_name || '')} · ${locVisitSummary(item)}</div>
      ${item.note ? `<div class="loc-sub">${escapeHtml(item.note)}</div>` : ''}
    </div>
    <div class="trash-actions">
      <button class="trash-action restore" onclick="closeModal(document.getElementById('collection-detail-overlay')); openLocation(${item.id})">Miejsce</button>
      <button class="trash-action danger" onclick="removeLocationFromCollection(${collectionId}, ${item.id})">Usun</button>
    </div>
  </div>`;
}

async function openCollectionLocationPicker(collectionId) {
  const detailOverlay = document.getElementById('collection-detail-overlay');
  const selected = new Set((detailOverlay?._collection?.items || []).map(item => Number(item.id)));
  const locs = await getAllLocations();
  document.getElementById('collection-picker-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'collection-picker-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Dodaj do kolekcji</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('collection-picker-overlay'))">Anuluj</button></div>
    <div class="form-section">
      <div class="search-box modal-search"><input type="search" placeholder="Szukaj miejsca lub kraju..." oninput="filterCollectionLocationPicker(this.value)"></div>
      <div id="collection-picker-list" class="modal-scroll-list">${buildCollectionLocationPicker(locs, selected, collectionId)}</div>
    </div></div>`;
  overlay._allLocs = locs;
  overlay._selectedIds = selected;
  overlay._collectionId = collectionId;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

function buildCollectionLocationPicker(locs, selectedIds, collectionId, query = '') {
  const normalized = String(query || '').trim().toLocaleLowerCase('pl');
  const filtered = (locs || [])
    .filter(loc => !selectedIds.has(Number(loc.id)))
    .filter(loc => !normalized
      || String(loc.name || '').toLocaleLowerCase('pl').includes(normalized)
      || String(loc.country_name || '').toLocaleLowerCase('pl').includes(normalized))
    .sort(compareLocCountryName)
    .slice(0, 120);
  if (!filtered.length) return '<div class="modal-list-empty">Brak miejsc do dodania</div>';
  return filtered.map(loc => renderPickerRow({
    onclick: `addLocationToCollection(${collectionId}, ${loc.id})`,
    iconHtml: locationIcon(loc.location_type),
    iconClass: 'picker-row-icon',
    title: loc.name,
    subtitle: `${loc.location_type || ''} · ${loc.country_name || ''}`,
  })).join('');
}

function filterCollectionLocationPicker(query) {
  const overlay = document.getElementById('collection-picker-overlay');
  if (!overlay) return;
  const list = document.getElementById('collection-picker-list');
  if (list) {
    list.innerHTML = buildCollectionLocationPicker(
      overlay._allLocs || [],
      overlay._selectedIds || new Set(),
      overlay._collectionId,
      query,
    );
  }
}

async function addLocationToCollection(collectionId, locationId) {
  const res = await apiPost(`/api/location-collections/${collectionId}/locations`, {
    location_id: locationId,
    note: null,
  });
  if (res.error) { toastApiError(res, 'Nie udalo sie dodac miejsca do kolekcji'); return; }
  closeModal(document.getElementById('collection-picker-overlay'));
  closeModal(document.getElementById('collection-detail-overlay'));
  toast('Dodano do kolekcji', 'success');
  setTimeout(() => openLocationCollectionModal(collectionId), 260);
  refreshLocationInspirationSurface(locationId);
}

async function removeLocationFromCollection(collectionId, locationId) {
  const res = await apiDelete(`/api/location-collections/${collectionId}/locations/${locationId}`);
  if (res.error) { toastApiError(res, 'Nie udalo sie usunac miejsca z kolekcji'); return; }
  closeModal(document.getElementById('collection-detail-overlay'));
  toast('Usunieto z kolekcji', 'success');
  setTimeout(() => openLocationCollectionModal(collectionId), 260);
  refreshLocationInspirationSurface(locationId);
}

async function deleteLocationCollection(collectionId) {
  const detailLocationId = currentTab === 'locationDetail' ? window._currentLocationDetail?.id : null;
  const ok = await askConfirm({
    title: 'Usunac kolekcje?',
    message: 'Miejsca zostana w bazie, zniknie tylko ta kolekcja.',
    confirmText: 'Usun kolekcje',
    danger: true,
  });
  if (!ok) return;
  const res = await apiDelete(`/api/location-collections/${collectionId}`);
  if (res.error) { toastApiError(res, 'Nie udalo sie usunac kolekcji'); return; }
  closeModal(document.getElementById('collection-detail-overlay'));
  toast('Usunieto kolekcje', 'success');
  if (detailLocationId) refreshLocationInspirationSurface(detailLocationId);
  else renderLocationInspirations();
}

async function openAddInspirationToCollectionModal(locationId) {
  const collectionsPayload = await getLocationCollectionsData();
  if (collectionsPayload.error) { toastApiError(collectionsPayload, 'Nie udalo sie wczytac kolekcji'); return; }
  const collections = collectionsPayload.collections || [];
  if (!collections.length) {
    toast('Najpierw utworz kolekcje', 'info');
    currentLocationInspirationTab = 'collections';
    openLocationInspirationsView();
    return;
  }
  document.getElementById('inspiration-collection-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'inspiration-collection-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Dodaj do kolekcji</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('inspiration-collection-overlay'))">Anuluj</button></div>
    <div class="form-section">
      <div class="modal-scroll-list">
        ${collections.map(collection => renderPickerRow({
          onclick: `addLocationToCollectionFromInspiration(${collection.id}, ${locationId})`,
          iconHtml: '#',
          iconClass: 'picker-row-icon',
          title: collection.name,
          subtitle: `${collection.item_count || 0} miejsc`,
        })).join('')}
      </div>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function addLocationToCollectionFromInspiration(collectionId, locationId) {
  const res = await apiPost(`/api/location-collections/${collectionId}/locations`, {
    location_id: locationId,
    note: null,
  });
  if (res.error) { toastApiError(res, 'Nie udalo sie dodac do kolekcji'); return; }
  closeModal(document.getElementById('inspiration-collection-overlay'));
  toast('Dodano do kolekcji', 'success');
  refreshLocationInspirationSurface(locationId);
}
