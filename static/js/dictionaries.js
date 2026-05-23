async function openDictionaryModal(apiPath, title) {
  if (!beginOverlayOpen('dict-overlay')) return;
  try {
  const items = await api(apiPath);
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'dict-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
    <div class="modal-header"><span class="modal-title">${title}</span>
      <button class="modal-save" onclick="closeModal(document.getElementById('dict-overlay'))">Gotowe</button></div>
    <div class="form-section">
      <div class="form-inline-row">
        <input class="form-input" id="dict-new-name" placeholder="Nowa pozycja...">
        <button class="form-icon-btn" id="dict-add-btn">Dodaj</button>
      </div>
      <div id="dict-list">${buildDictList(items)}</div>
    </div></div>`;
  overlay._apiPath = apiPath;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  attachDragToDismiss(overlay, '.modal', () => closeModal(overlay));
  document.getElementById('dict-add-btn').addEventListener('click', () => addDictItem(apiPath));
  } finally {
    finishOverlayOpen('dict-overlay');
  }
}

function buildDictList(items) {
  if (!items.length) return `<div class="modal-list-empty">Brak pozycji</div>`;
  return items.map(item => `
    <div class="dict-row modal-list-row modal-row-view" id="dict-row-${item.id}">
      <span class="dict-label modal-row-main modal-row-title" id="dict-label-${item.id}">${escapeHtml(item.name)}</span>
      <input class="form-input dict-edit-input compact-input modal-row-main hidden" id="dict-edit-${item.id}" value="${escapeHtml(item.name)}">
      <button class="modal-row-button neutral" onclick="startEditDict(${item.id})" id="dict-edit-btn-${item.id}">✏️</button>
      <button class="modal-row-button primary hidden" onclick="saveEditDict(${item.id})" id="dict-save-btn-${item.id}">Zapisz</button>
      <button class="modal-row-button danger" onclick="deleteDictItem(${item.id})">✕</button>
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
  const newName = await readInputValue('dict-edit-'+id);
  if (!newName) { toast('Podaj nazwę', 'error'); return; }
  const res = await apiPut(`${apiPath}/${id}`, { name: newName });
  if (res.error) { toastApiError(res, 'Nie udało się zapisać pozycji'); return; }
  document.getElementById('dict-label-'+id).textContent = newName;
  document.getElementById('dict-label-'+id).classList.remove('hidden');
  document.getElementById('dict-edit-btn-'+id).classList.remove('hidden');
  document.getElementById('dict-edit-'+id).classList.add('hidden');
  document.getElementById('dict-save-btn-'+id).classList.add('hidden');
}

async function deleteDictItem(id) {
  return withActionLock(`dict-delete-${id}`, async () => {
    const overlay = document.getElementById('dict-overlay'); const apiPath = overlay._apiPath;
    const label = document.getElementById('dict-label-'+id)?.textContent || 'tę pozycję';
    const ok = await askConfirm({
      title: 'Usunąć pozycję?',
      message: `"${label}" zostanie usunięta. Tej operacji nie można cofnąć.`,
      confirmText: 'Usuń', danger: true,
    });
    if (!ok) return;
    const data = await apiDelete(`${apiPath}/${id}`);
    if (data && data.error) { toastApiError(data, 'Nie udało się usunąć pozycji'); return; }
    const row = document.getElementById('dict-row-'+id);
    if (!row) return;
    row.remove();
    toast('Usunięto', 'success');
  });
}

function exportFilenameFromContentDisposition(header) {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1].replace(/"/g, '').trim());
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

function exportRecordCountLabel(data) {
  const total = data && data.metadata && Number(data.metadata.total_records);
  if (!Number.isFinite(total)) return '';
  if (total === 1) return '1 rekord';
  if ([2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100)) return `${total} rekordy`;
  return `${total} rekordów`;
}

async function exportDatabase() {
  toast('Pobieram backup bazy...', 'info');
  try {
    const res = await fetch(API + '/api/export', { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toastApiError(decorateApiError(body, res.status), 'Nie udało się pobrać backupu');
      return;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      toast('Nieoczekiwana odpowiedź serwera (nie JSON)', 'error');
      return;
    }
    const data = await res.json().catch(() => null);
    if (!data || !data.tables) {
      toast('Backup ma nieoczekiwany format', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const today = new Date().toISOString().slice(0, 10);
    const filename = exportFilenameFromContentDisposition(res.headers.get('content-disposition')) ||
      `moje-podroze-backup-${today}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const countLabel = exportRecordCountLabel(data);
    toast(countLabel ? `Backup pobrany (${countLabel})` : 'Backup pobrany', 'success');
  } catch (e) {
    toast('Błąd sieci: ' + e.message, 'error');
  }
}

async function addDictItem(apiPath) {
  const name = await readInputValue('dict-new-name');
  if (!name) { toast('Podaj nazwę', 'error'); return; }
  const res = await apiPost(apiPath, { name });
  if (res.error) { toastApiError(res, 'Nie udało się dodać pozycji'); return; }
  toast('Dodano: ' + name, 'success');
  document.getElementById('dict-new-name').value = '';
  const list = document.getElementById('dict-list');
  if (list.querySelector('.modal-list-empty')) list.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.innerHTML = buildDictList([{ id: res.id, name }]);
  list.appendChild(tmp.firstElementChild);
}
