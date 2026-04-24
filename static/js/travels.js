async function renderTravels(q = '') {
  if (q !== undefined) currentSearch = q;
  const view = document.getElementById('view');
  if (!document.getElementById('travel-list')) {
    view.innerHTML =
      '<div class="page-header"><div class="page-title">Moje Podróże</div>' +
      '<div class="search-box"><input type="search" placeholder="Szukaj podróży..." id="travel-search" oninput="onTravelSearch(this.value)"></div></div>' +
      '<div class="sort-bar" id="sort-bar"></div>' +
      '<div id="travel-list"><div class="spinner"></div></div>' +
      '<button class="fab" onclick="openWizard()">＋</button>';
  }
  const sortBar = document.getElementById('sort-bar');
  if (sortBar) {
    const sorts = [
      {key:'date_desc', label:'📅 Najnowsze'},{key:'date_asc', label:'📅 Najstarsze'},
      {key:'cost_desc', label:'💰 Najdroższe'},{key:'cost_asc', label:'💰 Najtańsze'},
      {key:'name_asc', label:'🔤 Nazwa'},{key:'todo', label:'✍️ Do uzupełnienia'},
    ];
    sortBar.innerHTML = sorts.map(s => '<button class="sort-btn' + (currentSort === s.key ? ' active' : '') + '" onclick="setSort(\'' + s.key + '\')">' + s.label + '</button>').join('');
  }
  const list = document.getElementById('travel-list');
  list.innerHTML = '<div class="spinner"></div>';
  let travels = await api('/api/travels' + (currentSearch ? '?q='+encodeURIComponent(currentSearch) : ''));
  if (!travels.length) { list.innerHTML = '<div class="empty">Brak wyników</div>'; return; }
  travels = sortTravels(travels, currentSort);
  list.innerHTML = '<div class="card-list">' + travels.map(t => {
    const done = t.is_description_complete;
    return '<div class="card' + (done ? ' completed' : '') + '" onclick="openTravel(' + t.id + ')">' +
      '<div class="card-inner"><div class="card-icon" style="background:' + purposeIconBg(t.purpose) + '">' + purposeIcon(t.purpose) + '</div>' +
      '<div class="card-body"><div class="card-title">' + escapeHtml(t.name || '(bez nazwy)') + (done ? ' ✓' : '') + '</div>' +
      '<div class="card-subtitle">' + fmtDate(t.start_date) + ' – ' + fmtDate(t.end_date) + ' · ' + daysCount(t.start_date, t.end_date) + ' dni</div>' +
      '<div class="card-meta">' +
      (t.purpose ? '<span class="badge ' + purposeColor(t.purpose) + '">' + escapeHtml(t.purpose) + '</span>' : '') +
      (t.rating ? '<span class="badge badge-orange">' + stars(t.rating) + '</span>' : '') +
      (t.has_photo_album ? '<span class="badge badge-green">📷 Album</span>' : '') +
      (t.amount > 0 ? '<span class="badge badge-purple">' + parseFloat(t.amount).toLocaleString('pl-PL') + ' ' + t.currency + '</span>' : '') +
      '</div></div></div></div>';
  }).join('') + '</div>';
}

function sortTravels(travels, sort) {
  const arr = [...travels];
  if (sort === 'date_desc') return arr.sort((a,b) => b.start_date.localeCompare(a.start_date));
  if (sort === 'date_asc')  return arr.sort((a,b) => a.start_date.localeCompare(b.start_date));
  if (sort === 'cost_desc') return arr.sort((a,b) => parseFloat(b.amount||0) - parseFloat(a.amount||0));
  if (sort === 'cost_asc')  return arr.sort((a,b) => parseFloat(a.amount||0) - parseFloat(b.amount||0));
  if (sort === 'name_asc')  return arr.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'pl'));
  if (sort === 'todo')      return arr.sort((a,b) => (a.is_description_complete?1:0) - (b.is_description_complete?1:0));
  return arr;
}

function setSort(sort) { currentSort = sort; renderTravels(); }
function onTravelSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => renderTravels(val), 400); }

async function openTravel(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="spinner"></div>`;
  const t = await api('/api/travels/' + id);
  view.innerHTML = `
    <div class="detail-header-gradient" style="background:${purposeGradient(t.purpose)}">
      <button class="back-btn" onclick="showTab('travels')">‹ Podróże</button>
      <div class="detail-title">${escapeHtml(t.name || '(bez nazwy)')}</div>
      <div class="detail-sub">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}</div>
      <div class="travel-header-pill">${purposeIcon(t.purpose)} ${escapeHtml(t.purpose || 'Podróż')} · ${daysCount(t.start_date, t.end_date)} dni${t.rating ? ' · ' + stars(t.rating) : ''}</div>
    </div>
    <div class="detail-body">
      <div class="section"><div class="section-title">Szczegóły</div>
        <div class="info-grid">
          <div class="info-item"><label>Cel</label><span>${escapeHtml(t.purpose || '–')}</span></div>
          <div class="info-item"><label>Czas trwania</label><span>${daysCount(t.start_date, t.end_date)} dni</span></div>
          <div class="info-item"><label>Koszt</label><span>${t.amount > 0 ? t.amount.toLocaleString('pl-PL')+' '+escapeHtml(t.currency) : '–'}</span></div>
          <div class="info-item"><label>Loty</label><span>${t.number_of_flights || 0}</span></div>
          <div class="info-item"><label>Ocena</label><span style="color:var(--orange)">${t.rating ? stars(t.rating) : '–'}</span></div>
          <div class="info-item"><label>Album</label><span>${t.has_photo_album ? '📷 Tak' : 'Nie'}</span></div>
        </div>
      </div>
      ${t.notes ? `<div class="section"><div class="section-title">Notatki</div><div class="notes-text">${escapeHtml(t.notes)}</div></div>` : ''}
      ${t.reflections ? `<div class="section"><div class="section-title">Wspomnienia</div><div class="reflections-text">${escapeHtml(t.reflections)}</div></div>` : ''}
      <div class="section" id="section-locations">
        <div class="section-header">
          <div class="section-title">Odwiedzone miejsca${t.locations && t.locations.length ? ' (' + t.locations.length + ')' : ''}</div>
          <div style="display:flex;gap:6px">
            ${t.locations && t.locations.length ? `<button class="btn-add-small" onclick="showTravelOnMap([${t.locations.map(l=>l.location_id).join(',')}])" style="background:var(--blue-light);color:var(--blue)">🗺 Mapa</button>` : ''}
            <button class="btn-add-small" onclick="openAddLocationToTravel(${t.id}, '${t.start_date}', '${t.end_date}')">＋ Dodaj</button>
          </div>
        </div>
        <div id="locations-list">
          ${(t.locations && t.locations.length) ? t.locations.map(l => `
            <div class="loc-row" id="tl-${l.id}"
              data-arrival="${l.arrival_date||''}"
              data-departure="${l.departure_date||''}"
              data-notes="${(l.notes||'').replace(/"/g,'&quot;')}"
              data-location-id="${l.location_id}">
              <div class="loc-icon">${locationIcon(l.location_type)}</div>
              <div style="flex:1">
                <div class="loc-name">${escapeHtml(l.location_name)}</div>
                <div class="loc-sub">${escapeHtml(l.location_type)} · ${escapeHtml(l.country_name)}</div>
                <div class="loc-sub" id="tl-dates-${l.id}">${fmtDate(l.arrival_date)} – ${fmtDate(l.departure_date)}</div>
                <div class="loc-sub" id="tl-notes-${l.id}" style="font-style:italic">${l.notes ? escapeHtml(l.notes) : ''}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-self:flex-start;margin-top:2px">
                <button onclick="openEditTravelLocation(${t.id}, ${l.id})"
                  style="background:none;border:none;color:var(--blue);font-size:16px;cursor:pointer;padding:0;line-height:1">✎</button>
                <button onclick="removeLocationFromTravel(${t.id}, ${l.id})"
                  style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0;line-height:1">✕</button>
              </div>
            </div>`).join('') : `<div class="empty-locs" style="color:var(--text3);font-size:13px;padding:4px 0">Brak miejsc</div>`}
        </div>
      </div>
      <div class="section" id="section-participants">
        <div class="section-header">
          <div class="section-title">Uczestnicy</div>
          <button class="btn-add-small" onclick="openAddParticipant(${t.id})">＋ Dodaj</button>
        </div>
        <div class="person-chips" id="participants-chips">
          ${(t.participants && t.participants.length) ? t.participants.map(p => `
            <div class="person-chip" id="chip-${p.id}">
              <div class="avatar">${initials(p.name)}</div>
              <div><div style="font-size:13px;font-weight:500">${escapeHtml(p.name.split(' ')[0])}</div>
              ${p.relation_type ? `<div style="font-size:11px;color:var(--text2)">${escapeHtml(p.relation_type)}</div>` : ''}</div>
              <button onclick="removeParticipantFromTravel(${t.id}, ${p.id})"
                style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 0 0 4px;line-height:1">✕</button>
            </div>`).join('') : `<div class="empty-chips" style="color:var(--text3);font-size:13px">Brak uczestników</div>`}
        </div>
      </div>
      <button class="delete-btn" onclick="confirmDelete(${t.id})">🗑 Usuń podróż</button>
      <div style="height:12px"></div>
    </div>
    <button class="fab" onclick="openEditTravel(${JSON.stringify(t).replace(/"/g,'&quot;')})">✎</button>`;
}

async function confirmDelete(id) {
  if (confirm('Usunąć tę podróż? Tej operacji nie można cofnąć.')) {
    await apiDelete('/api/travels/' + id);
    showTab('travels');
  }
}

async function removeParticipantFromTravel(travelId, personId) {
  await apiDelete(`/api/travels/${travelId}/participants/${personId}`);
  const chip = document.getElementById('chip-' + personId);
  if (chip) chip.remove();
  const chips = document.getElementById('participants-chips');
  if (chips && !chips.querySelector('.person-chip'))
    chips.innerHTML = `<div class="empty-chips" style="color:var(--text3);font-size:13px">Brak uczestników</div>`;
}

async function openAddParticipant(travelId) {
  const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
  const addedIds = new Set([...(document.querySelectorAll('#participants-chips .person-chip') || [])].map(el => parseInt(el.id.replace('chip-', ''))));
  const available = persons.filter(p => !addedIds.has(p.id));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'participant-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Dodaj uczestnika</span>
      <button class="modal-save" onclick="document.getElementById('participant-overlay').remove()">Gotowe</button></div>
    <div class="form-section"><div class="form-label">Wybierz z listy</div>
      ${available.length ? available.map(p => `
        <div class="person-row" onclick="addParticipantToTravel(${travelId}, ${p.id}, '${p.name.replace(/'/g,"\\'")}', '${(p.relation_type||'').replace(/'/g,"\\'")}', this)">
          <div class="avatar">${initials(p.name)}</div>
          <div class="person-row-info"><div style="font-size:14px;font-weight:500">${p.name}</div>
            ${p.relation_type ? `<div style="font-size:12px;color:var(--text2)">${p.relation_type}</div>` : ''}</div>
          <div class="person-row-plus">＋</div></div>`).join('') : `<div style="color:var(--text3);font-size:13px;padding:8px 0">Wszystkie osoby już dodane</div>`}
    </div>
    <div class="form-section" style="margin-top:4px;border-top:1px solid var(--border);padding-top:16px">
      <div class="form-label">Lub dodaj nową osobę</div>
      <input class="form-input" id="new-person-name" placeholder="Imię i nazwisko">
      <div class="form-label">Typ relacji</div>
      <select class="form-input" id="new-person-reltype"><option value="">– brak –</option>
        ${relTypes.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select>
      <button onclick="createAndAddPerson(${travelId})"
        style="background:var(--blue);color:white;border:none;border-radius:10px;padding:12px;width:100%;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px">Dodaj nową osobę</button>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function addParticipantToTravel(travelId, personId, name, relType, rowEl) {
  await apiPost(`/api/travels/${travelId}/participants`, { person_id: personId });
  rowEl.remove();
  const chips = document.getElementById('participants-chips');
  if (chips) {
    chips.querySelectorAll('.empty-chips').forEach(el => el.remove());
    const chip = document.createElement('div'); chip.className = 'person-chip'; chip.id = 'chip-' + personId;
    chip.innerHTML = `<div class="avatar">${initials(name)}</div><div><div style="font-size:13px;font-weight:500">${name.split(' ')[0]}</div>${relType ? `<div style="font-size:11px;color:var(--text2)">${relType}</div>` : ''}</div>
      <button onclick="removeParticipantFromTravel(${travelId}, ${personId})" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 0 0 4px;line-height:1">✕</button>`;
    chips.appendChild(chip);
  }
}

async function createAndAddPerson(travelId) {
  const name = document.getElementById('new-person-name').value.trim();
  if (!name) { alert('Podaj imię i nazwisko!'); return; }
  const relTypeId = document.getElementById('new-person-reltype').value;
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  document.getElementById('participant-overlay')?.remove();
  const chips = document.getElementById('participants-chips');
  if (chips) {
    chips.querySelectorAll('.empty-chips').forEach(el => el.remove());
    const chip = document.createElement('div'); chip.className = 'person-chip'; chip.id = 'chip-' + res.id;
    chip.innerHTML = `<div class="avatar">${initials(name)}</div><div><div style="font-size:13px;font-weight:500">${name.split(' ')[0]}</div></div>
      <button onclick="removeParticipantFromTravel(${travelId}, ${res.id})" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 0 0 4px;line-height:1">✕</button>`;
    chips.appendChild(chip);
  }
  await apiPost(`/api/travels/${travelId}/participants`, { person_id: res.id });
}

function openAddTravel() { openWizard(); }
function openEditTravel(t) { openTravelModal(t, false); }

function openTravelModal(t, isNew) {
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${isNew ? 'Nowa podróż' : 'Edytuj podróż'}</span>
      <button class="modal-save" onclick="saveTravel(${t.id || 0}, ${isNew})">Zapisz</button></div>
    <div class="form-section">
      <div class="form-label">Nazwa</div><input class="form-input" id="f-name" value="${t.name || ''}" placeholder="np. Wakacje w Lizbonie">
      <div class="form-label">Cel</div><input class="form-input" id="f-purpose" value="${t.purpose || ''}" placeholder="np. Wakacje">
      <div class="form-row">
        <div><div class="form-label">Data początek</div><input class="form-input" type="date" id="f-start" value="${t.start_date || ''}"></div>
        <div><div class="form-label">Data koniec</div><input class="form-input" type="date" id="f-end" value="${t.end_date || ''}"></div>
      </div>
      <div class="form-row">
        <div><div class="form-label">Koszt</div><input class="form-input" type="number" id="f-amount" value="${t.amount || 0}"></div>
        <div><div class="form-label">Waluta</div><input class="form-input" id="f-currency" value="${t.currency || 'PLN'}"></div>
      </div>
      <div class="form-row">
        <div><div class="form-label">Liczba lotów</div><input class="form-input" type="number" id="f-flights" value="${t.number_of_flights || 0}"></div>
        <div><div class="form-label">Ocena (1–5)</div><input class="form-input" type="number" min="1" max="5" id="f-rating" value="${t.rating || ''}"></div>
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
      <div class="form-label">Notatki</div><textarea class="form-input form-textarea" id="f-notes">${t.notes || ''}</textarea>
      <div class="form-label">Wspomnienia</div><textarea class="form-input form-textarea" id="f-reflections">${t.reflections || ''}</textarea>
    </div></div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function saveTravel(id, isNew) {
  const body = {
    name: document.getElementById('f-name').value, purpose: document.getElementById('f-purpose').value,
    start_date: document.getElementById('f-start').value, end_date: document.getElementById('f-end').value,
    amount: parseFloat(document.getElementById('f-amount').value) || 0, currency: document.getElementById('f-currency').value || 'PLN',
    number_of_flights: parseInt(document.getElementById('f-flights').value) || 0, rating: parseInt(document.getElementById('f-rating').value) || null,
    has_photo_album: parseInt(document.getElementById('f-album').value), notes: document.getElementById('f-notes').value,
    reflections: document.getElementById('f-reflections').value,
    is_description_complete: parseInt(document.getElementById('f-complete').value)
  };
  if (!body.start_date || !body.end_date) { alert('Podaj daty podróży!'); return; }
  document.querySelector('.modal-overlay').remove();
  if (isNew) { await apiPost('/api/travels', body); showTab('travels'); }
  else { await apiPut('/api/travels/' + id, body); openTravel(id); }
}
