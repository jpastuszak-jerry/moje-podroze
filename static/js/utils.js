const API = '';
let currentTab = 'travels';
let searchTimeout;
let currentSort = 'date_desc';
let currentSearch = '';

let allLocationsCache = [];

const MAP_TYPE_COLORS = {
  'miasto':'#e74c3c','wyspa':'#3498db','region':'#2ecc71',
  'kraj':'#9b59b6','wieś':'#e67e22','default':'#f39c12'
};

async function api(path) {
  try {
    const r = await fetch(API + path);
    return await r.json();
  } catch {
    console.error('Błąd sieci:', path);
    return [];
  }
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    try { return await r.json(); }
    catch { return { error: 'Błąd serwera: ' + r.status }; }
  }
  return r.json();
}

async function apiPut(path, body) {
  const r = await fetch(API + path, {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    try { return await r.json(); }
    catch { return { error: 'Błąd serwera: ' + r.status }; }
  }
  return r.json();
}

async function apiDelete(path) {
  const r = await fetch(API + path, { method: 'DELETE' });
  if (!r.ok) {
    try { return await r.json(); } catch { return { error: 'Błąd serwera: ' + r.status }; }
  }
  return {};
}

function parseDate(s) {
  if (!s) return null;
  const str = String(s);
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const rfc = str.match(/\w+,\s+(\d+)\s+(\w+)\s+(\d{4})/);
  if (rfc) return new Date(Number(rfc[3]), months[rfc[2]], Number(rfc[1]));
  return null;
}

function fmtDate(s) {
  const d = parseDate(s);
  if (!d) return '';
  return d.toLocaleDateString('pl-PL', {day:'numeric', month:'short', year:'numeric'});
}

function daysCount(s, e) {
  const start = parseDate(s); const end = parseDate(e);
  if (!start || !end) return 0;
  return Math.round((end - start) / 86400000);
}

function purposeIcon(p) {
  if (!p) return '✈️';
  const l = p.toLowerCase();
  if (l.includes('wakacje')) return '☀️';
  if (l.includes('służbow')) return '💼';
  if (l.includes('rodzin')) return '🏠';
  return '✈️';
}

function purposeColor(p) {
  if (!p) return 'badge-blue';
  const l = p.toLowerCase();
  if (l.includes('wakacje')) return 'badge-orange';
  if (l.includes('służbow')) return 'badge-blue';
  return 'badge-purple';
}

function purposeGradient(p) {
  if (!p) return 'linear-gradient(135deg,#475569,#1e293b)';
  const l = p.toLowerCase();
  if (l.includes('wakacje') || l.includes('urlop')) return 'linear-gradient(135deg,#f97316,#dc2626)';
  if (l.includes('służbow') || l.includes('biznes')) return 'linear-gradient(135deg,#1a6fdb,#1e3a8a)';
  if (l.includes('rodzin')) return 'linear-gradient(135deg,#059669,#065f46)';
  if (l.includes('kultu') || l.includes('zwiedza')) return 'linear-gradient(135deg,#7c3aed,#4c1d95)';
  return 'linear-gradient(135deg,#475569,#1e293b)';
}

function purposeIconBg(p) {
  if (!p) return 'var(--orange-light)';
  const l = p.toLowerCase();
  if (l.includes('wakacje') || l.includes('urlop')) return '#fff7ed';
  if (l.includes('służbow') || l.includes('biznes')) return '#eff6ff';
  if (l.includes('rodzin')) return '#f0fdf4';
  if (l.includes('kultu') || l.includes('zwiedza')) return '#f5f3ff';
  return 'var(--orange-light)';
}

function locationIcon(t) {
  const icons = {
    'miasto':'🏙️','wyspa':'🏝️','hotel':'🏨','apartament':'🏠',
    'restauracja':'🍽️','plaża':'🏖️','góra':'⛰️','muzeum':'🏛️',
    'park narodowy':'🌿','rezerwat przyrody':'🌿','rzeka':'🌊',
    'jezioro':'💧','świątynia':'⛩️','most':'🌉','granica':'🚧',
    'atrakcja turystyczna':'📍','dzielnica':'🏘️','winnica':'🍇',
    'park miejski':'🌳','plac':'🏟️','targ':'🛒','cmentarz':'⚰️',
  };
  return icons[t] || '📍';
}

function stars(r) {
  if (!r) return '';
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function initials(name) {
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ── Toasts / snackbars ──────────────────────────────────── */
const TOAST_ICONS = { success: '✓', error: '!', info: 'i' };

function toast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML =
    `<div class="toast-icon">${TOAST_ICONS[type] || ''}</div>` +
    `<div class="toast-msg">${escapeHtml(message)}</div>`;
  container.appendChild(el);
  const dismiss = () => {
    if (el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

/* ── Custom confirm dialog (Promise-based) ───────────────── */
function askConfirm({ title = '', message = '', confirmText = 'OK', cancelText = 'Anuluj', danger = false } = {}) {
  return new Promise(resolve => {
    document.getElementById('confirm-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.id = 'confirm-overlay';
    overlay.innerHTML = `<div class="confirm-sheet">
      <div class="confirm-handle"></div>
      ${title ? `<div class="confirm-title">${escapeHtml(title)}</div>` : ''}
      ${message ? `<div class="confirm-message">${escapeHtml(message)}</div>` : ''}
      <div class="confirm-actions">
        <button class="confirm-btn ${danger ? 'danger' : 'primary'}" data-act="ok">${escapeHtml(confirmText)}</button>
        <button class="confirm-btn cancel" data-act="cancel">${escapeHtml(cancelText)}</button>
      </div>
    </div>`;
    let settled = false;
    const close = (result) => {
      if (settled) return;
      settled = true;
      overlay.classList.add('leaving');
      setTimeout(() => { overlay.remove(); resolve(result); }, 200);
    };
    overlay.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (btn) close(btn.dataset.act === 'ok');
      else if (e.target === overlay) close(false);
    });
    document.body.appendChild(overlay);
  });
}

/* ── Skeleton placeholders ───────────────────────────────── */
function skeletonCards(count = 4) {
  const card = `
    <div class="skeleton-card">
      <div class="skeleton-block skeleton-icon"></div>
      <div class="skeleton-lines">
        <div class="skeleton-block skeleton-line w-60"></div>
        <div class="skeleton-block skeleton-line w-40"></div>
      </div>
    </div>`;
  return `<div style="padding:12px 16px">${card.repeat(count)}</div>`;
}

function parseCoord(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function findDuplicateLocation(allLocs, name, countryName, parentId) {
  if (!allLocs || !name || !countryName) return null;
  const n = name.trim().toLowerCase();
  const pid = parentId ? parseInt(parentId) : null;
  return allLocs.find(l =>
    (l.name || '').toLowerCase() === n
    && l.country_name === countryName
    && (l.parent_location_id || null) === pid
  ) || null;
}

function confirmDuplicateLocation(existing, countryName) {
  const where = [existing.location_type, countryName].filter(Boolean).join(', ');
  return askConfirm({
    title: 'Miejsce już istnieje',
    message: `"${existing.name}" (${where}) jest już w bazie.\nUtworzyć drugi rekord o tej samej nazwie?`,
    confirmText: 'Utwórz duplikat',
    danger: true,
  });
}

/* ── Modal motion helpers ─────────────────────────────────── */
function closeModal(overlay) {
  if (!overlay || overlay.classList.contains('leaving')) return;
  overlay.classList.add('leaving');
  setTimeout(() => overlay.remove(), 220);
}

function attachDragToDismiss(overlay, sheetSelector, onDismiss) {
  const handle = overlay.querySelector('.modal-handle, .wizard-handle');
  const sheet = overlay.querySelector(sheetSelector);
  if (!handle || !sheet) return;
  let startY = 0, currentY = 0, dragging = false;
  const threshold = 100;

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY = e.clientY;
    currentY = 0;
    sheet.classList.add('dragging');
    sheet.classList.remove('spring-back');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    currentY = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${currentY}px)`;
    overlay.style.background = `rgba(0,0,0,${Math.max(0.15, 0.5 - currentY / 800)})`;
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    if (currentY > threshold) {
      onDismiss();
    } else {
      sheet.classList.add('spring-back');
      sheet.style.transform = '';
      overlay.style.background = '';
      setTimeout(() => sheet.classList.remove('spring-back'), 260);
    }
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  if (tab === 'travels') renderTravels();
  else if (tab === 'locations') renderLocations();
  else if (tab === 'map') renderMap();
  else if (tab === 'stats') renderStats();
  else if (tab === 'timeline') renderTimeline();
  const view = document.getElementById('view');
  if (view) {
    view.classList.remove('view-fade');
    void view.offsetWidth;
    view.classList.add('view-fade');
  }
}
