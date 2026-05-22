/* ─────────────────────────────────────────────────────────────
   WIZARD — Nowa Podróż
   Stan przechowywany w obiekcie wizardState.
   Kroki: 1 Podstawowe info → 2 Lokacje → 3 Uczestnicy → 4 Podsumowanie
───────────────────────────────────────────────────────────── */

let wizardState = null;

const WIZARD_STEPS = [
  { label: 'Podstawowe info' },
  { label: 'Lokacje'         },
  { label: 'Uczestnicy'      },
  { label: 'Podsumowanie'    },
];

function openWizard() {
  const today = new Date().toISOString().slice(0, 10);
  wizardState = {
    step: 0,
    info: {
      name: '', purpose: 'Wakacje', start_date: today, end_date: today,
      amount: '', currency: 'PLN', number_of_flights: 0,
      rating: '', has_photo_album: false, notes: '', reflections: '',
      is_description_complete: false,
    },
    locations: [],    // { id, name, location_type, country_name, parent_name, arrival, departure, notes }
    participants: [],  // { id, name, relation_type }
    allLocs: [],
    countries: [],
    locTypes: [],
    relTypes: [],
  };
  renderWizard();
}

function closeWizard() {
  document.getElementById('wiz-loc-date-overlay')?.remove();
  document.getElementById('wiz-new-loc-overlay')?.remove();
  const ov = document.getElementById('wizard-overlay');
  if (ov) closeModal(ov);
  wizardState = null;
}

function renderWizard() {
  const prev = document.getElementById('wizard-overlay');
  const wasOpen = !!prev;
  prev?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'wizard-overlay' + (wasOpen ? ' no-anim' : '');
  overlay.id = 'wizard-overlay';

  const step = wizardState.step;
  const dotsHtml = WIZARD_STEPS.map((_, i) =>
    `<div class="wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}"></div>`
  ).join('');

  const isLast = step === WIZARD_STEPS.length - 1;

  overlay.innerHTML = `
    <div class="wizard-sheet" id="wizard-sheet">
      <div class="wizard-header">
        <div class="wizard-handle"></div>
        <div class="wizard-progress">${dotsHtml}</div>
        <div class="wizard-title-row">
          <div class="wizard-title">${WIZARD_STEPS[step].label}</div>
          <button class="wizard-close" onclick="closeWizard()">✕</button>
        </div>
        <div class="wizard-step-label">Krok ${step + 1} z ${WIZARD_STEPS.length}</div>
      </div>
      <div class="wizard-body" id="wizard-body"></div>
      <div class="wizard-footer">
        ${step > 0 ? `<button class="wizard-btn-back" onclick="wizardBack()">‹ Wstecz</button>` : ''}
        <button class="wizard-btn-next ${isLast ? 'green' : ''}" id="wizard-next-btn"
          onclick="${isLast ? 'wizardSave()' : 'wizardNext()'}">
          ${isLast ? '✓ Zapisz podróż' : 'Dalej ›'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  if (!wasOpen) attachDragToDismiss(overlay, '.wizard-sheet', () => closeWizard());
  renderWizardStep();
}

function renderWizardStep() {
  const body = document.getElementById('wizard-body');
  if (!body) return;
  const step = wizardState.step;
  if (step === 0) body.innerHTML = wizardStep0Html();
  else if (step === 1) wizardStep1Render(body);
  else if (step === 2) wizardStep2Render(body);
  else if (step === 3) body.innerHTML = wizardStep3Html();
}

function wizardTailSpacerHtml() {
  return '<div class="wizard-tail-spacer"></div>';
}

function wizardEmptyHtml(text, compact = false) {
  return `<div class="wizard-list-empty${compact ? ' compact' : ''}">${escapeHtml(text)}</div>`;
}

function wizardLocationSub(l, includeCountry = true) {
  const parts = [l.location_type];
  if (includeCountry && l.country_name) parts.push(l.country_name);
  if (l.arrival) parts.push(`${fmtDate(l.arrival)}${l.departure ? ' – ' + fmtDate(l.departure) : ''}`);
  return parts.filter(Boolean).map(escapeHtml).join(' · ');
}

function wizardLocationRowsHtml(locations = wizardState.locations) {
  if (!locations.length) return wizardEmptyHtml('Nie dodano jeszcze żadnych miejsc.');
  return locations.map((l, i) => `
    <div class="wiz-loc-item" id="wiz-loc-${i}">
      <div class="wiz-loc-icon">${locationIcon(l.location_type)}</div>
      <div class="wiz-loc-info">
        <div class="wiz-loc-name">${escapeHtml(l.name)}</div>
        <div class="wiz-loc-sub">${wizardLocationSub(l)}</div>
      </div>
      <button class="wiz-loc-remove" onclick="wizardRemoveLocation(${i})">✕</button>
    </div>`).join('');
}

function wizardRenderAddedLocations() {
  const added = document.getElementById('wiz-loc-added');
  if (added) added.innerHTML = wizardLocationRowsHtml();
}

function wizardGroupedLocationsHtml(locs) {
  if (!locs.length) return wizardEmptyHtml('Brak wyników', true);
  const grouped = {};
  locs.forEach(l => {
    const country = l.country_name || 'Bez kraju';
    if (!grouped[country]) grouped[country] = [];
    grouped[country].push(l);
  });
  return Object.entries(grouped).map(([country, items]) => `
    <div class="wizard-picker-group">${escapeHtml(country)}</div>
    ${items.map(l => `
      <div class="wiz-picker-item" onclick="wizardPickLocation(${l.id})">
        <div class="wiz-picker-icon">${locationIcon(l.location_type)}</div>
        <div class="wiz-picker-info">
          <div class="wiz-picker-name">${escapeHtml(l.name)}</div>
          <div class="wiz-picker-sub">${escapeHtml(l.location_type)}${l.parent_name ? ' · ' + escapeHtml(l.parent_name) : ''}</div>
        </div>
        <div class="wiz-picker-plus">＋</div>
      </div>`).join('')}`).join('');
}

function wizardParticipantRowsHtml(participants = wizardState.participants) {
  if (!participants.length) return wizardEmptyHtml('Brak uczestników — możesz pominąć ten krok.');
  return participants.map((p, i) => `
    <div class="wiz-person-item">
      <div class="avatar">${initials(p.name)}</div>
      <div class="wiz-person-info">
        <div class="wiz-person-name">${escapeHtml(p.name)}</div>
        ${p.relation_type ? `<div class="wiz-person-rel">${escapeHtml(p.relation_type)}</div>` : ''}
      </div>
      <button class="wiz-person-remove" onclick="wizardRemoveParticipant(${i})">✕</button>
    </div>`).join('');
}

function wizardAvailableParticipantsHtml(available) {
  if (!available.length) return wizardEmptyHtml('Wszystkie osoby już dodane.', true);
  return available.map(p => `
    <div class="person-row" onclick="wizardPickParticipant(${p.id}, '${jsStringArg(p.name)}', '${jsStringArg(p.relation_type || '')}', this)">
      <div class="avatar">${initials(p.name)}</div>
      <div class="person-row-info">
        <div class="modal-row-title">${escapeHtml(p.name)}</div>
        ${p.relation_type ? `<div class="modal-row-sub">${escapeHtml(p.relation_type)}</div>` : ''}
      </div>
      <div class="person-row-plus">＋</div>
    </div>`).join('');
}

/* ── Krok 0: Podstawowe info ──────────────────────────────── */

function wizardStep0Html() {
  const s = wizardState.info;
  return `
    <div class="form-label">Nazwa podróży *</div>
    <input class="form-input" id="wi-name" value="${escapeHtml(s.name)}" placeholder="np. Sycylia 2025" autofocus>

    <div class="form-label">Cel / charakter</div>
    <input class="form-input" id="wi-purpose" value="${escapeHtml(s.purpose)}" placeholder="np. Wakacje, Służbowo…">

    <div class="form-row">
      <div><div class="form-label">Data wyjazdu *</div>
        <input class="form-input" type="date" id="wi-start" value="${s.start_date}"></div>
      <div><div class="form-label">Data powrotu *</div>
        <input class="form-input" type="date" id="wi-end" value="${s.end_date}"></div>
    </div>

    <div class="form-row">
      <div><div class="form-label">Koszt całkowity</div>
        <input class="form-input" type="number" id="wi-amount" value="${s.amount}" placeholder="0"></div>
      <div><div class="form-label">Waluta</div>
        <input class="form-input" id="wi-currency" value="${s.currency}" placeholder="PLN"></div>
    </div>

    <div class="form-row">
      <div><div class="form-label">Liczba lotów</div>
        <input class="form-input" type="number" id="wi-flights" value="${s.number_of_flights}" min="0"></div>
      <div><div class="form-label">Ocena (0.5–5, krok 0.5)</div>
        <input class="form-input" type="number" id="wi-rating" value="${s.rating}" min="0.5" max="5" step="0.5" placeholder="–"></div>
    </div>

    <div class="form-row">
      <div><div class="form-label">Album ze zdjęciami</div>
        <select class="form-input" id="wi-album">
          <option value="0" ${!s.has_photo_album ? 'selected' : ''}>Nie</option>
          <option value="1" ${s.has_photo_album ? 'selected' : ''}>Tak</option>
        </select></div>
      <div><div class="form-label">Opis kompletny</div>
        <select class="form-input" id="wi-complete">
          <option value="0" ${!s.is_description_complete ? 'selected' : ''}>Nie</option>
          <option value="1" ${s.is_description_complete ? 'selected' : ''}>Tak</option>
        </select></div>
    </div>

    <div class="form-label">Notatki</div>
    <textarea class="form-input form-textarea" id="wi-notes" placeholder="Ogólne uwagi…">${escapeHtml(s.notes)}</textarea>

    <div class="form-label">Wspomnienia / refleksje</div>
    <textarea class="form-input form-textarea" id="wi-reflections" placeholder="Co zapamiętasz z tej podróży?">${escapeHtml(s.reflections)}</textarea>
    ${wizardTailSpacerHtml()}`;
}

function wizardStep0Save() {
  const name = document.getElementById('wi-name').value.trim();
  if (!name) { toast('Podaj nazwę podróży', 'error'); return false; }
  const start = document.getElementById('wi-start').value;
  const end   = document.getElementById('wi-end').value;
  if (!start || !end) { toast('Podaj daty podróży', 'error'); return false; }
  if (end < start) { toast('Data powrotu nie może być wcześniejsza niż data wyjazdu', 'error'); return false; }
  wizardState.info = {
    name,
    purpose:  document.getElementById('wi-purpose').value.trim(),
    start_date: start, end_date: end,
    amount:   parseFloat(document.getElementById('wi-amount').value) || 0,
    currency: document.getElementById('wi-currency').value.trim() || 'PLN',
    number_of_flights: parseInt(document.getElementById('wi-flights').value) || 0,
    rating:   parseFloat(document.getElementById('wi-rating').value) || null,
    has_photo_album: parseInt(document.getElementById('wi-album').value),
    is_description_complete: parseInt(document.getElementById('wi-complete').value),
    notes: document.getElementById('wi-notes').value.trim(),
    reflections: document.getElementById('wi-reflections').value.trim(),
  };
  return true;
}

/* ── Krok 1: Lokacje ──────────────────────────────────────── */

async function wizardStep1Render(body) {
  body.innerHTML = skeletonCards(3);
  const [locs, countries, locTypes] = await Promise.all([
    api('/api/locations'),
    api('/api/countries'),
    api('/api/location_types'),
  ]);
  wizardState.allLocs = locs;
  wizardState.countries = countries;
  wizardState.locTypes = locTypes;

  body.innerHTML = wizardLocationsHtml(locs, countries, locTypes);
}

function wizardLocationsHtml(locs, countries, locTypes) {
  const added = wizardState.locations;
  const addedHtml = wizardLocationRowsHtml(added);
  const pickerHtml = wizardGroupedLocationsHtml(locs);

  return `
    <div class="wizard-section">
      <div class="form-label wizard-section-label">Dodane miejsca</div>
      <div id="wiz-loc-added">${addedHtml}</div>
    </div>

    <div class="wizard-panel">
      <div class="form-label wizard-section-label">Wybierz z bazy</div>
      <div class="search-box modal-search">
        <input type="search" placeholder="Szukaj miejsca lub kraju…" id="wiz-loc-search"
          oninput="wizardFilterPicker(this.value)">
      </div>
      <div id="wiz-picker-list" class="wizard-scroll-list">${pickerHtml}</div>
    </div>

    <button class="form-secondary-btn" onclick="wizardOpenNewLocation()">
      ＋ Dodaj nowe miejsce do bazy
    </button>
    ${wizardTailSpacerHtml()}`;
}

function wizardFilterPicker(q) {
  const all = wizardState.allLocs || [];
  const filtered = q.trim()
    ? all.filter(l => (l.name || '').toLowerCase().includes(q.toLowerCase()) || (l.country_name || '').toLowerCase().includes(q.toLowerCase()))
    : all;
  document.getElementById('wiz-picker-list').innerHTML = wizardGroupedLocationsHtml(filtered);
}

function wizardPickLocation(locId) {
  const loc = (wizardState.allLocs || []).find(l => l.id === locId);
  if (!loc) return;

  document.getElementById('wiz-loc-date-overlay')?.remove();

  const alreadyIdx = wizardState.locations.findIndex(l => l.id === locId);
  const s = wizardState.info;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay wizard-sub'; overlay.id = 'wiz-loc-date-overlay';
  overlay.innerHTML = `
    <div class="modal"><div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">${locationIcon(loc.location_type)} ${escapeHtml(loc.name)}</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('wiz-loc-date-overlay'))">Anuluj</button>
      </div>
      <div class="form-section">
        ${alreadyIdx >= 0 ? `<div class="form-notice warning">To miejsce już jest na liście. Możesz je zaktualizować.</div>` : ''}
        <div class="form-row">
          <div><div class="form-label">Przyjazd</div>
            <input class="form-input" type="date" id="wld-arrival" value="${alreadyIdx >= 0 ? (wizardState.locations[alreadyIdx].arrival || s.start_date) : s.start_date}"></div>
          <div><div class="form-label">Wyjazd</div>
            <input class="form-input" type="date" id="wld-departure" value="${alreadyIdx >= 0 ? (wizardState.locations[alreadyIdx].departure || s.end_date) : s.end_date}"></div>
        </div>
        <div class="form-label">Notatka (opcjonalnie)</div>
        <input class="form-input" id="wld-notes" placeholder="np. hotel nad morzem" value="${alreadyIdx >= 0 ? escapeHtml(wizardState.locations[alreadyIdx].notes || '') : ''}">
        <button class="form-primary-btn" id="wld-save-btn" onclick="wizardConfirmLocation(${locId}, ${alreadyIdx})">
          ${alreadyIdx >= 0 ? 'Zaktualizuj' : 'Dodaj miejsce'}
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

async function wizardConfirmLocation(locId, existingIdx) {
  const btn = document.getElementById('wld-save-btn');
  if (btn?.disabled) return;
  const loc = (wizardState.allLocs || []).find(l => l.id === locId);
  if (!loc) return;

  let arrival   = document.getElementById('wld-arrival').value || null;
  let departure = document.getElementById('wld-departure').value || null;
  const notes     = document.getElementById('wld-notes').value.trim() || null;

  const s = wizardState.info;
  const outOfRange =
    (arrival   && (arrival   < s.start_date || arrival   > s.end_date)) ||
    (departure && (departure < s.start_date || departure > s.end_date));
  if (outOfRange) {
    const choice = await askVisitDateRangeAction({ travelStart: s.start_date, travelEnd: s.end_date });
    if (!choice) return;
    if (choice === 'clip') {
      const clipped = clipVisitDatesToTravelRange(arrival, departure, s.start_date, s.end_date);
      arrival = clipped.arrival;
      departure = clipped.departure;
      document.getElementById('wld-arrival').value = arrival || '';
      document.getElementById('wld-departure').value = departure || '';
    }
  }

  if (btn) btn.disabled = true;

  const entry = {
    id: loc.id, name: loc.name, location_type: loc.location_type,
    country_name: loc.country_name, parent_name: loc.parent_name || null,
    arrival, departure, notes,
  };

  if (existingIdx >= 0) wizardState.locations[existingIdx] = entry;
  else wizardState.locations.push(entry);

  closeModal(document.getElementById('wiz-loc-date-overlay'));
  wizardRenderAddedLocations();
}

function wizardRemoveLocation(idx) {
  wizardState.locations.splice(idx, 1);
  wizardRenderAddedLocations();
}

async function wizardOpenNewLocation() {
  document.getElementById('wiz-new-loc-overlay')?.remove();
  const countries = wizardState.countries.length ? wizardState.countries : await api('/api/countries');
  const locTypes  = wizardState.locTypes.length  ? wizardState.locTypes  : await api('/api/location_types');
  const allLocs   = wizardState.allLocs.length   ? wizardState.allLocs   : await api('/api/locations');
  wizardState.countries = countries;
  wizardState.locTypes  = locTypes;
  wizardState.allLocs   = allLocs;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay wizard-sub'; overlay.id = 'wiz-new-loc-overlay';
  overlay.innerHTML = `
    <div class="modal"><div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Nowe miejsce</span>
        <button class="modal-save" onclick="closeModal(document.getElementById('wiz-new-loc-overlay'))">Anuluj</button>
      </div>
      <div class="form-section">
        ${locationFormHtml({
          prefix: 'wnl', countries, locTypes,
          parentChangeHandler: 'wizardUpdateParentList()',
          includeNotes: false,
          saveBtnId: 'wnl-save-btn',
          saveBtnOnclick: 'wizardSaveNewLocation()',
          saveBtnLabel: 'Zapisz i dodaj do podróży',
        })}
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
}

function wizardUpdateParentList() {
  if (!document.getElementById('wiz-new-loc-overlay')) return;
  const countryId = parseInt(document.getElementById('wnl-country').value) || null;
  const cSel = document.getElementById('wnl-country');
  const countryName = countryId ? (cSel.options[cSel.selectedIndex]?.text || null) : null;
  const filtered = countryName ? (wizardState.allLocs || []).filter(l => l.country_name === countryName) : [];
  document.getElementById('wnl-parent').innerHTML = '<option value="">– brak –</option>' +
    filtered.map(l => `<option value="${l.id}">${escapeHtml(l.name)} (${escapeHtml(l.location_type)})</option>`).join('');
}

async function wizardSaveNewLocation() {
  const btn = document.getElementById('wnl-save-btn');
  if (btn?.disabled) return;
  const origLabel = btn?.textContent;

  const name      = document.getElementById('wnl-name').value.trim();
  const countryId = document.getElementById('wnl-country').value;
  const typeId    = document.getElementById('wnl-type').value;
  const parentId  = document.getElementById('wnl-parent').value;
  const address   = document.getElementById('wnl-address').value.trim();
  const latVal    = parseCoord(document.getElementById('wnl-lat').value);
  const lngVal    = parseCoord(document.getElementById('wnl-lng').value);

  if (!name)      { toast('Podaj nazwę miejsca', 'error'); return; }
  if (!countryId) { toast('Wybierz kraj', 'error'); return; }
  if (!typeId)    { toast('Wybierz typ miejsca', 'error'); return; }

  const typeSelect = document.getElementById('wnl-type');
  const typeName = typeSelect.options[typeSelect.selectedIndex]?.text || '';
  const cSel = document.getElementById('wnl-country');
  const countryName = cSel.options[cSel.selectedIndex]?.text || '';

  const dup = findDuplicateLocation(wizardState.allLocs, name, countryName, parentId);
  let force = false;
  if (dup) {
    if (!await confirmDuplicateLocation(dup, countryName)) return;
    force = true;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }

  try {
    const body = {
      name, country_id: parseInt(countryId), location_type_id: parseInt(typeId),
      parent_location_id: parentId ? parseInt(parentId) : null,
      address: address || null, latitude: latVal, longitude: lngVal,
    };
    if (force) body.force_duplicate = true;
    let res = await apiPost('/api/locations', body);
    if (res.error && res.duplicate && res.existing) {
      if (!await confirmDuplicateLocation(res.existing, countryName)) {
        if (btn) { btn.disabled = false; btn.textContent = origLabel; }
        return;
      }
      res = await apiPost('/api/locations', { ...body, force_duplicate: true });
    }
    if (res.error) {
      toast('Błąd: ' + res.error, 'error');
      if (btn) { btn.disabled = false; btn.textContent = origLabel; }
      return;
    }

    const s = wizardState.info;
    wizardState.locations.push({
      id: res.id, name, location_type: typeName, country_name: countryName,
      parent_name: null, arrival: s.start_date, departure: s.end_date, notes: null,
    });

    document.getElementById('wiz-new-loc-overlay')?.remove();

    wizardState.allLocs.push({ id: res.id, name, location_type: typeName, country_name: countryName, parent_name: null, parent_location_id: parentId ? parseInt(parentId) : null });

    wizardRenderAddedLocations();
  } catch (err) {
    toast('Nieoczekiwany błąd: ' + err.message, 'error');
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

/* ── Krok 2: Uczestnicy ──────────────────────────────────── */

async function wizardStep2Render(body) {
  body.innerHTML = skeletonCards(3);
  const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
  wizardState.relTypes = relTypes;

  const addedIds = new Set(wizardState.participants.map(p => p.id));
  const available = persons.filter(p => !addedIds.has(p.id));

  const addedHtml = wizardParticipantRowsHtml();
  const pickHtml = wizardAvailableParticipantsHtml(available);

  const relOpts = relTypes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');

  body.innerHTML = `
    <div class="wizard-section">
      <div class="form-label wizard-section-label">Uczestnicy tej podróży</div>
      <div id="wiz-part-added">${addedHtml}</div>
    </div>

    <div class="wizard-panel">
      <div class="form-label wizard-section-label">Wybierz z listy</div>
      <div id="wiz-part-list">${pickHtml}</div>
    </div>

    <div class="wizard-panel wizard-panel-tight">
      <div class="form-label wizard-section-label">Dodaj nową osobę</div>
      <input class="form-input" id="wiz-new-person-name" placeholder="Imię i nazwisko">
      <select class="form-input" id="wiz-new-person-rel">
        <option value="">– typ relacji –</option>${relOpts}
      </select>
      <button class="form-primary-btn" id="wiz-new-person-btn" onclick="wizardCreatePerson()">
        Dodaj osobę
      </button>
    </div>
    ${wizardTailSpacerHtml()}`;
}

function wizardPickParticipant(id, name, relType, rowEl) {
  wizardState.participants.push({ id, name, relation_type: relType });
  rowEl.remove();

  const added = document.getElementById('wiz-part-added');
  if (added) {
    added.querySelectorAll('.wizard-list-empty').forEach(el => el.remove());
    const item = document.createElement('div');
    item.className = 'wiz-person-item';
    const idx = wizardState.participants.length - 1;
    item.innerHTML = `
      <div class="avatar">${initials(name)}</div>
      <div class="wiz-person-info">
        <div class="wiz-person-name">${escapeHtml(name)}</div>
        ${relType ? `<div class="wiz-person-rel">${escapeHtml(relType)}</div>` : ''}
      </div>
      <button class="wiz-person-remove" onclick="wizardRemoveParticipant(${idx})">✕</button>`;
    added.appendChild(item);
  }
  const list = document.getElementById('wiz-part-list');
  if (list && !list.querySelector('.person-row')) {
    list.innerHTML = wizardEmptyHtml('Wszystkie osoby już dodane.', true);
  }
}

function wizardRemoveParticipant(idx) {
  wizardState.participants.splice(idx, 1);
  const body = document.getElementById('wizard-body');
  if (body) wizardStep2Render(body);
}

async function wizardCreatePerson() {
  const btn = document.getElementById('wiz-new-person-btn');
  if (btn?.disabled) return;
  const name = document.getElementById('wiz-new-person-name').value.trim();
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('wiz-new-person-rel').value;
  const relType = relTypeId ? ((wizardState.relTypes || []).find(r => r.id === parseInt(relTypeId))?.name || '') : '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) {
    toast('Błąd: ' + res.error, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Dodaj osobę'; }
    return;
  }

  wizardState.participants.push({ id: res.id, name, relation_type: relType });
  wizardStep2Render(document.getElementById('wizard-body'));
}

/* ── Krok 3: Podsumowanie ─────────────────────────────────── */

function wizardStep3Html() {
  const s = wizardState.info;
  const locs = wizardState.locations;
  const parts = wizardState.participants;
  const days = daysCount(s.start_date, s.end_date);

  const infoRows = [
    ['Nazwa',    s.name || '–'],
    ['Cel',      s.purpose || '–'],
    ['Daty',     `${fmtDate(s.start_date)} – ${fmtDate(s.end_date)} (${days} dni)`],
    s.amount > 0 && ['Koszt', `${parseFloat(s.amount).toLocaleString('pl-PL')} ${s.currency}`],
    s.number_of_flights > 0 && ['Loty', s.number_of_flights],
    s.rating && ['Ocena', stars(s.rating)],
    s.has_photo_album && ['Album', '📷 Tak'],
  ].filter(Boolean);

  const locsHtml = locs.length
    ? locs.map(l => `
        <div class="wiz-summary-item">
          <span class="wiz-summary-item-icon">${locationIcon(l.location_type)}</span>
          <div class="wiz-summary-item-main">
            <div class="wiz-summary-item-title">${escapeHtml(l.name)}</div>
            <div class="wiz-summary-item-sub">${wizardLocationSub(l, false)}</div>
          </div>
        </div>`).join('')
    : wizardEmptyHtml('Brak miejsc', true);

  const partsHtml = parts.length
    ? `<div class="person-chips">${parts.map(p => `
        <div class="person-chip">
          <div class="avatar">${initials(p.name)}</div>
          <div class="person-chip-text">
            <div class="person-chip-name">${escapeHtml(p.name.split(' ')[0])}</div>
            ${p.relation_type ? `<div class="person-chip-meta">${escapeHtml(p.relation_type)}</div>` : ''}
          </div>
        </div>`).join('')}</div>`
    : wizardEmptyHtml('Brak uczestników', true);

  return `
    <div class="wiz-summary-block">
      <div class="wiz-summary-label">Podróż</div>
      <div class="wiz-summary-hero">
        <div class="wiz-summary-icon" style="--purpose-bg:${purposeIconBg(s.purpose)}">${purposeIcon(s.purpose)}</div>
        <div>
          <div class="wiz-summary-title">${escapeHtml(s.name)}</div>
          <div class="wiz-summary-sub">${fmtDate(s.start_date)} – ${fmtDate(s.end_date)} · ${days} dni</div>
        </div>
      </div>
      ${infoRows.slice(2).map(([k, v]) => `<div class="wiz-summary-row"><span class="wiz-summary-key">${k}</span><span class="wiz-summary-val">${v}</span></div>`).join('')}
    </div>

    <div class="wiz-summary-block">
      <div class="wiz-summary-label">Miejsca (${locs.length})</div>
      ${locsHtml}
    </div>

    <div class="wiz-summary-block">
      <div class="wiz-summary-label">Uczestnicy (${parts.length})</div>
      ${partsHtml}
    </div>

    ${s.notes ? `<div class="wiz-summary-block"><div class="wiz-summary-label">Notatki</div><div class="wiz-summary-note">${escapeHtml(s.notes)}</div></div>` : ''}
    ${wizardTailSpacerHtml()}`;
}

/* ── Nawigacja ────────────────────────────────────────────── */

function wizardNext() {
  if (wizardState.step === 0 && !wizardStep0Save()) return;
  wizardState.step++;
  renderWizard();
}

function wizardBack() {
  if (wizardState.step === 0) return;
  wizardState.step--;
  renderWizard();
}

/* ── Zapis ────────────────────────────────────────────────── */

async function wizardSave() {
  const btn = document.getElementById('wizard-next-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Zapisuję…';

  try {
    const s = wizardState.info;
    const travelRes = await apiPost('/api/travels', {
      name: s.name, purpose: s.purpose,
      start_date: s.start_date, end_date: s.end_date,
      amount: parseFloat(s.amount) || 0, currency: s.currency || 'PLN',
      number_of_flights: parseInt(s.number_of_flights) || 0,
      rating: s.rating || null,
      has_photo_album: parseInt(s.has_photo_album) || 0,
      is_description_complete: parseInt(s.is_description_complete) || 0,
      notes: s.notes || null, reflections: s.reflections || null,
    });

    if (travelRes.error) { toast('Błąd zapisu podróży: ' + travelRes.error, 'error'); btn.disabled = false; btn.textContent = '✓ Zapisz podróż'; return; }
    const travelId = travelRes.id;

    await Promise.all([
      ...wizardState.locations.map(l =>
        apiPost(`/api/travels/${travelId}/locations`, {
          location_id: l.id, arrival_date: l.arrival || null,
          departure_date: l.departure || null, notes: l.notes || null,
          force_outside_range: true,  // user juz zaakceptowal w wizardConfirmLocation
        })
      ),
      ...wizardState.participants.map(p =>
        apiPost(`/api/travels/${travelId}/participants`, { person_id: p.id })
      ),
    ]);

    closeWizard();
    toast('Podróż utworzona', 'success');
    openTravel(travelId);
  } catch (err) {
    toast('Nieoczekiwany błąd: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Zapisz podróż';
  }
}
