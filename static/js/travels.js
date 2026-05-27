const TRAVEL_SORTS = [
  { key: 'date_desc', label: 'Najnowsze' },
  { key: 'date_asc', label: 'Najstarsze' },
  { key: 'cost_desc', label: 'Najdroższe' },
  { key: 'cost_asc', label: 'Najtańsze' },
  { key: 'rating_desc', label: 'Najwyżej oceniane' },
  { key: 'rating_asc', label: 'Najniżej oceniane' },
  { key: 'name_asc', label: 'Nazwa A-Z' },
  { key: 'todo', label: 'Do uzupełnienia' },
];

async function renderTravels(q) {
  if (q !== undefined) currentSearch = q;
  const view = document.getElementById('view');
  if (!document.getElementById('travel-list')) {
    view.innerHTML =
      '<div class="page-header"><div class="page-title">Moje Podróże</div>' +
      '<div class="search-box"><input type="search" placeholder="Szukaj podróży..." id="travel-search" value="' + escapeHtml(currentSearch || '') + '" oninput="onTravelSearch(this.value)"></div></div>' +
      '<div class="travel-filter-panel" id="travel-controls"></div>' +
      '<div id="travel-list">' + skeletonCards(4) + '</div>' +
      '<button class="fab" onclick="openWizard()">＋</button>';
  }
  const searchInput = document.getElementById('travel-search');
  if (searchInput && searchInput.value !== (currentSearch || '')) {
    searchInput.value = currentSearch || '';
  }
  const list = document.getElementById('travel-list');
  list.innerHTML = skeletonCards(4);
  let travels = await api('/api/travels' + (currentSearch ? '?q='+encodeURIComponent(currentSearch) : ''));
  const years = [...new Set(travels.map(t => t.start_date && String(t.start_date).slice(0,4)).filter(Boolean))]
    .sort((a,b) => b.localeCompare(a));
  if (currentTravelYear && !years.includes(String(currentTravelYear))) currentTravelYear = null;
  if (currentTravelYear) {
    travels = travels.filter(t => t.start_date && String(t.start_date).startsWith(String(currentTravelYear)));
  }
  travels = sortTravels(travels, currentSort);
  renderTravelControls(years, travels.length);
  if (!travels.length) {
    list.innerHTML = hasActiveTravelFilters()
      ? emptyState({ icon: '🔍', title: 'Brak wyników', message: currentSearch
          ? `Żadna podróż nie pasuje do "${currentSearch}".`
          : `Brak podróży dla wybranych filtrów.`, ctaLabel: 'Wyczyść filtry', ctaOnclick: 'resetTravelFilters()' })
      : emptyState({ icon: '✈️', title: 'Brak podróży', message: 'Dodaj pierwszą podróż, żeby zacząć kolekcjonować wspomnienia.', ctaLabel: '＋ Nowa podróż', ctaOnclick: 'openWizard()' });
    return;
  }
  list.innerHTML = renderCardList(travels, travelCardHtml);
}

function travelCardHtml(t) {
  const done = t.is_description_complete;
  const badges = renderBadges([
    t.purpose && { label: t.purpose, tone: purposeColor(t.purpose) },
    t.rating && { html: stars(t.rating), tone: 'orange' },
    t.has_photo_album && { label: '📷 Album', tone: 'green' },
    t.amount > 0 && { label: `${parseFloat(t.amount).toLocaleString('pl-PL')} ${t.currency}`, tone: 'purple' },
  ]);
  return renderEntityCard({
    className: `card${done ? ' completed' : ''}`,
    onclick: `openTravel(${t.id})`,
    iconHtml: purposeIcon(t.purpose),
    iconStyle: `background:${purposeIconBg(t.purpose)}`,
    titleHtml: `${escapeHtml(t.name || '(bez nazwy)')}${done ? ' ✓' : ''}`,
    subtitles: [`${fmtDate(t.start_date)} – ${fmtDate(t.end_date)} · ${daysCount(t.start_date, t.end_date)} dni`],
    metaHtml: badges ? `<div class="card-meta">${badges}</div>` : '',
  });
}

function travelSortLabel(sort) {
  return (TRAVEL_SORTS.find(s => s.key === sort) || TRAVEL_SORTS[0]).label;
}

function travelResultLabel(count) {
  count = Number(count || 0);
  if (count === 1) return 'podróż';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'podróże';
  return 'podróży';
}

function hasActiveTravelFilters() {
  return Boolean((currentSearch || '').trim()) || Boolean(currentTravelYear) || currentSort !== 'date_desc';
}

function travelFilterLabels() {
  const labels = [];
  if ((currentSearch || '').trim()) labels.push(`Szukaj: ${currentSearch.trim()}`);
  if (currentTravelYear) labels.push(String(currentTravelYear));
  if (currentSort !== 'date_desc') labels.push(travelSortLabel(currentSort));
  return labels;
}

function renderTravelControls(years, resultCount) {
  const controls = document.getElementById('travel-controls');
  if (!controls) return;
  const labels = travelFilterLabels();
  controls.innerHTML = renderFilterInner({
    innerClass: 'travel-filter-inner',
    gridClass: 'travel-filter-grid',
    controls: [
      {
        label: 'Rok',
        id: 'travel-year-select',
        onchange: 'setTravelYear(this.value ? parseInt(this.value, 10) : null)',
        controlClass: 'travel-control',
        options: years,
        selectedValue: currentTravelYear,
        optionsHtml: renderSelectOptions(years, currentTravelYear, { emptyOption: 'Wszystkie lata' }),
      },
      {
        label: 'Sortowanie',
        id: 'travel-sort-select',
        onchange: 'setSort(this.value)',
        controlClass: 'travel-control',
        options: TRAVEL_SORTS,
        selectedValue: currentSort,
        valueKey: 'key',
      },
    ],
    summary: labels.length ? {
      count: resultCount,
      countLabel: travelResultLabel(resultCount),
      detail: labels,
      resetOnclick: 'resetTravelFilters()',
      resetLabel: 'Wyczyść',
      summaryClass: 'travel-filter-summary',
      textClass: 'travel-filter-summary-text',
    } : null,
  });
}

function sortTravels(travels, sort) {
  const arr = [...travels];
  if (sort === 'date_desc') return arr.sort((a,b) => b.start_date.localeCompare(a.start_date));
  if (sort === 'date_asc')  return arr.sort((a,b) => a.start_date.localeCompare(b.start_date));
  if (sort === 'cost_desc') return arr.sort((a,b) => parseFloat(b.amount||0) - parseFloat(a.amount||0));
  if (sort === 'cost_asc')  return arr.sort((a,b) => parseFloat(a.amount||0) - parseFloat(b.amount||0));
  if (sort === 'rating_desc') return arr.sort((a,b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
  if (sort === 'rating_asc')  return arr.sort((a,b) => (parseFloat(a.rating) || Infinity) - (parseFloat(b.rating) || Infinity));
  if (sort === 'name_asc')  return arr.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'pl'));
  if (sort === 'todo')      return arr.sort((a,b) => (a.is_description_complete?1:0) - (b.is_description_complete?1:0));
  return arr;
}

function setSort(sort) { currentSort = sort; renderTravels(); }
function setTravelYear(y) { currentTravelYear = y; renderTravels(); }
function onTravelSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => renderTravels(val), 400); }
function resetTravelFilters() {
  currentSearch = '';
  currentTravelYear = null;
  currentSort = 'date_desc';
  clearTimeout(searchTimeout);
  const searchInput = document.getElementById('travel-search');
  if (searchInput) searchInput.value = '';
  renderTravels('');
}

function travelPlural(count, one, few, many) {
  count = Number(count || 0);
  if (count === 1) return one;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return few;
  return many;
}

function travelUniqueValues(items, key) {
  return [...new Set((items || []).map(item => item && item[key]).filter(Boolean))];
}

function travelCostLabel(t) {
  const amount = parseFloat(t.amount || 0);
  if (!amount) return '–';
  return `${amount.toLocaleString('pl-PL')} ${escapeHtml(t.currency || '')}`.trim();
}

function travelVisitDateLabel(arrival, departure) {
  if (!arrival && !departure) return 'Brak daty wizyty';
  if (!arrival) return fmtDate(departure);
  if (!departure || arrival === departure) return fmtDate(arrival);
  return `${fmtDate(arrival)} – ${fmtDate(departure)}`;
}

function travelDayLabel(date, travelStart) {
  if (!date || !travelStart) return '';
  const dayNo = daysCount(travelStart, date);
  return dayNo > 0 ? `Dzień ${dayNo}` : '';
}

function travelCountriesLabel(locations, limit = 3) {
  const countries = travelUniqueValues(locations, 'country_name');
  if (!countries.length) return '–';
  if (countries.length <= limit) return countries.join(', ');
  return `${countries.slice(0, limit).join(', ')} +${countries.length - limit}`;
}

function renderTravelDetail(t) {
  const locations = t.locations || [];
  const participants = t.participants || [];
  const countryCount = travelUniqueValues(locations, 'country_name').length;
  return `
    <div class="detail-header-gradient travel-detail-hero" style="background:${purposeGradient(t.purpose)}">
      <div class="travel-detail-hero-inner">
        <button class="back-btn" onclick="showTab('travels')">‹ Podróże</button>
        <div class="travel-hero-top">
          <div class="travel-hero-kicker">
            <span>${purposeIcon(t.purpose)} ${escapeHtml(t.purpose || 'Podróż')}</span>
            ${t.is_description_complete ? '<span class="travel-status-chip done">Opis kompletny</span>' : '<span class="travel-status-chip todo">Do uzupełnienia</span>'}
          </div>
          <button class="travel-hero-edit" onclick="openEditTravel()" title="Edytuj podróż">✎ Edytuj</button>
        </div>
        <div class="detail-title">${escapeHtml(t.name || '(bez nazwy)')}</div>
        <div class="detail-sub">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</div>
        ${renderMetricGrid([
          { label: 'Dni', value: daysCount(t.start_date, t.end_date) },
          { label: 'Miejsca', value: locations.length },
          { label: 'Kraje', value: countryCount || '–', sub: travelCountriesLabel(locations, 2) },
          { label: 'Uczestnicy', value: participants.length || '–' },
        ], {
          className: 'travel-hero-stats',
          itemClass: 'travel-hero-stat',
          valueClass: 'travel-hero-stat-value',
          labelClass: 'travel-hero-stat-label',
          subClass: 'travel-hero-stat-sub',
        })}
      </div>
    </div>
    <div class="detail-body travel-detail-body">
      ${renderTravelSummarySection(t)}
      ${renderTravelParticipantsSection(t)}
      ${renderTravelRouteSection(t)}
      ${renderTravelNotesSection(t)}
      ${renderTravelReflectionsSection(t)}
      <div class="section travel-danger-section">
        <div class="section-title">Zarządzanie</div>
        <button class="delete-btn travel-detail-delete" onclick="confirmDelete(${t.id})">🗑 Usuń podróż</button>
      </div>
      <div class="travel-detail-spacer"></div>
    </div>`;
}

function renderTravelSummarySection(t) {
  const items = [
    { label: 'Cel', value: t.purpose || '–' },
    { label: 'Koszt', valueHtml: travelCostLabel(t) },
    { label: 'Loty', value: t.number_of_flights || 0 },
    { label: 'Ocena', valueHtml: t.rating ? stars(t.rating) : '–', className: 'rating' },
    { label: 'Album', value: t.has_photo_album ? 'Tak' : 'Nie' },
    { label: 'Opis', value: t.is_description_complete ? 'Kompletny' : 'Do uzupełnienia' },
  ];
  return `<div class="section travel-summary-section">
    <div class="section-title">Podsumowanie</div>
    <div class="travel-summary-grid">
      ${items.map(item => renderMetricItem(item, {
        itemClass: 'travel-summary-card',
        valueClass: 'travel-summary-value',
        labelClass: 'travel-summary-label',
        labelFirst: true,
      })).join('')}
    </div>
  </div>`;
}

function renderTravelParticipantsSection(t) {
  const participants = t.participants || [];
  return `<div class="section" id="section-participants">
    <div class="section-header">
      <div>
        <div class="section-title">Uczestnicy</div>
        <div class="travel-section-sub">${participants.length ? `${participants.length} ${travelPlural(participants.length, 'osoba', 'osoby', 'osób')}` : 'Brak dopisanych osób'}</div>
      </div>
      <button class="section-action" onclick="openAddParticipant(${t.id})">＋ Dodaj</button>
    </div>
    <div class="person-chips travel-person-chips" id="participants-chips">
      ${participants.length ? participants.map(p => `
        <div class="person-chip" id="chip-${p.id}">
          <div class="avatar">${initials(p.name)}</div>
          <div class="person-chip-text"><div class="person-chip-name">${escapeHtml(p.name.split(' ')[0])}</div>
          ${p.relation_type ? `<div class="person-chip-meta">${escapeHtml(p.relation_type)}</div>` : ''}</div>
          <button class="row-icon-button danger" onclick="removeParticipantFromTravel(${t.id}, ${p.id})" title="Usuń uczestnika">✕</button>
        </div>`).join('') : `<div class="empty-chips inline-empty">Brak uczestników</div>`}
    </div>
  </div>`;
}

function sortedTravelLocations(locations) {
  return [...(locations || [])].sort((a, b) => {
    const dateCmp = String(a.arrival_date || '').localeCompare(String(b.arrival_date || ''));
    if (dateCmp) return dateCmp;
    return String(a.location_name || '').localeCompare(String(b.location_name || ''), 'pl');
  });
}

function renderTravelRouteSection(t) {
  const locations = sortedTravelLocations(t.locations || []);
  const ids = locations.map(l => parseInt(l.location_id, 10)).filter(Boolean);
  return `<div class="section travel-route-section" id="section-locations">
    <div class="section-header travel-route-header">
      <div>
        <div class="section-title">Trasa i miejsca</div>
        <div class="travel-section-sub">${locations.length ? `${locations.length} ${travelPlural(locations.length, 'wpis', 'wpisy', 'wpisów')} trasy` : 'Brak miejsc w podróży'}</div>
      </div>
      <div class="section-actions">
        ${ids.length ? `<button class="section-action secondary" onclick="showTravelOnMap([${ids.join(',')}])">🗺 Mapa</button>` : ''}
        <button class="section-action" onclick="openAddLocationToTravel(${t.id}, '${t.start_date}', '${t.end_date}')">＋ Dodaj</button>
      </div>
    </div>
    <div class="travel-route-list" id="locations-list">
      ${locations.length ? renderTravelRouteGroups(t, locations) : `<div class="empty-locs inline-empty">Brak miejsc</div>`}
    </div>
  </div>`;
}

function renderTravelRouteGroups(t, locations) {
  const groups = [];
  locations.forEach(location => {
    const key = location.arrival_date || 'no-date';
    let group = groups.find(item => item.key === key);
    if (!group) {
      group = { key, items: [] };
      groups.push(group);
    }
    group.items.push(location);
  });
  return groups.map(group => {
    const title = group.key === 'no-date' ? 'Bez daty' : fmtDate(group.key);
    const day = group.key === 'no-date' ? '' : travelDayLabel(group.key, t.start_date);
    return `<div class="travel-route-day" data-route-day="${escapeAttr(group.key)}">
      <div class="travel-route-day-header">
        <div>
          <div class="travel-route-date">${escapeHtml(title)}</div>
          ${day ? `<div class="travel-route-day-sub">${escapeHtml(day)}</div>` : ''}
        </div>
        <div class="travel-route-count">${group.items.length} ${travelPlural(group.items.length, 'miejsce', 'miejsca', 'miejsc')}</div>
      </div>
      ${group.items.map(location => renderTravelLocationRow(t.id, location)).join('')}
    </div>`;
  }).join('');
}

function renderTravelLocationRow(travelId, l) {
  const type = l.location_type || '';
  const country = l.country_name || '';
  return `<div class="travel-route-row loc-row" id="tl-${l.id}"
      data-arrival="${escapeAttr(l.arrival_date || '')}"
      data-departure="${escapeAttr(l.departure_date || '')}"
      data-notes="${escapeAttr(l.notes || '')}"
      data-location-id="${escapeAttr(l.location_id || '')}">
      <div class="travel-route-icon">${locationIcon(type)}</div>
      <div class="travel-route-main">
        <div class="travel-route-top">
          <button type="button" class="travel-route-name" onclick="openLocation(${l.location_id})">${escapeHtml(l.location_name)}</button>
          <div class="travel-route-dates" id="tl-dates-${l.id}">${escapeHtml(travelVisitDateLabel(l.arrival_date, l.departure_date))}</div>
        </div>
        <div class="travel-route-meta">
          ${type ? `<span>${escapeHtml(type)}</span>` : ''}
          ${country ? `<span>${escapeHtml(country)}</span>` : ''}
        </div>
        <div class="travel-route-note-wrap" id="tl-note-wrap-${l.id}">
          ${travelLocationNoteHtml(l.id, l.notes)}
        </div>
      </div>
      <div class="row-actions">
        <button class="row-icon-button primary" onclick="openEditTravelLocation(${travelId}, ${l.id})" title="Edytuj wizytę">✎</button>
        <button class="row-icon-button danger" onclick="removeLocationFromTravel(${travelId}, ${l.id})" title="Usuń z podróży">✕</button>
      </div>
    </div>`;
}

function travelLocationNoteHtml(id, notes) {
  const text = String(notes || '').trim();
  if (!text) return `<div class="travel-route-note-empty" id="tl-notes-${id}"></div>`;
  const preview = text.length > 86 ? `${text.slice(0, 83)}…` : text;
  return `<details class="travel-route-note">
    <summary><span>Notatka</span><span class="travel-route-note-preview">${escapeHtml(preview)}</span></summary>
    <div class="travel-route-note-text" id="tl-notes-${id}">${escapeHtml(text)}</div>
  </details>`;
}

function parseTravelDailyNotes(notes) {
  const result = { intro: [], days: [] };
  String(notes || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const day = line.match(/^(\d{4}-\d{2}-\d{2})\s+-\s+(.+)$/);
    if (day) {
      result.days.push({ date: day[1], text: day[2] });
    } else if (!line.includes('-->')) {
      result.intro.push(line);
    }
  });
  return result;
}

function renderTravelNotesSection(t) {
  if (!t.notes) return '';
  const parsed = parseTravelDailyNotes(t.notes);
  if (parsed.days.length >= 2) {
    return `<div class="section travel-notes-section">
      <div class="section-title">Notatki dzienne</div>
      ${parsed.intro.length ? `<div class="notes-text travel-notes-intro">${escapeHtml(parsed.intro.join('\n'))}</div>` : ''}
      <div class="travel-day-notes">
        ${parsed.days.map((day, idx) => `<details class="travel-day-card"${idx < 2 ? ' open' : ''}>
          <summary>
            <span class="travel-day-title">${escapeHtml(fmtDate(day.date))}</span>
            <span class="travel-day-tag">${escapeHtml(travelDayLabel(day.date, t.start_date))}</span>
          </summary>
          <div class="travel-day-text">${escapeHtml(day.text)}</div>
        </details>`).join('')}
      </div>
    </div>`;
  }
  return `<div class="section travel-notes-section">
    <div class="section-title">Notatki</div>
    <div class="notes-text">${escapeHtml(t.notes)}</div>
  </div>`;
}

function renderTravelReflectionsSection(t) {
  if (!t.reflections) return '';
  return `<div class="section">
    <div class="section-title">Wspomnienia</div>
    <div class="reflections-text">${escapeHtml(t.reflections)}</div>
  </div>`;
}

async function openTravel(id) {
  setMapViewMode(false);
  const view = document.getElementById('view');
  resetViewScroll(view);
  view.innerHTML = skeletonCards(3);
  const t = await api('/api/travels/' + id);
  if (!t || !t.id) {
    if (t && t.error) toast('Nie znaleziono podróży', 'error');
    showTab('travels');
    return;
  }
  window._currentTravel = t;
  view.innerHTML = renderTravelDetail(t);
}

async function confirmDelete(id) {
  return withActionLock(`travel-delete-${id}`, async () => {
    const ok = await askConfirm({
      title: 'Usunąć podróż?',
      message: 'Trafi do Kosza — możesz przywrócić.',
      confirmText: 'Do Kosza', danger: true,
    });
    if (!ok) return;
    const res = await apiDelete('/api/travels/' + id);
    if (res.error) { toastApiError(res, 'Nie udało się przenieść podróży do kosza'); return; }
    toast('Podróż w koszu', 'success');
    showTab('travels');
  });
}

async function removeParticipantFromTravel(travelId, personId) {
  return withActionLock(`travel-${travelId}-participant-delete-${personId}`, async () => {
    const res = await apiDelete(`/api/travels/${travelId}/participants/${personId}`);
    if (res.error) { toastApiError(res, 'Nie udało się usunąć uczestnika z podróży'); return; }
    const chip = document.getElementById('chip-' + personId);
    removeWithSlide(chip, () => {
      const chips = document.getElementById('participants-chips');
      if (chips && !chips.querySelector('.person-chip'))
        chips.innerHTML = `<div class="empty-chips inline-empty">Brak uczestników</div>`;
    });
  });
}

async function openAddParticipant(travelId) {
  if (!beginOverlayOpen('participant-overlay')) return;
  try {
    const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
    const addedIds = new Set([...(document.querySelectorAll('#participants-chips .person-chip') || [])].map(el => parseInt(el.id.replace('chip-', ''))));
    const available = persons.filter(p => !addedIds.has(p.id));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay'; overlay.id = 'participant-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">Dodaj uczestnika</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('participant-overlay'))">Gotowe</button></div>
      <div class="form-section"><div class="form-label">Wybierz z listy</div>
        ${available.length ? available.map(p => `
          <div class="person-row" onclick="addParticipantToTravel(${travelId}, ${p.id}, '${jsStringArg(p.name)}', '${jsStringArg(p.relation_type || '')}', this)">
            <div class="avatar">${escapeHtml(initials(p.name))}</div>
            <div class="person-row-info"><div style="font-size:14px;font-weight:500">${escapeHtml(p.name)}</div>
              ${p.relation_type ? `<div style="font-size:12px;color:var(--text2)">${escapeHtml(p.relation_type)}</div>` : ''}</div>
            <div class="person-row-plus">＋</div></div>`).join('') : `<div style="color:var(--text3);font-size:13px;padding:8px 0">Wszystkie osoby już dodane</div>`}
      </div>
      <div class="form-section form-section-divider">
        <div class="form-label">Lub dodaj nową osobę</div>
        <input class="form-input" id="new-person-name" placeholder="Imię i nazwisko">
        <div class="form-label">Typ relacji</div>
        <select class="form-input" id="new-person-reltype"><option value="">– brak –</option>
          ${relTypes.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select>
        <button class="form-primary-btn" onclick="createAndAddPerson(${travelId})">Dodaj nową osobę</button>
      </div></div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('participant-overlay');
  }
}

async function addParticipantToTravel(travelId, personId, name, relType, rowEl) {
  const res = await apiPost(`/api/travels/${travelId}/participants`, { person_id: personId });
  if (res.error) { toastApiError(res, 'Nie udało się dodać uczestnika do podróży'); return; }
  rowEl.remove();
  const chips = document.getElementById('participants-chips');
  if (chips) {
    chips.querySelectorAll('.empty-chips').forEach(el => el.remove());
    const chip = document.createElement('div'); chip.className = 'person-chip'; chip.id = 'chip-' + personId;
    chip.innerHTML = `<div class="avatar">${escapeHtml(initials(name))}</div><div class="person-chip-text"><div class="person-chip-name">${escapeHtml(name.split(' ')[0])}</div>${relType ? `<div class="person-chip-meta">${escapeHtml(relType)}</div>` : ''}</div>
      <button class="row-icon-button danger" onclick="removeParticipantFromTravel(${travelId}, ${personId})" title="Usuń uczestnika">✕</button>`;
    chips.appendChild(chip);
  }
}

async function createAndAddPerson(travelId) {
  const name = document.getElementById('new-person-name').value.trim();
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('new-person-reltype').value;
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) { toastApiError(res, 'Nie udało się dodać osoby'); return; }
  const addRes = await apiPost(`/api/travels/${travelId}/participants`, { person_id: res.id });
  if (addRes.error) { toastApiError(addRes, 'Osoba została dodana, ale nie udało się dopiąć jej do podróży'); return; }
  closeModal(document.getElementById('participant-overlay'));
  const chips = document.getElementById('participants-chips');
  if (chips) {
    chips.querySelectorAll('.empty-chips').forEach(el => el.remove());
    const chip = document.createElement('div'); chip.className = 'person-chip'; chip.id = 'chip-' + res.id;
    chip.innerHTML = `<div class="avatar">${escapeHtml(initials(name))}</div><div class="person-chip-text"><div class="person-chip-name">${escapeHtml(name.split(' ')[0])}</div></div>
      <button class="row-icon-button danger" onclick="removeParticipantFromTravel(${travelId}, ${res.id})" title="Usuń uczestnika">✕</button>`;
    chips.appendChild(chip);
  }
}

function openAddTravel() { openWizard(); }
function openEditTravel() {
  const t = window._currentTravel;
  if (!t) { toast('Brak danych podróży', 'error'); return; }
  openTravelModal(t, false);
}

function openTravelModal(t, isNew) {
  if (!beginOverlayOpen('travel-form-overlay')) return;
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'travel-form-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${isNew ? 'Nowa podróż' : 'Edytuj podróż'}</span>
      <button class="modal-save" onclick="saveTravel(${t.id || 0}, ${isNew})">Zapisz</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa</div><input class="form-input" id="f-name" value="${escapeAttr(t.name || '')}" placeholder="np. Wakacje w Lizbonie">
      <div class="form-label">Cel</div><input class="form-input" id="f-purpose" value="${escapeAttr(t.purpose || '')}" placeholder="np. Wakacje">
      <div class="form-row">
        <div><div class="form-label">Data początek</div><input class="form-input" type="date" id="f-start" value="${t.start_date || ''}"></div>
        <div><div class="form-label">Data koniec</div><input class="form-input" type="date" id="f-end" value="${t.end_date || ''}"></div>
      </div>
      <div class="form-row">
        <div><div class="form-label">Koszt</div><input class="form-input" type="number" id="f-amount" value="${t.amount || 0}"></div>
        <div><div class="form-label">Waluta</div><input class="form-input" id="f-currency" value="${escapeAttr(t.currency || 'PLN')}"></div>
      </div>
      <div class="form-row">
        <div><div class="form-label">Liczba lotów</div><input class="form-input" type="number" id="f-flights" value="${t.number_of_flights || 0}"></div>
        <div><div class="form-label">Ocena (0.5–5, krok 0.5)</div><input class="form-input" type="number" min="0.5" max="5" step="0.5" id="f-rating" value="${t.rating || ''}"></div>
      </div>
      <div class="form-row">
        <div><div class="form-label">Album ze zdjęciami</div>
          <select class="form-input" id="f-album">
            <option value="0" ${!t.has_photo_album ? 'selected' : ''}>Nie</option>
            <option value="1" ${t.has_photo_album ? 'selected' : ''}>Tak</option>
          </select></div>
        <div><div class="form-label">Opis kompletny</div>
          <select class="form-input" id="f-complete">
            <option value="0" ${!t.is_description_complete ? 'selected' : ''}>Nie</option>
            <option value="1" ${t.is_description_complete ? 'selected' : ''}>Tak</option>
          </select></div>
      </div>
      <div class="form-label">Notatki</div><textarea class="form-input form-textarea" id="f-notes">${escapeHtml(t.notes || '')}</textarea>
      <div class="form-label">Wspomnienia</div><textarea class="form-input form-textarea" id="f-reflections">${escapeHtml(t.reflections || '')}</textarea>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  finishOverlayOpen('travel-form-overlay');
}

async function saveTravel(id, isNew) {
  const body = {
    name: document.getElementById('f-name').value, purpose: document.getElementById('f-purpose').value,
    start_date: document.getElementById('f-start').value, end_date: document.getElementById('f-end').value,
    amount: parseFloat(document.getElementById('f-amount').value) || 0, currency: document.getElementById('f-currency').value || 'PLN',
    number_of_flights: parseInt(document.getElementById('f-flights').value) || 0, rating: parseFloat(document.getElementById('f-rating').value) || null,
    has_photo_album: parseInt(document.getElementById('f-album').value), notes: document.getElementById('f-notes').value,
    reflections: document.getElementById('f-reflections').value,
    is_description_complete: parseInt(document.getElementById('f-complete').value)
  };
  if (!body.start_date || !body.end_date) { toast('Podaj daty podróży', 'error'); return; }
  if (isNew) {
    const res = await apiPost('/api/travels', body);
    if (res.error) { toastApiError(res, 'Nie udało się utworzyć podróży'); return; }
    closeModal(document.getElementById('travel-form-overlay'));
    toast('Podróż utworzona', 'success');
    showTab('travels');
    return;
  }
  let res = await apiPut('/api/travels/' + id, body);
  if (res.error && res.conflict && res.conflicts) {
    const choice = await askTravelDateConflict(res.conflicts);
    if (!choice) return;
    res = await apiPut('/api/travels/' + id, { ...body, on_conflict: choice });
  }
  if (res.error) { toastApiError(res, 'Nie udało się zapisać podróży'); return; }
  toast('Zapisano', 'success');
  closeModal(document.getElementById('travel-form-overlay'));
  openTravel(id);
}

function askTravelDateConflict(conflicts) {
  return new Promise(resolve => {
    document.getElementById('travel-conflict-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay'; overlay.id = 'travel-conflict-overlay';
    const list = conflicts.map(c => `
      <div class="modal-list-row">
        <div class="modal-row-title">${escapeHtml(c.location_name)}</div>
        <div class="modal-row-sub">${fmtDate(c.arrival_date) || '?'} – ${fmtDate(c.departure_date) || '?'}</div>
      </div>`).join('');
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">⚠️ Konflikt dat</span></div>
      <div class="form-section">
        <div class="travel-conflict-copy">
          Po zmianie dat podróży <strong>${conflicts.length}</strong> ${conflicts.length === 1 ? 'wizyta wypada' : (conflicts.length < 5 ? 'wizyty wypadają' : 'wizyt wypada')} poza nowy zakres:
        </div>
        <div class="travel-conflict-list">
          ${list}
        </div>
        <div class="form-action-stack">
          <button class="form-primary-btn" data-choice="clip">Przytnij daty wizyt do nowego zakresu</button>
          <button class="form-secondary-btn" data-choice="ignore">Zapisz mimo to (zostaw daty wizyt)</button>
          <button class="form-tertiary-btn" data-choice="cancel">Anuluj</button>
        </div>
      </div></div>`;
    overlay.addEventListener('click', e => {
      const btn = e.target.closest('[data-choice]');
      if (btn) {
        const choice = btn.dataset.choice;
        closeModal(overlay);
        resolve(choice === 'cancel' ? null : choice);
      } else if (e.target === overlay) {
        closeModal(overlay);
        resolve(null);
      }
    });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => { closeModal(overlay); resolve(null); });
  });
}
