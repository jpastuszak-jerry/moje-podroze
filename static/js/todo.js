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
  const labels = [];
  if (currentTodoYear) labels.push(String(currentTodoYear));
  const activeFilter = filters.find(f => f.key === currentTodoFilter);
  if (activeFilter) labels.push(activeFilter.label);
  return renderFilterPanel({
    controls: [
      {
        label: 'Rok',
        id: 'todo-year-select',
        onchange: 'setTodoYear(this.value ? parseInt(this.value, 10) : null)',
        options: years,
        selectedValue: currentTodoYear,
        emptyOption: 'Wszystkie lata',
      },
      {
        label: 'Typ braku',
        id: 'todo-filter-select',
        onchange: 'setTodoFilter(this.value)',
        options: filters,
        selectedValue: currentTodoFilter,
        valueKey: 'key',
        emptyOption: { key: 'all', label: 'Wszystkie braki' },
      },
    ],
    summary: {
      count: visibleItems,
      countLabel: worklistCountLabel(visibleItems),
      detail: labels.length ? labels : `${totalItems} podróży wymaga uwagi`,
      resetOnclick: labels.length ? 'resetTodoControls()' : '',
    },
  });
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
        <div class="card-meta">${renderBadges(item.missing || [], { tone: 'orange' })}</div>
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
    ${renderHeroMetrics([
      { value: data.total || 0, label: 'podróży w zakresie' },
      { value: data.needs_attention?.length || 0, label: 'wymaga uwagi' },
      { value: items.length, label: 'na tej liście' },
      { value: filters.length, label: 'typów braków' },
    ])}
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

  html += renderCardList(items, todoWorklistCardHtml, { className: 'card-list worklist-list' });
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
