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

  html += `<div class="sort-bar">
    <button class="sort-btn${!currentTodoYear ? ' active' : ''}" onclick="setTodoYear(null)">Wszystkie</button>
    ${years.map(y => `<button class="sort-btn${String(currentTodoYear) === String(y) ? ' active' : ''}" onclick="setTodoYear(${y})">${y}</button>`).join('')}
  </div>`;

  html += `<div class="sort-bar">
    <button class="sort-btn${currentTodoFilter === 'all' ? ' active' : ''}" onclick="setTodoFilter('all')">Wszystkie (${data.needs_attention?.length || 0})</button>
    ${filters.map(f => `<button class="sort-btn${currentTodoFilter === f.key ? ' active' : ''}" onclick="setTodoFilter('${f.key}')">${escapeHtml(f.label)} (${f.count})</button>`).join('')}
  </div>`;

  html += `<div class="hero-card" style="margin-top:10px">
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

  html += '<div class="card-list" style="padding:12px 16px 24px">';
  html += items.map(item => `
    <div class="card" onclick="openTravel(${item.id})">
      <div class="card-inner">
        <div class="card-icon" style="background:var(--orange-light);color:var(--orange)">✍️</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(item.name || '(bez nazwy)')}</div>
          <div class="card-subtitle">${fmtDate(item.start_date)} · ${item.missing_count} ${item.missing_count === 1 ? 'brak' : 'braki'}</div>
          <div class="card-meta">
            ${(item.missing || []).map(label => `<span class="badge badge-orange">${escapeHtml(label)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('');
  html += '</div>';
  view.innerHTML = html;
}

function collectTodoYears(items) {
  return [...new Set(items
    .map(item => item.start_date && String(item.start_date).slice(0, 4))
    .filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}
