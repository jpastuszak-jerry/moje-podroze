let currentTodoFilter = 'all';
let currentTodoYear = null;

function openTodoView(year = null) {
  currentTodoYear = year || null;
  currentTodoFilter = 'all';
  showTab('todo');
}

function setTodoFilter(filter) {
  currentTodoFilter = filter || 'all';
  renderTodo();
}

function setTodoYear(year) {
  currentTodoYear = year || null;
  renderTodo();
}

function resetTodoControls() {
  currentTodoYear = null;
  currentTodoFilter = 'all';
  renderTodo();
}

function renderTodoControls({ years, filters, totalItems, visibleItems }) {
  const yearOptions = '<option value="">Wszystkie lata</option>' +
    years.map(y => `<option value="${escapeAttr(y)}"${String(currentTodoYear || '') === String(y) ? ' selected' : ''}>${escapeHtml(y)}</option>`).join('');
  const filterOptions = [{ key: 'all', label: 'Wszystkie braki', count: null }, ...filters]
    .map(f => `<option value="${escapeAttr(f.key)}"${currentTodoFilter === f.key ? ' selected' : ''}>${escapeHtml(f.label)}${f.count != null ? ` (${f.count})` : ''}</option>`)
    .join('');
  const labels = [];
  if (currentTodoYear) labels.push(String(currentTodoYear));
  const activeFilter = filters.find(f => f.key === currentTodoFilter);
  if (activeFilter) labels.push(activeFilter.label);
  return `<div class="aux-filter-panel">
    <div class="aux-filter-inner">
      <div class="aux-filter-grid">
        <label class="aux-control">
          <span>Rok</span>
          <select class="filter-select" id="todo-year-select" onchange="setTodoYear(this.value ? parseInt(this.value, 10) : null)">${yearOptions}</select>
        </label>
        <label class="aux-control">
          <span>Typ braku</span>
          <select class="filter-select" id="todo-filter-select" onchange="setTodoFilter(this.value)">${filterOptions}</select>
        </label>
      </div>
      <div class="aux-filter-summary">
        <div class="aux-filter-summary-text"><strong>${visibleItems} ${worklistCountLabel(visibleItems)}</strong><span>${labels.length ? labels.map(escapeHtml).join(' · ') : `${totalItems} podróży wymaga uwagi`}</span></div>
        ${labels.length ? '<button class="filter-reset-btn" type="button" onclick="resetTodoControls()">Wyczyść</button>' : ''}
      </div>
    </div>
  </div>`;
}

function todoWorklistCardHtml(item) {
  return `<div class="card" onclick="openTravel(${item.id})">
    <div class="card-inner">
      <div class="card-icon worklist-icon warn">✱</div>
      <div class="card-body">
        <div class="worklist-card-title-row">
          <div class="card-title worklist-card-title">${escapeHtml(item.name || '(bez nazwy)')}</div>
          <button class="btn-add-small" onclick="event.stopPropagation(); openTodoEdit(${item.id})">Edytuj</button>
        </div>
        <div class="card-subtitle">${fmtDate(item.start_date)} · ${item.missing_count} ${item.missing_count === 1 ? 'brak' : 'braki'}</div>
        <div class="card-meta">
          ${(item.missing || []).map(label => `<span class="badge badge-orange">${escapeHtml(label)}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function renderTodo() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Do uzupełnienia</div></div>` + skeletonCards(3);
  const data = await api('/api/stats/todo' + (currentTodoYear ? '?year=' + currentTodoYear : ''));
  if (data.error) {
    view.innerHTML = emptyState({ icon: '✍️', title: 'Nie udało się wczytać listy', message: data.error });
    return;
  }

  const labels = data.labels || {};
  const filters = Object.entries(labels)
    .map(([key, label]) => ({ key, label, count: data.counts?.[key] || 0 }))
    .filter(f => f.count > 0);
  const items = (data.needs_attention || []).filter(item =>
    currentTodoFilter === 'all' || (item.missing_keys || []).includes(currentTodoFilter)
  );
  const yearLabel = currentTodoYear ? String(currentTodoYear) : 'Wszystkie';
  const years = collectTodoYears(data.needs_attention || []);

  let html = `<div class="page-header">
    <div>
      <button class="back-btn" onclick="showTab('stats')">‹ Statystyki</button>
      <div class="page-title">Do uzupełnienia</div>
    </div>
  </div>`;

  html += renderTodoControls({
    years,
    filters,
    totalItems: data.needs_attention?.length || 0,
    visibleItems: items.length,
  });

  html += `<div class="hero-card">
    <div class="hero-label">${escapeHtml(yearLabel)}</div>
    <div class="hero-numbers">
      <div class="hero-number"><div class="hero-val">${data.total || 0}</div><div class="hero-key">podróży w zakresie</div></div>
      <div class="hero-number"><div class="hero-val">${data.needs_attention?.length || 0}</div><div class="hero-key">wymaga uwagi</div></div>
      <div class="hero-number"><div class="hero-val">${items.length}</div><div class="hero-key">na tej liście</div></div>
      <div class="hero-number"><div class="hero-val">${filters.length}</div><div class="hero-key">typów braków</div></div>
    </div>
  </div>`;

  if (!items.length) {
    html += emptyState({
      icon: '✅',
      title: 'Nie ma nic do uzupełnienia',
      message: currentTodoFilter === 'all'
        ? 'W tym zakresie wszystkie podróże wyglądają kompletnie.'
        : 'Ten typ braku nie występuje w wybranym zakresie.',
    });
    view.innerHTML = html;
    return;
  }

  html += '<div class="card-list worklist-list">';
  html += items.map(todoWorklistCardHtml).join('');
  html += '</div>';
  view.innerHTML = html;
}

async function openTodoEdit(id) {
  const travel = await api('/api/travels/' + id);
  if (!travel || travel.error) {
    toast('Nie udało się wczytać podróży', 'error');
    return;
  }
  window._currentTravel = travel;
  openTravelModal(travel, false);
}

function collectTodoYears(items) {
  return [...new Set(items
    .map(item => item.start_date && String(item.start_date).slice(0, 4))
    .filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}
