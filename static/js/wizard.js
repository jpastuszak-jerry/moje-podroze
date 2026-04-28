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
  document.getElementById('wizard-overlay')?.remove();
  wizardState = null;
}

function renderWizard() {
  document.getElementById('wizard-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'wizard-overlay';
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
      <div><div class="form-label">Ocena (1–5)</div>
        <input class="form-input" type="number" id="wi-rating" value="${s.rating}" min="1" max="5" placeholder="–"></div>
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
    <div style="height:8px"></div>`;
}

function wizardStep0Save() {
  const name = document.getElementById('wi-name').value.trim();
  if (!name) { alert('Podaj nazwę podróży!'); return false; }
  const start = document.getElementById('wi-start').value;
  const end   = document.getElementById('wi-end').value;
  if (!start || !end) { alert('Podaj daty podróży!'); return false; }
  if (end < start) { alert('Data powrotu nie może być wcześniejsza niż data wyjazdu!'); return false; }
  wizardState.info = {
    name,
    purpose:  document.getElementById('wi-purpose').value.trim(),
    start_date: start, end_date: end,
    amount:   parseFloat(document.getElementById('wi-amount').value) || 0,
    currency: document.getElementById('wi-currency').value.trim() || 'PLN',
    number_of_flights: parseInt(document.getElementById('wi-flights').value) || 0,
    rating:   parseInt(document.getElementById('wi-rating').value) || null,
    has_photo_album: parseInt(document.getElementById('wi-album').value),
    is_description_complete: parseInt(document.getElementById('wi-complete').value),
    notes: document.getElementById('wi-notes').value.trim(),
    reflections: document.getElementById('wi-reflections').value.trim(),
  };
  return true;
}

/* ── Krok 1: Lokacje ──────────────────────────────────────── */

async function wizardStep1Render(body) {
  body.innerHTML = `<div class="spinner"></div>`;
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
  const addedHtml = added.length ? added.map((l, i) => `
    <div class="wiz-loc-item" id="wiz-loc-${i}">
      <div class="wiz-loc-icon">${locationIcon(l.location_type)}</div>
      <div class="wiz-loc-info">
        <div class="wiz-loc-name">${escapeHtml(l.name)}</div>
        <div class="wiz-loc-sub">${escapeHtml(l.location_type)}${l.country_name ? ' · ' + escapeHtml(l.country_name) : ''}${l.arrival ? ' · ' + fmtDate(l.arrival) + (l.departure ? ' – ' + fmtDate(l.departure) : '') : ''}</div>
      </div>
      <button class="wiz-loc-remove" onclick="wizardRemoveLocation(${i})">✕</button>
    </div>`).join('') : `<div style="color:var(--text3);font-size:13px;padding:8px 0 16px">Nie dodano jeszcze żadnych miejsc.</div>`;

  const grouped = {};
  locs.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  const pickerHtml = Object.entries(grouped).map(([country, items]) => `
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;padding:10px 0 4px">${country}</div>
    ${items.map(l => `
      <div class="wiz-picker-item" onclick="wizardPickLocation(${l.id})">
        <div class="wiz-picker-icon">${locationIcon(l.location_type)}</div>
        <div class="wiz-picker-info">
          <div class="wiz-picker-name">${escapeHtml(l.name)}</div>
          <div class="wiz-picker-sub">${escapeHtml(l.location_type)}${l.parent_name ? ' · ' + escapeHtml(l.parent_name) : ''}</div>
        </div>
        <div class="wiz-picker-plus">＋</div>
      </div>`).join('')}`).join('');

  return `
    <div style="margin-bottom:16px">
      <div class="form-label" style="margin-bottom:8px">Dodane miejsca</div>
      <div id="wiz-loc-added">${addedHtml}</div>
    </div>

    <div style="background:var(--bg);border-radius:14px;padding:12px;margin-bottom:12px">
      <div class="form-label" style="margin-bottom:10px">Wybierz z bazy</div>
      <div class="search-box" style="margin-bottom:10px;margin-top:0">
        <input type="search" placeholder="Szukaj miejsca lub kraju…" id="wiz-loc-search"
          oninput="wizardFilterPicker(this.value)"
          style="width:100%;padding:8px 12px 8px 36px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:15px;outline:none">
      </div>
      <div id="wiz-picker-list" style="max-height:35vh;overflow-y:auto">${pickerHtml}</div>
    </div>

    <button onclick="wizardOpenNewLocation()"
      style="background:var(--green-light);color:var(--green);border:none;border-radius:12px;padding:12px;width:100%;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px">
      ＋ Dodaj nowe miejsce do bazy
    </button>
    <div style="height:8px"></div>`;
}

function wizardFilterPicker(q) {
  const all = wizardState.allLocs || [];
  const filtered = q.trim()
    ? all.filter(l => l.name.toLowerCase().includes(q.toLowerCase()) || (l.country_name||'').toLowerCase().includes(q.toLowerCase()))
    : all;
  const grouped = {};
  filtered.forEach(l => { if (!grouped[l.country_name]) grouped[l.country_name] = []; grouped[l.country_name].push(l); });
  document.getElementById('wiz-picker-list').innerHTML = Object.entries(grouped).map(([country, items]) => `
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;padding:10px 0 4px">${country}</div>
    ${items.map(l => `
      <div class="wiz-picker-item" onclick="wizardPickLocation(${l.id})">
        <div class="wiz-picker-icon">${locationIcon(l.location_type)}</div>
        <div class="wiz-picker-info">
          <div class="wiz-picker-name">${escapeHtml(l.name)}</div>
          <div class="wiz-picker-sub">${escapeHtml(l.location_type)}${l.parent_name ? ' · ' + escapeHtml(l.parent_name) : ''}</div>
        </div>
        <div class="wiz-picker-plus">＋</div>
      </div>`).join('')}`).join('') || `<div style="color:var(--text3);font-size:13px;padding:8px 0">Brak wyników</div>`;
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
        <button class="modal-save" onclick="document.getElementById('wiz-loc-date-overlay').remove()">Anuluj</button>
      </div>
      <div class="form-section">
        ${alreadyIdx >= 0 ? `<div style="background:var(--orange-light);color:var(--orange);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px">To miejsce już jest na liście. Możesz je zaktualizować.</div>` : ''}
        <div class="form-row">
          <div><div class="form-label">Przyjazd</div>
            <input class="form-input" type="date" id="wld-arrival" value="${alreadyIdx >= 0 ? (wizardState.locations[alreadyIdx].arrival || s.start_date) : s.start_date}"></div>
          <div><div class="form-label">Wyjazd</div>
            <input class="form-input" type="date" id="wld-departure" value="${alreadyIdx >= 0 ? (wizardState.locations[alreadyIdx].departure || s.end_date) : s.end_date}"></div>
        </div>
        <div class="form-label">Notatka (opcjonalnie)</div>
        <input class="form-input" id="wld-notes" placeholder="np. hotel nad morzem" value="${alreadyIdx >= 0 ? escapeHtml(wizardState.locations[alreadyIdx].notes || '') : ''}">
        <button id="wld-save-btn" onclick="wizardConfirmLocation(${locId}, ${alreadyIdx})"
          style="background:var(--blue);color:white;border:none;border-radius:12px;padding:14px;width:100%;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">
          ${alreadyIdx >= 0 ? 'Zaktualizuj' : 'Dodaj miejsce'}
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function wizardConfirmLocation(locId, existingIdx) {
  const btn = document.getElementById('wld-save-btn');
  if (btn?.disabled) return;
  const loc = (wizardState.allLocs || []).find(l => l.id === locId);
  if (!loc) return;

  const arrival   = document.getElementById('wld-arrival').value || null;
  const departure = document.getElementById('wld-departure').value || null;
  const notes     = document.getElementById('wld-notes').value.trim() || null;

  const s = wizardState.info;
  const outOfRange =
    (arrival   && (arrival   < s.start_date || arrival   > s.end_date)) ||
    (departure && (departure < s.start_date || departure > s.end_date));
  if (outOfRange) {
    const ok = confirm(`Daty wizyty są poza zakresem podróży (${s.start_date} – ${s.end_date}).\n\nZapisać mimo to?`);
    if (!ok) return;
  }

  if (btn) btn.disabled = true;

  const entry = {
    id: loc.id, name: loc.name, location_type: loc.location_type,
    country_name: loc.country_name, parent_name: loc.parent_name || null,
    arrival, departure, notes,
  };

  if (existingIdx >= 0) wizardState.locations[existingIdx] = entry;
  else wizardState.locations.push(entry);

  document.getElementById('wiz-loc-date-overlay').remove();

  const added = document.getElementById('wiz-loc-added');
  if (added) {
    added.innerHTML = wizardState.locations.map((l, i) => `
      <div class="wiz-loc-item" id="wiz-loc-${i}">
        <div class="wiz-loc-icon">${locationIcon(l.location_type)}</div>
        <div class="wiz-loc-info">
          <div class="wiz-loc-name">${escapeHtml(l.name)}</div>
          <div class="wiz-loc-sub">${escapeHtml(l.location_type)}${l.country_name ? ' · ' + escapeHtml(l.country_name) : ''}${l.arrival ? ' · ' + fmtDate(l.arrival) + (l.departure ? ' – ' + fmtDate(l.departure) : '') : ''}</div>
        </div>
        <button class="wiz-loc-remove" onclick="wizardRemoveLocation(${i})">✕</button>
      </div>`).join('');
  }
}

function wizardRemoveLocation(idx) {
  wizardState.locations.splice(idx, 1);
  const added = document.getElementById('wiz-loc-added');
  if (added) {
    if (!wizardState.locations.length) {
      added.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:8px 0 16px">Nie dodano jeszcze żadnych miejsc.</div>`;
    } else {
      added.innerHTML = wizardState.locations.map((l, i) => `
        <div class="wiz-loc-item" id="wiz-loc-${i}">
          <div class="wiz-loc-icon">${locationIcon(l.location_type)}</div>
          <div class="wiz-loc-info">
            <div class="wiz-loc-name">${escapeHtml(l.name)}</div>
            <div class="wiz-loc-sub">${escapeHtml(l.location_type)}${l.country_name ? ' · ' + escapeHtml(l.country_name) : ''}</div>
          </div>
          <button class="wiz-loc-remove" onclick="wizardRemoveLocation(${i})">✕</button>
        </div>`).join('');
    }
  }
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
        <button class="modal-save" onclick="document.getElementById('wiz-new-loc-overlay').remove()">Anuluj</button>
      </div>
      <div class="form-section">
        <div class="form-label">Nazwa miejsca *</div>
        <input class="form-input" id="wnl-name" placeholder="np. Catania">
        <div class="form-row">
          <div><div class="form-label">Kraj *</div>
            <select class="form-input" id="wnl-country" onchange="wizardUpdateParentList()">
              <option value="">– wybierz –</option>
              ${countries.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select></div>
          <div><div class="form-label">Typ *</div>
            <select class="form-input" id="wnl-type">
              <option value="">– wybierz –</option>
              ${locTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-label">Miejsce nadrzędne (opcjonalnie)</div>
        <select class="form-input" id="wnl-parent"><option value="">– brak –</option></select>
        <div class="form-label">Adres (opcjonalnie)</div>
        <input class="form-input" id="wnl-address" placeholder="np. centrum">
        <div class="form-label">GPS (opcjonalnie)</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <input class="form-input" id="wnl-lat" placeholder="Szer." style="margin-bottom:0;flex:1;min-width:0">
          <input class="form-input" id="wnl-lng" placeholder="Dług." style="margin-bottom:0;flex:1;min-width:0">
          <button id="wnl-geocode-btn" onclick="geocodeForLocModal('wnl')"
            style="background:var(--blue);color:white;border:none;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">🔍</button>
        </div>
        <div id="wnl-geo-results" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;max-height:160px;overflow-y:auto"></div>
        <button id="wnl-save-btn" onclick="wizardSaveNewLocation()"
          style="background:var(--blue);color:white;border:none;border-radius:12px;padding:14px;width:100%;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">
          Zapisz i dodaj do podróży
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function wizardUpdateParentList() {
  if (!document.getElementById('wiz-new-loc-overlay')) return;
  const countryId = parseInt(document.getElementById('wnl-country').value) || null;
  const cSel = document.getElementById('wnl-country');
  const countryName = countryId ? (cSel.options[cSel.selectedIndex]?.text || null) : null;
  const filtered = countryName ? (wizardState.allLocs || []).filter(l => l.country_name === countryName) : [];
  document.getElementById('wnl-parent').innerHTML = '<option value="">– brak –</option>' +
    filtered.map(l => `<option value="${l.id}">${l.name} (${l.location_type})</option>`).join('');
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

  if (!name)      { alert('Podaj nazwę miejsca!'); return; }
  if (!countryId) { alert('Wybierz kraj!'); return; }
  if (!typeId)    { alert('Wybierz typ miejsca!'); return; }

  const typeSelect = document.getElementById('wnl-type');
  const typeName = typeSelect.options[typeSelect.selectedIndex]?.text || '';
  const cSel = document.getElementById('wnl-country');
  const countryName = cSel.options[cSel.selectedIndex]?.text || '';

  const dup = findDuplicateLocation(wizardState.allLocs, name, countryName, parentId);
  let force = false;
  if (dup) {
    if (!confirmDuplicateLocation(dup, countryName)) return;
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
      if (!confirmDuplicateLocation(res.existing, countryName)) {
        if (btn) { btn.disabled = false; btn.textContent = origLabel; }
        return;
      }
      res = await apiPost('/api/locations', { ...body, force_duplicate: true });
    }
    if (res.error) {
      alert('Błąd: ' + res.error);
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

    const added = document.getElementById('wiz-loc-added');
    if (added) {
      added.innerHTML = wizardState.locations.map((l, i) => `
        <div class="wiz-loc-item">
          <div class="wiz-loc-icon">${locationIcon(l.location_type)}</div>
          <div class="wiz-loc-info">
            <div class="wiz-loc-name">${escapeHtml(l.name)}</div>
            <div class="wiz-loc-sub">${escapeHtml(l.location_type)} · ${escapeHtml(l.country_name)}</div>
          </div>
          <button class="wiz-loc-remove" onclick="wizardRemoveLocation(${i})">✕</button>
        </div>`).join('');
    }
  } catch (err) {
    alert('Nieoczekiwany błąd: ' + err.message);
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

/* ── Krok 2: Uczestnicy ──────────────────────────────────── */

async function wizardStep2Render(body) {
  body.innerHTML = `<div class="spinner"></div>`;
  const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
  wizardState.relTypes = relTypes;

  const addedIds = new Set(wizardState.participants.map(p => p.id));
  const available = persons.filter(p => !addedIds.has(p.id));

  const addedHtml = wizardState.participants.length
    ? wizardState.participants.map((p, i) => `
        <div class="wiz-person-item">
          <div class="avatar">${initials(p.name)}</div>
          <div class="wiz-person-info">
            <div class="wiz-person-name">${escapeHtml(p.name)}</div>
            ${p.relation_type ? `<div class="wiz-person-rel">${escapeHtml(p.relation_type)}</div>` : ''}
          </div>
          <button class="wiz-person-remove" onclick="wizardRemoveParticipant(${i})">✕</button>
        </div>`).join('')
    : `<div style="color:var(--text3);font-size:13px;padding:8px 0 16px">Brak uczestników — możesz pominąć ten krok.</div>`;

  const pickHtml = available.length
    ? available.map(p => `
        <div class="person-row" onclick="wizardPickParticipant(${p.id}, '${p.name.replace(/'/g,"\\'")}', '${(p.relation_type||'').replace(/'/g,"\\'")}', this)">
          <div class="avatar">${initials(p.name)}</div>
          <div class="person-row-info">
            <div style="font-size:14px;font-weight:500">${escapeHtml(p.name)}</div>
            ${p.relation_type ? `<div style="font-size:12px;color:var(--text2)">${escapeHtml(p.relation_type)}</div>` : ''}
          </div>
          <div class="person-row-plus">＋</div>
        </div>`).join('')
    : `<div style="color:var(--text3);font-size:13px;padding:8px 0">Wszystkie osoby już dodane.</div>`;

  const relOpts = relTypes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');

  body.innerHTML = `
    <div style="margin-bottom:16px">
      <div class="form-label" style="margin-bottom:8px">Uczestnicy tej podróży</div>
      <div id="wiz-part-added">${addedHtml}</div>
    </div>

    <div style="background:var(--bg);border-radius:14px;padding:12px;margin-bottom:12px">
      <div class="form-label" style="margin-bottom:10px">Wybierz z listy</div>
      <div id="wiz-part-list">${pickHtml}</div>
    </div>

    <div style="background:var(--bg);border-radius:14px;padding:12px;margin-bottom:8px">
      <div class="form-label" style="margin-bottom:8px">Dodaj nową osobę</div>
      <input class="form-input" id="wiz-new-person-name" placeholder="Imię i nazwisko">
      <select class="form-input" id="wiz-new-person-rel">
        <option value="">– typ relacji –</option>${relOpts}
      </select>
      <button id="wiz-new-person-btn" onclick="wizardCreatePerson()"
        style="background:var(--blue);color:white;border:none;border-radius:12px;padding:12px;width:100%;font-size:14px;font-weight:600;cursor:pointer">
        Dodaj osobę
      </button>
    </div>
    <div style="height:8px"></div>`;
}

function wizardPickParticipant(id, name, relType, rowEl) {
  wizardState.participants.push({ id, name, relation_type: relType });
  rowEl.remove();

  const added = document.getElementById('wiz-part-added');
  if (added) {
    added.querySelectorAll('div[style*="Brak uczestników"]').forEach(el => el.remove());
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
  if (!name) { alert('Podaj imię i nazwisko!'); return; }
  const relTypeId = document.getElementById('wiz-new-person-rel').value;
  const relType = relTypeId ? ((wizardState.relTypes || []).find(r => r.id === parseInt(relTypeId))?.name || '') : '';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Zapisuję…'; }
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) {
    alert('Błąd: ' + res.error);
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
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:18px">${locationIcon(l.location_type)}</span>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:500">${escapeHtml(l.name)}</div>
            <div style="font-size:12px;color:var(--text2)">${escapeHtml(l.location_type)}${l.arrival ? ' · ' + fmtDate(l.arrival) + (l.departure ? ' – ' + fmtDate(l.departure) : '') : ''}</div>
          </div>
        </div>`).join('')
    : `<div style="color:var(--text3);font-size:13px">Brak miejsc</div>`;

  const partsHtml = parts.length
    ? `<div class="person-chips">${parts.map(p => `
        <div class="person-chip">
          <div class="avatar">${initials(p.name)}</div>
          <div><div style="font-size:13px;font-weight:500">${p.name.split(' ')[0]}</div>
          ${p.relation_type ? `<div style="font-size:11px;color:var(--text2)">${escapeHtml(p.relation_type)}</div>` : ''}</div>
        </div>`).join('')}</div>`
    : `<div style="color:var(--text3);font-size:13px">Brak uczestników</div>`;

  return `
    <div class="wiz-summary-block">
      <div class="wiz-summary-label">Podróż</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:${purposeIconBg(s.purpose)};flex-shrink:0">${purposeIcon(s.purpose)}</div>
        <div>
          <div style="font-size:17px;font-weight:700">${escapeHtml(s.name)}</div>
          <div style="font-size:13px;color:var(--text2)">${fmtDate(s.start_date)} – ${fmtDate(s.end_date)} · ${days} dni</div>
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

    ${s.notes ? `<div class="wiz-summary-block"><div class="wiz-summary-label">Notatki</div><div style="font-size:14px;line-height:1.6">${escapeHtml(s.notes)}</div></div>` : ''}
    <div style="height:8px"></div>`;
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

    if (travelRes.error) { alert('Błąd zapisu podróży: ' + travelRes.error); btn.disabled = false; btn.textContent = '✓ Zapisz podróż'; return; }
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
    openTravel(travelId);
  } catch (err) {
    alert('Nieoczekiwany błąd: ' + err.message);
    btn.disabled = false;
    btn.textContent = '✓ Zapisz podróż';
  }
}
