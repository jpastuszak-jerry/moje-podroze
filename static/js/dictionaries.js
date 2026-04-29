async function openDictionaryModal(apiPath, title) {
  const items = await api(apiPath);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'dict-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${title}</span>
      <button class="modal-save" onclick="document.getElementById('dict-overlay').remove()">Gotowe</button></div>
    <div class="form-section">
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input class="form-input" id="dict-new-name" placeholder="Nowa pozycja..." style="margin-bottom:0;flex:1">
        <button id="dict-add-btn" style="background:var(--blue);color:white;border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0">Dodaj</button>
      </div>
      <div id="dict-list">${buildDictList(items)}</div>
    </div></div>`;
  overlay._apiPath = apiPath;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('dict-add-btn').addEventListener('click', () => addDictItem(apiPath));
}

function buildDictList(items) {
  if (!items.length) return `<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px">Brak pozycji</div>`;
  return items.map(item => `
    <div class="dict-row" id="dict-row-${item.id}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="dict-label" id="dict-label-${item.id}" style="flex:1;font-size:14px">${item.name}</span>
      <input class="form-input dict-edit-input hidden" id="dict-edit-${item.id}" value="${item.name}" style="flex:1;margin-bottom:0;padding:6px 10px">
      <button onclick="startEditDict(${item.id})" id="dict-edit-btn-${item.id}" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--text2)">✏️</button>
      <button onclick="saveEditDict(${item.id})" id="dict-save-btn-${item.id}" class="hidden" style="background:var(--blue);color:white;border:none;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer">Zapisz</button>
      <button onclick="deleteDictItem(${item.id})" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 2px">✕</button>
    </div>`).join('');
}

function startEditDict(id) {
  document.getElementById('dict-label-'+id).classList.add('hidden');
  document.getElementById('dict-edit-btn-'+id).classList.add('hidden');
  document.getElementById('dict-edit-'+id).classList.remove('hidden');
  document.getElementById('dict-save-btn-'+id).classList.remove('hidden');
  document.getElementById('dict-edit-'+id).focus();
}

async function saveEditDict(id) {
  const overlay = document.getElementById('dict-overlay'); const apiPath = overlay._apiPath;
  const newName = document.getElementById('dict-edit-'+id).value.trim();
  if (!newName) { toast('Podaj nazwę', 'error'); return; }
  const res = await apiPut(`${apiPath}/${id}`, { name: newName });
  if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
  document.getElementById('dict-label-'+id).textContent = newName;
  document.getElementById('dict-label-'+id).classList.remove('hidden');
  document.getElementById('dict-edit-btn-'+id).classList.remove('hidden');
  document.getElementById('dict-edit-'+id).classList.add('hidden');
  document.getElementById('dict-save-btn-'+id).classList.add('hidden');
}

async function deleteDictItem(id) {
  const overlay = document.getElementById('dict-overlay'); const apiPath = overlay._apiPath;
  const r = await fetch(`${API}${apiPath}/${id}`, { method: 'DELETE' });
  const data = await r.json();
  if (data.error) { toast(data.error, 'error'); return; }
  document.getElementById('dict-row-'+id)?.remove();
}

async function addDictItem(apiPath) {
  const name = document.getElementById('dict-new-name').value.trim();
  if (!name) { toast('Podaj nazwę', 'error'); return; }
  const res = await apiPost(apiPath, { name });
  if (res.error) { toast('Błąd: ' + res.error, 'error'); return; }
  toast('Dodano: ' + name, 'success');
  document.getElementById('dict-new-name').value = '';
  const list = document.getElementById('dict-list');
  if (list.querySelector('div[style*="text-align:center"]')) list.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.innerHTML = buildDictList([{ id: res.id, name }]);
  list.appendChild(tmp.firstElementChild);
}
