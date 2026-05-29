const API = '';
let currentTab = 'travels';
let searchTimeout;
let currentSort = 'date_desc';
let currentSearch = '';
let currentTravelYear = null;

let allLocationsCache = [];

const MAP_TYPE_COLORS = {
  'miasto':'#e74c3c','wyspa':'#3498db','region':'#2ecc71',
  'kraj':'#9b59b6','wieś':'#e67e22','default':'#f39c12'
};

const HOME_COORDS = [53.1583, 18.0494];
const HOME_ZOOM = 7;

async function api(path) {
  try {
    const r = await fetch(API + path);
    const body = await r.json().catch(() => ({}));
    if (r.status === 503) {
      if (body && body.error === 'offline') {
        toast('Brak połączenia — danych nie ma w cache', 'error');
      }
      return Array.isArray(body) ? body : [];
    }
    if (!r.ok) {
      return body && !Array.isArray(body)
        ? { ...body, status: r.status }
        : { error: 'Błąd serwera: ' + r.status, status: r.status };
    }
    return body;
  } catch {
    console.error('Błąd sieci:', path);
    if (navigator.onLine) toast('Błąd sieci — spróbuj ponownie', 'error');
    return [];
  }
}

function isApiError(value) {
  return !!(value && !Array.isArray(value) && value.error);
}

function decorateApiError(body, status, fallback = 'Błąd serwera') {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return {
    ...payload,
    error: payload.error || `${fallback}: ${status}`,
    status,
  };
}

function apiErrorMessage(err, fallback = 'Nie udało się wykonać operacji') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const raw = String(err.error || '').trim();
  if (raw === 'offline') return 'Brak połączenia — spróbuj ponownie, gdy internet wróci.';
  if (raw === 'Not found' || err.status === 404) return 'Nie znaleziono rekordu albo został już usunięty.';
  if (raw) return raw;
  if (err.status) return `${fallback} (HTTP ${err.status})`;
  return fallback;
}

function toastApiError(err, fallback) {
  toast(apiErrorMessage(err, fallback), 'error');
}

const UI_ACTION_LOCKS = new Set();

async function withActionLock(key, action) {
  if (UI_ACTION_LOCKS.has(key)) return null;
  UI_ACTION_LOCKS.add(key);
  try {
    return await action();
  } finally {
    UI_ACTION_LOCKS.delete(key);
  }
}

function beginOverlayOpen(id) {
  const key = `overlay-open:${id}`;
  if (document.getElementById(id) || UI_ACTION_LOCKS.has(key)) return false;
  UI_ACTION_LOCKS.add(key);
  return true;
}

function finishOverlayOpen(id) {
  UI_ACTION_LOCKS.delete(`overlay-open:${id}`);
}

async function _mutationFetch(path, opts) {
  let r;
  try {
    r = await fetch(API + path, opts);
  } catch {
    return { error: 'offline' };
  }
  if (r.status === 503) {
    const body = await r.json().catch(() => ({ error: 'offline' }));
    return body;
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return decorateApiError(body, r.status);
  }
  return r.json().catch(() => ({}));
}

async function apiPost(path, body) {
  return _mutationFetch(path, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
}

async function apiPut(path, body) {
  return _mutationFetch(path, {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
}

async function apiDelete(path) {
  let r;
  try {
    r = await fetch(API + path, { method: 'DELETE' });
  } catch {
    return { error: 'offline' };
  }
  if (r.status === 503) {
    const body = await r.json().catch(() => ({ error: 'offline' }));
    return body;
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return decorateApiError(body, r.status);
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
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
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
  const n = parseFloat(r);
  if (!Number.isFinite(n)) return '';
  const rating = Math.max(0, Math.min(5, Math.round(n * 2) / 2));
  const label = `Ocena ${n.toLocaleString('pl-PL')} na 5`;
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, rating - i));
    const cls = fill >= 1 ? 'star-full' : fill >= 0.5 ? 'star-half' : 'star-empty';
    slots.push(
      `<span class="star-slot ${cls}" aria-hidden="true">` +
      '<span class="star-base">★</span><span class="star-fill">★</span>' +
      '</span>'
    );
  }
  return `<span class="stars" role="img" aria-label="${label}">${slots.join('')}</span>`;
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

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsStringArg(text) {
  return escapeAttr(String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\x3C'));
}

/* iOS Safari sometimes reports stale input.value when the user taps a button
 * while autocaps/spellcheck/autocomplete is still finalising. Forcing blur and
 * yielding to the next frame reliably gets the committed value. */
async function readInputValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (document.activeElement === el) {
    el.blur();
    await new Promise(r => requestAnimationFrame(r));
  }
  return (el.value || '').trim();
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

function clipVisitDatesToTravelRange(arrival, departure, travelStart, travelEnd) {
  const clipOne = (value) => {
    if (!value) return null;
    if (value < travelStart) return travelStart;
    if (value > travelEnd) return travelEnd;
    return value;
  };
  let nextArrival = clipOne(arrival);
  let nextDeparture = clipOne(departure);
  if (nextArrival && nextDeparture && nextDeparture < nextArrival) {
    nextArrival = travelStart;
    nextDeparture = travelEnd;
  }
  return { arrival: nextArrival, departure: nextDeparture };
}

function askVisitDateRangeAction({ travelStart, travelEnd } = {}) {
  return new Promise(resolve => {
    document.getElementById('visit-range-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'visit-range-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>
      <div class="modal-header"><span class="modal-title">⚠️ Daty poza zakresem</span></div>
      <div class="form-section">
        <div class="travel-conflict-copy">
          Daty wizyty są poza zakresem podróży (${escapeHtml(travelStart || '?')} – ${escapeHtml(travelEnd || '?')}).
        </div>
        <div class="form-action-stack">
          <button class="form-primary-btn" data-choice="clip">Przytnij do zakresu podróży</button>
          <button class="form-secondary-btn" data-choice="ignore">Zapisz mimo to</button>
          <button class="form-tertiary-btn" data-choice="cancel">Anuluj</button>
        </div>
      </div></div>`;
    let settled = false;
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      closeModal(overlay);
      resolve(choice === 'cancel' ? null : choice);
    };
    overlay.addEventListener('click', e => {
      const btn = e.target.closest('[data-choice]');
      if (btn) finish(btn.dataset.choice);
      else if (e.target === overlay) finish(null);
    });
    document.body.appendChild(overlay);
    attachDragToDismiss(overlay, '.modal', () => finish(null));
  });
}

/* ── Location form (shared between locations.js + wizard.js) ─ */
function locationFormHtml({ prefix, countries, locTypes, parentChangeHandler, includeNotes = true, saveBtnId, saveBtnOnclick, saveBtnLabel }) {
  return `
    <div class="form-label">Nazwa miejsca *</div>
    <input class="form-input" id="${prefix}-name" placeholder="np. Catania">
    <div class="form-row">
      <div><div class="form-label">Kraj *</div>
        <select class="form-input" id="${prefix}-country" onchange="${parentChangeHandler}">
          ${renderSelectOptions(countries, '', { emptyOption: '– wybierz –', valueKey: 'id', labelKey: 'name' })}
        </select></div>
      <div><div class="form-label">Typ miejsca *</div>
        <select class="form-input" id="${prefix}-type">
          ${renderSelectOptions(locTypes, '', { emptyOption: '– wybierz –', valueKey: 'id', labelKey: 'name' })}
        </select></div>
    </div>
    <div class="form-label">Miejsce nadrzędne (opcjonalnie)</div>
    <select class="form-input" id="${prefix}-parent"><option value="">– brak –</option></select>
    <div class="form-label">Adres (opcjonalnie)</div>
    <input class="form-input" id="${prefix}-address" placeholder="np. centrum">
    <div class="form-label">GPS (opcjonalnie)</div>
    <div class="form-inline-row">
      <input class="form-input" id="${prefix}-lat" placeholder="Szer. np. 37.50745">
      <input class="form-input" id="${prefix}-lng" placeholder="Dług. np. 15.08720">
      <button class="form-icon-btn" id="${prefix}-geocode-btn" onclick="geocodeForLocModal('${prefix}')">🔍</button>
    </div>
    <div class="form-results" id="${prefix}-geo-results"></div>
    ${includeNotes ? `<div class="form-label">Notatki (opcjonalnie)</div>
      <textarea class="form-input form-textarea" id="${prefix}-notes" placeholder="Dodatkowe informacje..."></textarea>` : ''}
    <button class="form-primary-btn" id="${saveBtnId}" onclick="${saveBtnOnclick}">
      ${escapeHtml(saveBtnLabel)}
    </button>
  `;
}

/* ── Theme toggle ────────────────────────────────────────── */
const THEME_ICONS = {
  sun:  '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zM4.22 4.22a1 1 0 0 1 1.42 0l1.4 1.4a1 1 0 0 1-1.4 1.42l-1.42-1.4a1 1 0 0 1 0-1.42zm12.72 12.72a1 1 0 0 1 1.42 0l1.4 1.4a1 1 0 1 1-1.4 1.42l-1.42-1.4a1 1 0 0 1 0-1.42zM2 12a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1zm17 0a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zM4.22 19.78a1 1 0 0 1 0-1.42l1.4-1.4a1 1 0 0 1 1.42 1.4l-1.4 1.42a1 1 0 0 1-1.42 0zm12.72-12.72a1 1 0 0 1 0-1.42l1.4-1.4a1 1 0 1 1 1.42 1.4l-1.4 1.42a1 1 0 0 1-1.42 0z"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>',
};
function getActiveTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setThemeIcon() {
  const theme = getActiveTheme();
  const icon = document.getElementById('theme-icon');
  if (icon) icon.innerHTML = theme === 'dark' ? THEME_ICONS.sun : THEME_ICONS.moon;
  const label = document.getElementById('theme-menu-label');
  if (label) label.textContent = theme === 'dark' ? 'Ciemny' : 'Jasny';
}
function toggleTheme() {
  const next = getActiveTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.setAttribute('data-theme', next);
  setThemeIcon();
}

function setAppMenuOpen(open) {
  const menu = document.getElementById('app-menu');
  if (!menu) return;
  menu.classList.toggle('open', Boolean(open));
  const button = document.getElementById('app-menu-button');
  if (button && typeof button.setAttribute === 'function') {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

function closeAppMenu() {
  setAppMenuOpen(false);
}

function toggleAppMenu(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  const menu = document.getElementById('app-menu');
  if (!menu) return;
  setAppMenuOpen(!menu.classList.contains('open'));
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', event => {
    const menu = document.getElementById('app-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (typeof menu.contains === 'function' && event.target && menu.contains(event.target)) return;
    closeAppMenu();
  });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAppMenu();
  });
}

/* ── Empty state ─────────────────────────────────────────── */
function emptyState({ icon = '✨', title = 'Brak danych', message = '', ctaLabel = '', ctaOnclick = '' } = {}) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-title">${escapeHtml(title)}</div>
    ${message ? `<div class="empty-state-msg">${escapeHtml(message)}</div>` : ''}
    ${ctaLabel ? `<button class="empty-state-cta" onclick="${ctaOnclick}">${escapeHtml(ctaLabel)}</button>` : ''}
  </div>`;
}

/* ── Card list slide-out helper ───────────────────────────── */
function removeWithSlide(el, after) {
  if (!el || el.dataset.removing === '1') return false;
  el.dataset.removing = '1';
  const finish = () => {
    if (el.dataset.removed === '1') return;
    el.dataset.removed = '1';
    el.remove();
    if (after) after();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return true;
  }
  el.classList.add('card-leaving');
  setTimeout(finish, 240);
  return true;
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

/* ── Offline banner (Etap 3 PWA) ──────────────────────────── */
const _IDB_NAME = 'travel-mirror';
const _IDB_VERSION = 1;
const _IDB_STORE = 'responses';

function _idbOpenPage() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(_IDB_STORE)) {
        db.createObjectStore(_IDB_STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbLastSync() {
  try {
    const db = await _idbOpenPage();
    return await new Promise((resolve) => {
      const tx = db.transaction(_IDB_STORE, 'readonly');
      const store = tx.objectStore(_IDB_STORE);
      let latest = 0;
      store.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          if (c.value.savedAt > latest) latest = c.value.savedAt;
          c.continue();
        } else {
          db.close();
          resolve(latest);
        }
      };
      tx.onerror = () => { db.close(); resolve(0); };
    });
  } catch {
    return 0;
  }
}

function _fmtSyncTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString('pl-PL', opts);
}

async function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  if (navigator.onLine) {
    banner.classList.remove('visible');
    document.body.classList.remove('offline-mode');
    return;
  }
  banner.classList.add('visible');
  document.body.classList.add('offline-mode');
  const sync = document.getElementById('offline-banner-sync');
  const ts = await _idbLastSync();
  if (sync) sync.textContent = ts ? ` — dane z ${_fmtSyncTime(ts)}` : '';
}

window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);

function setMapViewMode(enabled) {
  const view = document.getElementById('view');
  if (!view) return null;
  view.classList.toggle('map-view-mode', Boolean(enabled));
  return view;
}

function resetViewScroll(view = document.getElementById('view')) {
  if (!view) return;
  view.scrollTop = 0;
  view.scrollLeft = 0;
  if (typeof view.scrollTo === 'function') {
    view.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

function worklistCountLabel(count) {
  count = Number(count || 0);
  if (count === 1) return 'pozycja';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'pozycje';
  return 'pozycji';
}

function showTab(tab) {
  closeAppMenu();
  currentTab = tab;
  const view = setMapViewMode(tab === 'map');
  resetViewScroll(view);
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tabButton = document.getElementById('tab-'+tab);
  if (tabButton) tabButton.classList.add('active');
  if (tab === 'travels') renderTravels();
  else if (tab === 'locations') renderLocations();
  else if (tab === 'map') renderMap();
  else if (tab === 'stats') renderStats();
  else if (tab === 'todo') renderTodo();
  else if (tab === 'locationTodo') renderLocationTodo();
  if (view) {
    resetViewScroll(view);
    view.classList.remove('view-fade');
    void view.offsetWidth;
    view.classList.add('view-fade');
  }
}
