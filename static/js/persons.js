async function openPersonsModal() {
  const [persons, relTypes] = await Promise.all([api('/api/persons'), api('/api/relation_types')]);
  const relOpts = relTypes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'persons-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">Osoby</span>
      <button class="modal-save" onclick="document.getElementById('persons-overlay').remove()">Gotowe</button></div>
    <div class="form-section">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-input" id="new-person-modal-name" placeholder="Imię i nazwisko" style="margin-bottom:0;flex:1">
        <button onclick="addPersonFromModal()" style="background:var(--blue);color:white;border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0">Dodaj</button>
      </div>
      <select class="form-input" id="new-person-modal-rel" style="margin-bottom:14px">
        <option value="">– typ relacji –</option>
        ${relOpts}
      </select>
      <div id="persons-list">${buildPersonsList(persons, relTypes)}</div>
    </div></div>`;
  overlay._relTypes = relTypes;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function addPersonFromModal() {
  const name = document.getElementById('new-person-modal-name').value.trim();
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('new-person-modal-rel').value;
  const res = await apiPost('/api/persons', { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
  toast('Dodano: ' + name, 'success');
  document.getElementById('new-person-modal-name').value = '';
  document.getElementById('new-person-modal-rel').value = '';
  const overlay = document.getElementById('persons-overlay');
  const relTypes = overlay._relTypes || [];
  const persons = await api('/api/persons');
  document.getElementById('persons-list').innerHTML = buildPersonsList(persons, relTypes);
}

function buildPersonsList(persons, relTypes) {
  if (!persons.length) return `<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px">Brak osób</div>`;
  return persons.map(p => {
    const relOpts = `<option value="">– brak –</option>` +
      relTypes.map(r => `<option value="${r.id}"${r.id === p.relation_type_id ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
    return `<div id="person-row-${p.id}" style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div id="person-view-${p.id}" style="display:flex;align-items:center;gap:10px">
        <div class="avatar">${initials(p.name)}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:500">${escapeHtml(p.name)}</div>
          ${p.relation_type ? `<div style="font-size:12px;color:var(--text2)">${escapeHtml(p.relation_type)}</div>` : ''}
        </div>
        <button onclick="startEditPerson(${p.id})" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--text2)">✏️</button>
        <button onclick="deletePersonFromModal(${p.id})" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 2px">✕</button>
      </div>
      <div id="person-edit-${p.id}" class="hidden">
        <input class="form-input" id="person-name-${p.id}" value="${(p.name||'').replace(/"/g,'&quot;')}" style="margin-top:8px">
        <select class="form-input" id="person-rel-${p.id}">${relOpts}</select>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button onclick="saveEditPerson(${p.id})" style="flex:1;background:var(--blue);color:white;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">Zapisz</button>
          <button onclick="cancelEditPerson(${p.id})" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px;font-size:13px;cursor:pointer;color:var(--text2)">Anuluj</button>
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
  const name = document.getElementById('person-name-'+id).value.trim();
  if (!name) { toast('Podaj imię i nazwisko', 'error'); return; }
  const relTypeId = document.getElementById('person-rel-'+id).value;
  const res = await apiPut('/api/persons/'+id, { name, relation_type_id: relTypeId ? parseInt(relTypeId) : null });
  if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
  toast('Zapisano', 'success');
  const overlay = document.getElementById('persons-overlay');
  const relTypes = overlay._relTypes || [];
  const persons = await api('/api/persons');
  document.getElementById('persons-list').innerHTML = buildPersonsList(persons, relTypes);
}

async function deletePersonFromModal(id) {
  const ok = await askConfirm({
    title: 'Usunąć osobę?',
    message: 'Zostanie też usunięta ze wszystkich podróży. Tej operacji nie można cofnąć.',
    confirmText: 'Usuń', danger: true,
  });
  if (!ok) return;
  const res = await fetch(API + '/api/persons/' + id, { method: 'DELETE' });
  const data = await res.json();
  if (data.error) { toast(data.error, 'error'); return; }
  document.getElementById('person-row-'+id)?.remove();
  toast('Usunięto', 'success');
}
