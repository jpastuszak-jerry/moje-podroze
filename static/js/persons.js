async function openPersonsModal() {
  if (!beginOverlayOpen('persons-overlay')) return;
  try {
  const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
  const relOpts = relTypes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'persons-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Osoby</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('persons-overlay'))">Gotowe</button></div>
    <div class="form-section">
      <div class="form-inline-row">
        <input class="form-input" id="new-person-modal-name" placeholder="Imię i nazwisko">
        <button class="form-icon-btn" onclick="addPersonFromModal()">Dodaj</button>
      </div>
      <select class="form-input form-spaced" id="new-person-modal-rel">
        <option value="">– typ relacji –</option>
        ${relOpts}
      </select>
      <div id="persons-list">${buildPersonsList(persons, relTypes)}</div>
    </div></div>`;
  overlay._relTypes = relTypes;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  } finally {
    finishOverlayOpen('persons-overlay');
  }
}

async function addPersonFromModal() {
  const name = await readInputValue('new-person-modal-name');
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('new-person-modal-rel').value;
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) { toastApiError(res, 'Nie udało się dodać osoby'); return; }
  toast('Dodano: ' + name, 'success');
  document.getElementById('new-person-modal-name').value = '';
  document.getElementById('new-person-modal-rel').value = '';
  const overlay = document.getElementById('persons-overlay');
  const relTypes = overlay._relTypes || [];
  const persons = await api('/api/persons');
  document.getElementById('persons-list').innerHTML = buildPersonsList(persons, relTypes);
}

function buildPersonsList(persons, relTypes) {
  if (!persons.length) return `<div class="modal-list-empty">Brak osób</div>`;
  return persons.map(p => {
    const relOpts = `<option value="">– brak –</option>` +
      relTypes.map(r => `<option value="${r.id}"${r.id === p.relation_type_id ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
    return `<div class="modal-list-row" id="person-row-${p.id}">
      ${renderPickerRow({
        id: `person-view-${p.id}`,
        rowClass: 'modal-row-view',
        iconHtml: initials(p.name),
        iconClass: 'avatar modal-row-avatar',
        title: p.name,
        subtitle: p.relation_type || '',
        plusHtml: '',
        actionsHtml: `<button class="modal-row-button neutral" onclick="startEditPerson(${p.id})">✏️</button>
          <button class="modal-row-button danger" onclick="deletePersonFromModal(${p.id})">✕</button>`,
      })}
      <div id="person-edit-${p.id}" class="hidden">
        <input class="form-input form-edit-input" id="person-name-${p.id}" value="${(p.name||'').replace(/"/g,'&quot;')}">
        <select class="form-input" id="person-rel-${p.id}">${relOpts}</select>
        <div class="inline-edit-actions">
          <button class="inline-form-button primary" onclick="saveEditPerson(${p.id})">Zapisz</button>
          <button class="inline-form-button secondary" onclick="cancelEditPerson(${p.id})">Anuluj</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function startEditPerson(id) {
  document.getElementById('person-view-'+id).classList.add('hidden');
  document.getElementById('person-edit-'+id).classList.remove('hidden');
}

function cancelEditPerson(id) {
  document.getElementById('person-view-'+id).classList.remove('hidden');
  document.getElementById('person-edit-'+id).classList.add('hidden');
}

async function saveEditPerson(id) {
  const name = await readInputValue('person-name-'+id);
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('person-rel-'+id).value;
  const res = await apiPut('/api/persons/'+id, { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) { toastApiError(res, 'Nie udało się zapisać osoby'); return; }
  toast('Zapisano', 'success');
  const overlay = document.getElementById('persons-overlay');
  const relTypes = overlay._relTypes || [];
  const persons = await api('/api/persons');
  document.getElementById('persons-list').innerHTML = buildPersonsList(persons, relTypes);
}

async function deletePersonFromModal(id) {
  return withActionLock(`person-delete-${id}`, async () => {
    const ok = await askConfirm({
      title: 'Usunąć osobę?',
      message: 'Zostanie też usunięta ze wszystkich podróży. Tej operacji nie można cofnąć.',
      confirmText: 'Usuń', danger: true,
    });
    if (!ok) return;
    const data = await apiDelete('/api/persons/' + id);
    if (data.error) { toastApiError(data, 'Nie udało się usunąć osoby'); return; }
    const row = document.getElementById('person-row-'+id);
    if (!row) return;
    row.remove();
    toast('Usunięto', 'success');
  });
}
