import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appCssPath = path.join(repoRoot, 'static', 'css', 'app.css');
const utilsPath = path.join(repoRoot, 'static', 'js', 'utils.js');
const componentsPath = path.join(repoRoot, 'static', 'js', 'components.js');
const dictionariesPath = path.join(repoRoot, 'static', 'js', 'dictionaries.js');
const personsPath = path.join(repoRoot, 'static', 'js', 'persons.js');
const locationsPath = path.join(repoRoot, 'static', 'js', 'locations.js');
const mapPath = path.join(repoRoot, 'static', 'js', 'map.js');
const travelsPath = path.join(repoRoot, 'static', 'js', 'travels.js');
const todoPath = path.join(repoRoot, 'static', 'js', 'todo.js');
const statsPath = path.join(repoRoot, 'static', 'js', 'stats.js');
const statsYearbookPath = path.join(repoRoot, 'static', 'js', 'stats_yearbook.js');
const swPath = path.join(repoRoot, 'static', 'sw.js');
const wizardPath = path.join(repoRoot, 'static', 'js', 'wizard.js');

function classListStub(initial = []) {
  const classes = new Set(initial);
  return {
    add(...names) { names.forEach(name => classes.add(name)); },
    remove(...names) { names.forEach(name => classes.delete(name)); },
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
      if (shouldAdd) classes.add(name);
      else classes.delete(name);
      return shouldAdd;
    },
    toString() { return [...classes].join(' '); },
  };
}

function elementStub() {
  let textContent = '';
  const el = {
    dataset: {},
    classList: classListStub(),
    style: {},
    innerHTML: '',
    get textContent() {
      return textContent;
    },
    set textContent(value) {
      textContent = String(value ?? '');
      this.innerHTML = textContent.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    },
    removed: false,
    remove() { this.removed = true; },
    addEventListener() {},
    appendChild() {},
    attributes: {},
    contains(node) { return node === this; },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return el;
}

function mountAwareElementStub(onInnerHTML) {
  const el = elementStub();
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(value) {
      html = String(value ?? '');
      if (onInnerHTML) onInnerHTML(html);
    },
  });
  return el;
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  navigator: { onLine: true },
  localStorage: {
    getItem() { return null; },
    setItem() {},
  },
  matchMedia() { return { matches: false }; },
  indexedDB: {
    open() { throw new Error('IndexedDB is not available in smoke tests'); },
  },
  window: {
    addEventListener() {},
  },
  document: {
    body: {
      appendChild() {},
      classList: classListStub(),
    },
    documentElement: {
      setAttribute() {},
    },
    createElement() {
      const el = elementStub();
      el.textContent = '';
      el.innerHTML = '';
      return el;
    },
    getElementById() { return null; },
    querySelectorAll() { return []; },
  },
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(utilsPath, 'utf8'), context, { filename: utilsPath });
vm.runInContext(fs.readFileSync(componentsPath, 'utf8'), context, { filename: componentsPath });

function count(haystack, needle) {
  return (haystack.match(new RegExp(needle, 'g')) || []).length;
}

const appCssSource = fs.readFileSync(appCssPath, 'utf8');
const locationsSource = fs.readFileSync(locationsPath, 'utf8');
const mapSource = fs.readFileSync(mapPath, 'utf8');
const wizardSource = fs.readFileSync(wizardPath, 'utf8');
assert.match(appCssSource, /#view\.map-view-mode\s*\{\s*overflow:\s*hidden;/, 'mobile map view disables page scroll');
assert.match(appCssSource, /\.map-screen-shell[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/, 'map screen uses a dedicated flex shell');
assert.match(appCssSource, /\.app-menu\s*\{[\s\S]*position:\s*fixed[\s\S]*top:\s*calc\(env\(safe-area-inset-top/, 'mobile app menu respects the iPhone safe area');
assert.match(appCssSource, /@media\s*\(min-width:\s*900px\)[\s\S]*\.app-menu[\s\S]*bottom:\s*calc\(env\(safe-area-inset-bottom/, 'desktop app menu moves into the sidebar');
assert.match(appCssSource, /@media\s*\(max-width:\s*600px\)[\s\S]*body\.auth-page[\s\S]*place-items:\s*start center/, 'mobile login starts above the iOS keyboard accessory area');
assert.match(appCssSource, /\.modal\s*\{[\s\S]*scroll-padding-bottom:\s*calc\(170px \+ var\(--safe-bottom\)\)/, 'modal forms keep focused fields above the iOS keyboard accessory area');
assert.match(appCssSource, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)\s*34px\s*34px/, 'mobile map toolbar keeps filters and buttons in a fixed grid');
assert.match(appCssSource, /\.yearbook-trip-name\s*\{[\s\S]*min-width:\s*0[\s\S]*overflow-wrap:\s*anywhere/, 'yearbook trip names can wrap instead of overflowing');
assert.match(appCssSource, /\.yearbook-story\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\)/, 'yearbook has a structured annual story layout');
assert.match(appCssSource, /\.yearbook-month-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(12/, 'yearbook month rhythm uses a stable 12-column grid');
assert.match(appCssSource, /@media\s*\(max-width:\s*620px\)[\s\S]*\.yearbook-trip\s*\{[\s\S]*flex-direction:\s*column/, 'mobile yearbook trips stack long names and metadata');
assert.match(appCssSource, /\.location-passport\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/, 'location detail has a structured passport layout');
assert.match(locationsSource, /const LOCATION_COLLATOR[\s\S]*new Intl\.Collator\('pl', \{ sensitivity: 'base' \}\)/, 'location sorting reuses one Polish collator');
assert.match(locationsSource, /function compareLocName\(a, b\)\s*\{\s*return compareLocationText\(a\.name, b\.name\);\s*\}/, 'location name sorting uses the shared text comparator');
assert.match(locationsSource, /\.sort\(compareLocationText\)/, 'location filter options use the shared text comparator');
assert.match(locationsSource, /function compareLocationTodoText\(a, b\)\s*\{\s*return compareLocationText\(a, b\);\s*\}/, 'location worklist reuses the main text comparator');
assert.match(locationsSource, /function filterLocPicker\(q\)[\s\S]*const query = String\(q \|\| ''\)\.trim\(\)\.toLowerCase\(\)/, 'location picker normalizes search text once');
assert.match(mapSource, /function buildMapMarkerCache\(locations\)[\s\S]*allMapMarkers = \(locations \|\| \[\]\)\.map\(createMapMarker\)/, 'map markers are cached after loading data');
assert.match(mapSource, /if \(markerClusterGroup\.addLayers\) markerClusterGroup\.addLayers\(markers\)/, 'map marker rendering can add cached markers in batch');
assert.match(wizardSource, /function wizardFilterPicker\(q\)[\s\S]*const query = String\(q \|\| ''\)\.trim\(\)\.toLowerCase\(\)/, 'wizard picker normalizes search text once');

const originalGetElementById = context.document.getElementById;
const originalLocalStorageGetItem = context.localStorage.getItem;
const appMenu = elementStub();
const appMenuButton = elementStub();
const themeIcon = elementStub();
const themeLabel = elementStub();
context.document.getElementById = id => ({
  'app-menu': appMenu,
  'app-menu-button': appMenuButton,
  'theme-icon': themeIcon,
  'theme-menu-label': themeLabel,
}[id] || null);
context.localStorage.getItem = () => 'dark';
context.setThemeIcon();
assert.equal(themeLabel.textContent, 'Ciemny', 'theme menu label follows the active theme');
assert.match(themeIcon.innerHTML, /M12 7a5/, 'theme menu icon renders the alternate theme action');
context.setAppMenuOpen(true);
assert.equal(appMenu.classList.contains('open'), true, 'app menu can be opened programmatically');
assert.equal(appMenuButton.getAttribute('aria-expanded'), 'true', 'app menu exposes expanded state');
context.toggleAppMenu({ stopPropagation() {} });
assert.equal(appMenu.classList.contains('open'), false, 'app menu button toggles the menu closed');
context.document.getElementById = originalGetElementById;
context.localStorage.getItem = originalLocalStorageGetItem;

assert.equal(context.daysCount('2025-07-11', '2025-07-12'), 2, 'travel days are inclusive');
assert.equal(context.daysCount('2025-07-11', '2025-07-11'), 1, 'same-day trip is one day');
assert.equal(context.daysCount('2025-07-12', '2025-07-11'), 0, 'negative ranges are clamped to zero');

const fourAndHalfStars = context.stars(4.5);
assert.equal(count(fourAndHalfStars, 'star-full'), 4, '4.5 rating has four full stars');
assert.equal(count(fourAndHalfStars, 'star-half'), 1, '4.5 rating has one half star');
assert.equal(count(context.stars(5), 'star-empty'), 0, '5.0 rating has no empty stars');

assert.equal(context.decorateApiError({}, 409).status, 409, 'API errors keep HTTP status');
assert.equal(context.apiErrorMessage({ error: 'Not found', status: 404 }).includes('Not found'), false);
assert.equal(context.apiErrorMessage({ error: 'offline' }).startsWith('Brak'), true);

let actionCalls = 0;
const lockedAction = () => context.withActionLock('same-record', async () => {
  actionCalls += 1;
  await new Promise(resolve => setTimeout(resolve, 10));
  return 'done';
});
const actionResults = await Promise.all([lockedAction(), lockedAction(), lockedAction()]);
assert.equal(actionCalls, 1, 'concurrent duplicate actions run only once');
assert.equal(actionResults.filter(Boolean).length, 1, 'only one duplicate action returns a result');
assert.equal(context.beginOverlayOpen('same-modal'), true, 'modal opening can acquire a lock');
assert.equal(context.beginOverlayOpen('same-modal'), false, 'modal opening lock blocks duplicate sheets');
context.finishOverlayOpen('same-modal');
assert.equal(context.beginOverlayOpen('same-modal'), true, 'modal opening lock releases after render');
context.finishOverlayOpen('same-modal');

context.matchMedia = () => ({ matches: true });
const row = elementStub();
let afterCalls = 0;
assert.equal(context.removeWithSlide(row, () => { afterCalls += 1; }), true);
assert.equal(context.removeWithSlide(row, () => { afterCalls += 1; }), false);
assert.equal(afterCalls, 1, 'removeWithSlide callback is idempotent');
assert.equal(row.removed, true);

const clippedVisit = context.clipVisitDatesToTravelRange('2025-07-10', '2025-07-15', '2025-07-11', '2025-07-12');
assert.equal(clippedVisit.arrival, '2025-07-11');
assert.equal(clippedVisit.departure, '2025-07-12');

const tabsHtml = context.renderTabs(
  [{ id: 'first', label: 'Pierwsza' }, { id: 'second', label: 'Druga' }],
  'second',
  { containerClass: 'test-tabs', buttonClass: 'test-tab', ariaLabel: 'Test', onClick: item => `choose('${item.id}')` },
);
assert.match(tabsHtml, /test-tabs/, 'renderTabs keeps custom container class');
assert.match(tabsHtml, /aria-selected="true"[\s\S]*Druga/, 'renderTabs marks active tab');

const emptyCardHtml = context.renderEmptyCard('Brak danych', 'Nie ma nic do pokazania', {
  className: 'chart-card test-empty',
  messageClass: 'test-empty-text',
});
assert.match(emptyCardHtml, /test-empty-text/, 'renderEmptyCard keeps custom message class');
assert.match(emptyCardHtml, /Nie ma nic do pokazania/, 'renderEmptyCard renders message');

const sectionCardHtml = context.renderSectionCard({
  title: 'Sekcja',
  className: 'chart-card test-section',
  actionsHtml: '<button>Akcja</button>',
  headerClass: 'section-header test-header',
  body: '<p>Treść</p>',
});
assert.match(sectionCardHtml, /test-section/, 'renderSectionCard keeps custom card class');
assert.match(sectionCardHtml, /test-header/, 'renderSectionCard renders action header');
assert.match(sectionCardHtml, /<p>Treść<\/p>/, 'renderSectionCard keeps trusted body HTML');

const rankingHtml = context.renderRankingBars(
  [{ name: 'Ala', score: 10 }, { name: 'Ola', score: 5 }],
  { nameKey: 'name', valueKey: 'score', color: 'red' },
);
assert.match(rankingHtml, /gbar-row/, 'renderRankingBars renders rows');
assert.match(rankingHtml, /width:100%/, 'renderRankingBars scales top value to full width');

const selectOptionsHtml = context.renderSelectOptions(
  [{ key: 'all', label: 'All' }, { key: 'gps', label: 'GPS', count: 2 }],
  'gps',
  { valueKey: 'key' },
);
assert.match(selectOptionsHtml, /value="gps" selected/, 'renderSelectOptions marks selected object option');
assert.match(selectOptionsHtml, /GPS \(2\)/, 'renderSelectOptions renders option counts');
const unsafeSelectHtml = context.renderSelectOptions(
  [{ id: '1" autofocus', name: '<img src=x onerror=alert(1)>' }],
  '',
  { valueKey: 'id', labelKey: 'name' },
);
assert.match(unsafeSelectHtml, /value="1&quot; autofocus"/, 'renderSelectOptions escapes option values');
assert.match(unsafeSelectHtml, /&lt;img src=x onerror=alert\(1\)&gt;/, 'renderSelectOptions escapes option labels');

const locationFormUnsafeHtml = context.locationFormHtml({
  prefix: 'xss',
  countries: [{ id: '7" selected', name: '<b>Country</b>' }],
  locTypes: [{ id: 2, name: '<script>Type</script>' }],
  parentChangeHandler: 'noop()',
  saveBtnId: 'save-xss',
  saveBtnOnclick: 'saveXss()',
  saveBtnLabel: 'Zapisz',
});
assert.doesNotMatch(locationFormUnsafeHtml, /<b>Country<\/b>/, 'location form escapes country option HTML');
assert.doesNotMatch(locationFormUnsafeHtml, /<script>Type<\/script>/, 'location form escapes type option HTML');
assert.match(locationFormUnsafeHtml, /value="7&quot; selected"/, 'location form escapes option attributes');

const filterPanelHtml = context.renderFilterPanel({
  controls: [{
    label: 'Kind',
    id: 'kind-select',
    onchange: 'setKind(this.value)',
    options: ['A', 'B'],
    selectedValue: 'B',
  }],
  summary: {
    count: 0,
    countLabel: 'items',
    detail: 'No active filters',
    resetOnclick: 'resetFilters()',
  },
});
assert.match(filterPanelHtml, /aux-filter-panel/, 'renderFilterPanel renders shared filter shell');
assert.match(filterPanelHtml, /0 items/, 'renderFilterSummary keeps zero counts visible');
assert.match(filterPanelHtml, /resetFilters\(\)/, 'renderFilterSummary keeps reset action');

const badgesHtml = context.renderBadges([
  { label: 'Trip', tone: 'green' },
  { html: '<strong>5</strong>', tone: 'orange' },
]);
assert.match(badgesHtml, /badge-green/, 'renderBadges supports per-item tones');
assert.match(badgesHtml, /<strong>5<\/strong>/, 'renderBadges can render trusted HTML content');

const heroMetricsHtml = context.renderHeroMetrics([
  { value: 0, label: 'zero value' },
  { valueHtml: '<span>42</span>', label: 'raw value', extraHtml: '<em>delta</em>' },
]);
assert.match(heroMetricsHtml, /<div class="hero-val">0<\/div>/, 'renderHeroMetrics renders zero values');
assert.match(heroMetricsHtml, /<em>delta<\/em>/, 'renderHeroMetrics keeps trusted extra HTML');

const metricGridHtml = context.renderMetricGrid([
  { label: 'Days', value: 4 },
  { label: 'Rating', valueHtml: '<strong>5</strong>', className: 'rating' },
], {
  className: 'test-metrics',
  itemClass: 'test-metric',
  valueClass: 'test-value',
  labelClass: 'test-label',
  labelFirst: true,
});
assert.match(metricGridHtml, /test-metrics/, 'renderMetricGrid keeps custom grid class');
assert.match(metricGridHtml, /test-metric rating/, 'renderMetricItem keeps per-metric classes');
assert.match(metricGridHtml, /<strong>5<\/strong>/, 'renderMetricItem keeps trusted value HTML');

const statCardHtml = context.renderStatSummaryCard({
  tone: 'green',
  icon: 'i',
  value: 12,
  label: 'Wynik',
  extraHtml: '<em>+2</em>',
});
assert.match(statCardHtml, /stat-card sc-green/, 'renderStatSummaryCard keeps tone classes');
assert.match(statCardHtml, /<em>\+2<\/em>/, 'renderStatSummaryCard keeps trusted extra HTML');

const contextCardHtml = context.renderContextCard({
  icon: 'i',
  label: 'Aktualnie',
  value: 'Podróż',
  sub: 'dzień 2',
  onclick: 'openTravel(1)',
});
assert.match(contextCardHtml, /<button type="button"/, 'renderContextCard uses buttons for clickable cards');
assert.match(contextCardHtml, /context-clickable/, 'renderContextCard marks clickable cards');
assert.match(contextCardHtml, /openTravel\(1\)/, 'renderContextCard keeps click action');

const entityCardHtml = context.renderEntityCard({
  className: 'card completed',
  onclick: 'openItem(1)',
  icon: 'i',
  iconStyle: 'background:red',
  titleHtml: 'Item <strong>done</strong>',
  subtitles: ['subtitle > detail', { html: '<em>trusted</em>' }],
  metaHtml: '<div class="card-meta">meta</div>',
  trailingHtml: '<div class="card-chevron">›</div>',
});
assert.match(entityCardHtml, /card completed/, 'renderEntityCard keeps card classes');
assert.match(entityCardHtml, /openItem\(1\)/, 'renderEntityCard keeps click action');
assert.match(entityCardHtml, /Item <strong>done<\/strong>/, 'renderEntityCard supports trusted title HTML');
assert.match(entityCardHtml, /&gt;/, 'renderEntityCard escapes plain subtitles');
assert.match(entityCardHtml, /<em>trusted<\/em>/, 'renderEntityCard supports trusted subtitle HTML');
assert.match(entityCardHtml, /card-chevron/, 'renderEntityCard keeps trailing content');

const worklistCardHtml = context.renderWorklistCard({
  onclick: 'openTravel(2)',
  icon: '!',
  iconClass: 'card-icon worklist-icon warn',
  title: 'Do poprawy',
  editOnclick: 'openTodoEdit(2)',
  subtitle: '2 braki',
  badges: ['Bez oceny'],
  actionsHtml: '<div class="worklist-card-actions"><button type="button">GPS</button></div>',
});
assert.match(worklistCardHtml, /worklist-card-title-row/, 'renderWorklistCard renders title action row');
assert.match(worklistCardHtml, /openTodoEdit\(2\)/, 'renderWorklistCard keeps edit action');
assert.match(worklistCardHtml, /badge-orange/, 'renderWorklistCard renders missing-data badges');
assert.match(worklistCardHtml, /worklist-card-actions/, 'renderWorklistCard can render quick actions');

const pickerRowHtml = context.renderPickerRow({
  onclick: 'pick(1)',
  iconHtml: '<span>A</span>',
  title: 'Anna <Nowak>',
  subtitle: 'Rodzina',
});
assert.match(pickerRowHtml, /person-row/, 'renderPickerRow uses shared picker row class');
assert.match(pickerRowHtml, /pick\(1\)/, 'renderPickerRow keeps click action');
assert.match(pickerRowHtml, /Anna &lt;Nowak&gt;/, 'renderPickerRow escapes plain titles');
assert.match(pickerRowHtml, /modal-row-sub/, 'renderPickerRow renders subtitles');
assert.match(context.renderPickerRow({
  id: 'row-1',
  title: 'Row',
  plusHtml: '',
  actionsHtml: '<button>Go</button>',
}), /<button>Go<\/button>/, 'renderPickerRow can render action buttons');
assert.match(context.renderPickerRow({
  title: 'Styled',
  plusClass: 'custom-plus',
}), /custom-plus/, 'renderPickerRow keeps custom plus class');

const cardListHtml = context.renderCardList([{ id: 1 }, { id: 2 }], item => `<article>${item.id}</article>`, {
  className: 'card-list test-list',
});
assert.match(cardListHtml, /test-list/, 'renderCardList keeps custom list class');
assert.equal(count(cardListHtml, '<article>'), 2, 'renderCardList renders each item');

assert.deepEqual(
  JSON.parse(JSON.stringify(context.routeFromHash('#/travels/42'))),
  { name: 'travelDetail', params: { id: 42 } },
  'router parses travel detail hashes',
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.routeFromHash('#/locations/todo'))),
  { name: 'locationTodo', params: {} },
  'router parses auxiliary location todo hashes',
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.routeFromHash('#/locations/todo?missing=missing_gps&sort=visit_count_asc'))),
  { name: 'locationTodo', params: { missing: 'missing_gps', sort: 'visit_count_asc' } },
  'router keeps location todo filter params from hashes',
);
assert.equal(context.routePath('travelDetail', { id: 42 }), '/travels/42', 'router builds travel detail paths');
assert.equal(context.routePath('locationDetail', { id: 17 }), '/locations/17', 'router builds location detail paths');
assert.equal(context.routePath('todo'), '/stats/todo', 'router builds stats todo path');

const originalWindowLocation = context.window.location;
const originalWindowHistory = context.window.history;
const originalWindowAddEventListener = context.window.addEventListener;
const originalRouterGetElementById = context.document.getElementById;
const originalRouterQuerySelectorAll = context.document.querySelectorAll;
const routerHashListeners = [];
const routerTabTravels = elementStub();
const routerTabStats = elementStub();
context.window.location = { hash: '' };
context.window.history = {
  replaceState(_state, _title, url) {
    context.window.location.hash = String(url);
  },
};
context.window.addEventListener = (event, handler) => {
  if (event === 'hashchange') routerHashListeners.push(handler);
};
context.document.querySelectorAll = selector => (selector === '.tab' ? [routerTabTravels, routerTabStats] : []);
context.document.getElementById = id => {
  if (id === 'view') return elementStub();
  if (id === 'tab-travels') return routerTabTravels;
  if (id === 'tab-stats') return routerTabStats;
  return null;
};
context.renderTravels = () => { context.__routerRendered = 'travels'; };
context.renderStats = () => { context.__routerRendered = 'stats'; };
context.renderLocations = () => { context.__routerRendered = 'locations'; };
context.renderMap = () => { context.__routerRendered = 'map'; };
context.renderTodo = () => { context.__routerRendered = 'todo'; };
context.renderLocationTodo = () => { context.__routerRendered = 'locationTodo'; };
context.openTravel = (id, options) => { context.__routerDetail = { type: 'travel', id, options }; };
context.openLocation = (id, options) => { context.__routerDetail = { type: 'location', id, options }; };
context.startRouter();
assert.equal(context.window.location.hash, '#/travels', 'router installs the default route');
assert.equal(context.__routerRendered, 'travels', 'router renders default route after replace');
assert.equal(routerTabTravels.classList.contains('active'), true, 'router marks the primary tab active');
context.navigateTo('travelDetail', { id: 42 });
assert.equal(context.window.location.hash, '#/travels/42', 'router navigation updates the hash');
routerHashListeners.at(-1)();
assert.deepEqual(
  JSON.parse(JSON.stringify(context.__routerDetail)),
  { type: 'travel', id: 42, options: { fromRouter: true } },
  'router renders travel details from hash changes',
);
context.showTab('stats');
assert.equal(context.window.location.hash, '#/stats', 'showTab delegates to the router when it is active');
routerHashListeners.at(-1)();
assert.equal(vm.runInContext('currentTab', context), 'stats', 'router keeps currentTab in sync with the route');
delete context.window.__spaRouterStarted;
context.window.location = originalWindowLocation;
context.window.history = originalWindowHistory;
context.window.addEventListener = originalWindowAddEventListener;
context.document.getElementById = originalRouterGetElementById;
context.document.querySelectorAll = originalRouterQuerySelectorAll;

const criticalScreens = new Set();

vm.runInContext(fs.readFileSync(mapPath, 'utf8'), context, { filename: mapPath });
const mapView = elementStub();
mapView.scrollTop = 260;
mapView.scrollLeft = 40;
mapView.scrollTo = ({ top, left }) => {
  mapView.scrollTop = top;
  mapView.scrollLeft = left;
};
context.document.getElementById = id => (id === 'view' ? mapView : null);
context.L = {
  divIcon(options) { return options; },
  map(id, options) {
    context.__mapOptions = { id, options };
    return {
      remove() {},
      addLayer() {},
      setView() {},
      fitBounds() {},
      invalidateSize() { context.__mapInvalidated = true; },
    };
  },
  tileLayer() { return { addTo() { context.__tileLayerAdded = true; return this; } }; },
  markerClusterGroup() {
    return {
      clearLayers() {},
      addLayer() {},
      getBounds() { return { isValid() { return false; } }; },
    };
  },
};
context.__mapLoadCalled = false;
vm.runInContext('loadMapLocations = () => { globalThis.__mapLoadCalled = true; }', context);
context.renderMap();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(mapView.classList.contains('map-view-mode'), true, 'map render enables non-scrolling map mode');
assert.equal(mapView.scrollTop, 0, 'map render resets previous view scroll');
assert.match(mapView.innerHTML, /map-screen-shell/, 'map render uses full-height shell');
assert.match(mapView.innerHTML, /id="map-toolbar"/, 'map render exposes toolbar controls before the map');
assert.equal(context.__mapOptions.options.zoomControl, true, 'map render keeps Leaflet zoom controls enabled');
assert.equal(context.__mapInvalidated, true, 'map render invalidates Leaflet size after layout changes');
assert.equal(context.__mapLoadCalled, true, 'map render still loads map locations');
criticalScreens.add('map');

let mapMarkerCreates = 0;
let mapBatchAdds = 0;
const mapCounter = elementStub();
const mapCluster = {
  clearLayers() {},
  addLayers(markers) { mapBatchAdds += markers.length; },
  getBounds() { return { isValid() { return false; } }; },
};
context.document.getElementById = id => (id === 'map-counter' ? mapCounter : null);
context.L.marker = () => {
  mapMarkerCreates += 1;
  return {
    bindPopup() { return this; },
  };
};
context.__mapCluster = mapCluster;
context.__mapLocations = [
  { id: 1, name: 'Helsinki', latitude: 60.17, longitude: 24.94, location_type: 'miasto', country_name: 'Finlandia' },
  { id: 2, name: 'Catania', latitude: 37.5, longitude: 15.08, location_type: 'miasto', country_name: 'Wlochy' },
];
vm.runInContext(`
  markerClusterGroup = __mapCluster;
  allMapLocations = __mapLocations;
  buildMapMarkerCache(allMapLocations);
  renderMapMarkers(allMapLocations);
  renderMapMarkers(allMapLocations.slice(0, 1));
`, context);
assert.equal(mapMarkerCreates, 2, 'map creates Leaflet markers once per loaded location');
assert.equal(mapBatchAdds, 3, 'map filtering reuses cached markers in batches');
assert.equal(mapCounter.textContent, '1 miejsc', 'map counter follows the filtered marker count');

const tabMap = elementStub();
const tabTravels = elementStub();
const switchView = elementStub();
switchView.scrollTop = 400;
switchView.scrollTo = ({ top, left }) => {
  switchView.scrollTop = top;
  switchView.scrollLeft = left;
};
const previousQuerySelectorAll = context.document.querySelectorAll;
context.document.querySelectorAll = selector => (selector === '.tab' ? [tabMap, tabTravels] : []);
context.document.getElementById = id => {
  if (id === 'view') return switchView;
  if (id === 'tab-map') return tabMap;
  if (id === 'tab-travels') return tabTravels;
  return null;
};
context.renderMap = () => { context.__shownTab = 'map'; };
context.renderTravels = () => { context.__shownTab = 'travels'; };
context.showTab('map');
assert.equal(vm.runInContext('currentTab', context), 'map', 'showTab switches to map');
assert.equal(context.__shownTab, 'map', 'showTab invokes map renderer');
assert.equal(switchView.classList.contains('map-view-mode'), true, 'showTab enables map mode for map tab');
assert.equal(switchView.scrollTop, 0, 'showTab resets stale scroll before map interactions');
context.showTab('travels');
assert.equal(vm.runInContext('currentTab', context), 'travels', 'showTab switches back to travels');
assert.equal(switchView.classList.contains('map-view-mode'), false, 'showTab disables map mode outside map tab');
context.document.querySelectorAll = previousQuerySelectorAll;

vm.runInContext(fs.readFileSync(dictionariesPath, 'utf8'), context, { filename: dictionariesPath });
assert.equal(
  context.exportFilenameFromContentDisposition('attachment; filename=moje-podroze-backup-2026-05-23.json'),
  'moje-podroze-backup-2026-05-23.json',
  'export download uses filename from response header',
);
assert.equal(
  context.exportRecordCountLabel({ metadata: { total_records: 22 } }),
  '22 rekordy',
  'export record count label is human-readable',
);

vm.runInContext(fs.readFileSync(personsPath, 'utf8'), context, { filename: personsPath });
const personsListHtml = context.buildPersonsList([{
  id: 3,
  name: 'Anna Nowak',
  relation_type: 'Rodzina',
  relation_type_id: 1,
}], [{ id: 1, name: 'Rodzina' }]);
assert.match(personsListHtml, /person-view-3/, 'persons modal keeps row view ids');
assert.match(personsListHtml, /modal-row-button neutral/, 'persons modal keeps edit actions');
assert.match(personsListHtml, /person-row-info/, 'persons modal uses shared picker row content');

vm.runInContext(fs.readFileSync(locationsPath, 'utf8'), context, { filename: locationsPath });
let locationToolsOverlay = null;
const previousAppendChild = context.document.body.appendChild;
context.document.body.appendChild = el => { locationToolsOverlay = el; };
context.document.getElementById = id => (id === 'location-tools-overlay' ? null : null);
context.openLocationToolsModal();
context.document.body.appendChild = previousAppendChild;
assert.match(locationToolsOverlay.innerHTML, /Narzędzia miejsc/, 'locations view exposes admin actions via tools modal');
assert.match(locationToolsOverlay.innerHTML, /Backup JSON/, 'tools modal keeps backup available');
assert.match(locationToolsOverlay.innerHTML, /Kosz/, 'tools modal keeps trash available');
assert.equal(
  context.locVisitSummary({ visit_count: 1, last_visit: '2025-07-21' }),
  '1 wizyta · ostatnio 21 lip 2025',
  'location visit summary shows the latest visit date',
);
assert.equal(
  context.locVisitSummary({ visit_count: 1 }),
  '1 wizyta · brak daty ostatniej wizyty',
  'location visit summary does not claim that a visited place has no visits',
);
assert.equal(context.locationResultLabel(1), 'wynik', 'location filter summary handles singular result label');
assert.equal(context.locationResultLabel(3), 'wyniki', 'location filter summary handles plural result label');
assert.equal(context.worklistCountLabel(1), 'pozycja', 'worklist count label handles singular rows');
assert.equal(context.worklistCountLabel(3), 'pozycje', 'worklist count label handles plural rows');
assert.equal(context.polishPlural(12, 'wizyta', 'wizyty', 'wizyt'), 'wizyt', 'polishPlural handles teen endings');
assert.equal(context.polishPlural(22, 'wizyta', 'wizyty', 'wizyt'), 'wizyty', 'polishPlural handles later few endings');
const locationCardHtml = context.locCardHtml({
  id: 10,
  name: 'Helsinki',
  location_type: 'miasto',
  country_name: 'Finlandia',
  visit_count: 1,
  last_visit: '2025-07-21',
}, true);
assert.match(locationCardHtml, /openLocation\(10\)/, 'location cards keep click navigation');
assert.match(locationCardHtml, /card-chevron/, 'location cards use shared trailing affordance');
assert.doesNotMatch(locationCardHtml, /style="color:var\(--text3\)/, 'location cards avoid inline chevron styles');
const locationProfileHtml = context.renderLocationDetailProfile({
  id: 10,
  name: 'Helsinki',
  location_type: 'miasto',
  country_name: 'Finlandia',
  parent_name: 'Uusimaa',
  parent_location_id: 11,
  latitude: 60.1699,
  longitude: 24.9384,
  visit_count: 3,
  direct_visit_count: 2,
  child_visit_count: 1,
  child_location_count: 1,
  first_visit: '2024-06-01',
  last_visit: '2025-07-21',
  address: 'Market Square',
  notes: 'Port i centrum.',
  quality: {
    complete: true,
    score: 100,
    missing_count: 0,
    missing_keys: [],
    missing: [],
  },
  children: [{
    id: 11,
    name: 'Suomenlinna',
    location_type: 'wyspa',
    visit_count: 1,
    last_visit: '2025-07-21',
  }],
}, [{ id: 1 }], [{ id: 2 }]);
assert.match(locationProfileHtml, /GPS zapisany/, 'location detail profile shows GPS status');
assert.match(locationProfileHtml, /Pierwsza wizyta/, 'location detail profile shows visit metrics');
assert.match(locationProfileHtml, /Google Maps/, 'location detail profile keeps external map link');
assert.match(locationProfileHtml, /Paszport miejsca/, 'location detail profile shows a place passport');
assert.match(locationProfileHtml, /Kompletne/, 'location detail profile shows data completeness status');
const incompleteLocationProfileHtml = context.renderLocationDetailProfile({
  id: 12,
  name: 'Unknown pier',
  location_type: 'przystań',
  country_name: 'Finlandia',
  visit_count: 0,
  quality: {
    complete: false,
    score: 25,
    missing_count: 4,
    missing_keys: ['missing_gps', 'missing_address', 'missing_notes', 'not_visited'],
    missing: [],
  },
}, [], []);
assert.match(incompleteLocationProfileHtml, /Uzupe.* GPS/, 'location detail profile exposes a GPS quick action');
assert.match(incompleteLocationProfileHtml, /Brak wizyt/, 'location detail profile explains missing visits');
const locationVisitsHtml = context.renderLocationVisitSection('Wizyty', [{
  id: 1,
  travel_name: 'Finlandia',
  arrival_date: '2025-07-18',
  departure_date: '2025-07-21',
  notes: 'Spacer',
}], 'x');
assert.match(locationVisitsHtml, /location-visit-row/, 'location detail renders visit rows as buttons');
const locationChildrenHtml = context.renderLocationChildren({
  children: [{ id: 11, name: 'Suomenlinna', location_type: 'wyspa', visit_count: 1, last_visit: '2025-07-21' }],
});
assert.match(locationChildrenHtml, /Miejsca podrz/, 'location detail renders child places');
const locationPickerHtml = context.buildLocPickerList([{
  id: 10,
  name: 'Helsinki',
  location_type: 'miasto',
  country_name: 'Finlandia',
  parent_location_id: null,
}], 7, '2025-07-18', '2025-07-21');
assert.match(locationPickerHtml, /picker-group-label/, 'location picker uses shared group labels');
assert.match(locationPickerHtml, /picker-row-icon/, 'location picker uses shared icon class');
assert.doesNotMatch(locationPickerHtml, /style="/, 'location picker rows avoid inline styles');

const newLocationOverlays = [];
const previousNewLocationAppend = context.document.body.appendChild;
context.document.body.appendChild = el => { newLocationOverlays.push(el); };
context.document.getElementById = () => null;
context.api = async path => {
  await new Promise(resolve => setTimeout(resolve, 10));
  if (path === '/api/countries') return [{ id: 1, name: 'Finlandia' }];
  if (path === '/api/location_types') return [{ id: 1, name: 'miasto' }];
  if (path === '/api/locations') return [{ id: 10, name: 'Helsinki', country_name: 'Finlandia', location_type: 'miasto' }];
  return [];
};
await Promise.all([
  context.openNewLocationModal(),
  context.openNewLocationModal(),
  context.openNewLocationModal(),
]);
context.document.body.appendChild = previousNewLocationAppend;
assert.equal(newLocationOverlays.length, 1, 'rapid repeated add-location taps open one modal');
assert.equal(newLocationOverlays[0].id, 'new-loc-overlay', 'add-location smoke opens the expected sheet');
assert.match(newLocationOverlays[0].innerHTML, /Nowe miejsce/, 'add-location modal renders the form title');

const locationTodoView = elementStub();
context.document.getElementById = id => (id === 'view' ? locationTodoView : null);
context.api = async path => {
  assert.equal(path, '/api/locations/todo', 'location todo fetches the expected endpoint');
  return {
    total: 3,
    labels: { missing_gps: 'Bez GPS', missing_address: 'Bez adresu', missing_notes: 'Bez notatek', not_visited: 'Bez wizyt' },
    counts: { missing_gps: 2, missing_address: 1, missing_notes: 1, not_visited: 1 },
    needs_attention: [{
      id: 10,
      name: 'Helsinki',
      location_type: 'miasto',
      country_name: 'Finlandia',
      visit_count: 3,
      missing_count: 3,
      missing_keys: ['missing_gps', 'missing_address', 'missing_notes'],
      missing: ['Bez GPS', 'Bez adresu', 'Bez notatek'],
    }, {
      id: 11,
      name: 'Catania',
      location_type: 'miasto',
      country_name: 'Włochy',
      visit_count: 0,
      missing_count: 2,
      missing_keys: ['missing_gps', 'not_visited'],
      missing: ['Bez GPS', 'Bez wizyt'],
    }],
  };
};
vm.runInContext('currentLocationTodoFilter = "all"; currentLocationTodoSort = "priority"', context);
await context.renderLocationTodo({ missing: 'missing_gps', sort: 'visit_count_asc' });
assert.match(locationTodoView.innerHTML, /aux-filter-panel/, 'location todo uses compact filter panel');
assert.match(locationTodoView.innerHTML, /location-todo-filter-select/, 'location todo filter is a select control');
assert.match(locationTodoView.innerHTML, /location-todo-sort-select/, 'location todo exposes sort control');
assert.match(locationTodoView.innerHTML, /badge-orange/, 'location todo renders colored GPS badges');
assert.match(locationTodoView.innerHTML, /badge-purple/, 'location todo renders colored address badges');
assert.match(locationTodoView.innerHTML, /worklist-action-btn/, 'location todo cards expose quick action buttons');
assert.match(locationTodoView.innerHTML, /openLocationTodoAction\(10, 'missing_gps'\)/, 'location todo GPS action targets the edit modal');
assert.match(locationTodoView.innerHTML, /openLocationTodoAction\(11, 'not_visited'\)/, 'location todo visit action targets the location detail');
assert.ok(
  locationTodoView.innerHTML.indexOf('Catania') < locationTodoView.innerHTML.indexOf('Helsinki'),
  'location todo applies visit-count sorting from route params',
);
assert.doesNotMatch(locationTodoView.innerHTML, /sort-btn/, 'location todo avoids horizontal chip filters');
assert.match(locationTodoView.innerHTML, /worklist-list/, 'location todo uses worklist card list');

const trashBody = elementStub();
context.document.getElementById = id => (id === 'trash-body' ? trashBody : null);
context.renderTrashBody({
  travels: [{ id: 1, name: 'Tallinn', start_date: '2025-07-01', end_date: '2025-07-03', deleted_at: '2025-08-01' }],
  locations: [{ id: 2, name: 'Helsinki', location_type: 'miasto', country_name: 'Finlandia', deleted_at: '2025-08-02' }],
});
assert.match(trashBody.innerHTML, /trash-row/, 'trash renders dedicated rows');
assert.match(trashBody.innerHTML, /trash-action restore/, 'trash restore action uses shared button class');
assert.match(trashBody.innerHTML, /trash-action danger/, 'trash hard delete action uses shared button class');
assert.doesNotMatch(trashBody.innerHTML, /style="/, 'trash rows avoid inline styles');

vm.runInContext(fs.readFileSync(travelsPath, 'utf8'), context, { filename: travelsPath });
const travelCard = context.travelCardHtml({
  id: 7,
  name: 'Helsinki',
  start_date: '2025-07-18',
  end_date: '2025-07-21',
  purpose: 'Wakacje',
  rating: 4.5,
  amount: 1200,
  currency: 'EUR',
  has_photo_album: 1,
  is_description_complete: 1,
});
assert.match(travelCard, /card completed/, 'travel cards keep completed state');
assert.match(travelCard, /openTravel\(7\)/, 'travel cards keep click navigation');
assert.match(travelCard, /card-meta/, 'travel cards keep badges in card metadata');
const travelControlsHtml = vm.runInContext(`
  currentSearch = 'Helsinki';
  currentTravelYear = 2025;
  currentSort = 'rating_desc';
  const travelHost = document.createElement('div');
  document.getElementById = id => (id === 'travel-controls' ? travelHost : null);
  renderTravelControls(['2025', '2024'], 2);
  travelHost.innerHTML;
`, context);
assert.match(travelControlsHtml, /travel-filter-grid/, 'travel filters render as compact select controls');
assert.match(travelControlsHtml, /Wyczyść/, 'travel filters expose reset action when active');
assert.doesNotMatch(travelControlsHtml, /sort-btn/, 'travel filters avoid long horizontal chip bars');
assert.equal(context.travelResultLabel(2), 'podróże', 'travel filter summary has human-readable count labels');
assert.equal(context.travelResultLabel(22), 'podróże', 'travel filter summary reuses shared Polish plurals');
const parsedTravelNotes = context.parseTravelDailyNotes(
  'Test trip --> 2025-05-08 --- 2025-05-10\n\n2025-05-08 - Start w porcie.\n2025-05-09 - Spacer po mieście.',
);
assert.equal(parsedTravelNotes.days.length, 2, 'travel detail parses imported daily notes');
const sampleTravelDetail = {
  id: 7,
  name: 'Workation test',
  start_date: '2025-05-08',
  end_date: '2025-05-10',
  purpose: 'Wakacje',
  amount: 1200,
  currency: 'EUR',
  number_of_flights: 2,
  rating: 4.5,
  has_photo_album: 1,
  is_description_complete: 1,
  notes: 'Workation test --> 2025-05-08 --- 2025-05-10\n\n2025-05-08 - Start w porcie.\n2025-05-09 - Spacer po mieście.',
  reflections: '',
  participants: [{ id: 3, name: 'Anna Nowak', relation_type: 'Rodzina' }],
  locations: [{
    id: 11,
    location_id: 101,
    location_name: 'Trapani',
    location_type: 'miasto',
    country_name: 'Włochy',
    arrival_date: '2025-05-08',
    departure_date: '2025-05-10',
    notes: 'Baza wyjazdu.',
  }, {
    id: 12,
    location_id: 102,
    location_name: 'Erice',
    location_type: 'miasto',
    country_name: 'Włochy',
    arrival_date: '2025-05-09',
    departure_date: '2025-05-09',
    notes: 'Spacer po mieście.',
  }],
};
const routeHtml = context.renderTravelRouteSection(sampleTravelDetail);
assert.match(routeHtml, /travel-route-day/, 'travel detail groups route by day');
assert.match(routeHtml, /data-route-day="2025-05-08"/, 'travel route keeps date group keys');
assert.match(routeHtml, /travel-route-note/, 'travel route renders visit notes in compact details');
assert.doesNotMatch(routeHtml, /style="/, 'travel route rows avoid inline styles');
const detailHtml = context.renderTravelDetail(sampleTravelDetail);
assert.match(detailHtml, /travel-hero-stats/, 'travel detail renders the compact hero metrics');
assert.match(detailHtml, /Notatki dzienne/, 'travel detail turns imported notes into daily blocks');
assert.match(detailHtml, /travel-day-card/, 'travel detail renders daily notes as collapsible cards');

let travelScreenMounted = false;
const travelScreenView = mountAwareElementStub(html => {
  if (html.includes('id="travel-list"')) travelScreenMounted = true;
});
const travelScreenList = elementStub();
const travelScreenControls = elementStub();
const travelScreenSearch = elementStub();
travelScreenSearch.value = '';
context.document.getElementById = id => {
  if (id === 'view') return travelScreenView;
  if (!travelScreenMounted) return null;
  if (id === 'travel-list') return travelScreenList;
  if (id === 'travel-controls') return travelScreenControls;
  if (id === 'travel-search') return travelScreenSearch;
  return null;
};
const travelScreenApiCalls = [];
context.api = async path => {
  travelScreenApiCalls.push(path);
  assert.equal(path, '/api/travels', 'travel list fetches the expected endpoint');
  return [{
    id: 7,
    name: 'Workation test',
    start_date: '2025-05-08',
    end_date: '2025-05-10',
    purpose: 'Wakacje',
    rating: 4.5,
    amount: 1200,
    currency: 'EUR',
    has_photo_album: 1,
    is_description_complete: 1,
  }, {
    id: 8,
    name: 'Tallinn',
    start_date: '2024-07-01',
    end_date: '2024-07-03',
    purpose: 'Miasto',
    rating: null,
    amount: 0,
    currency: 'EUR',
    has_photo_album: 0,
    is_description_complete: 0,
  }];
};
vm.runInContext('currentSearch = ""; currentTravelYear = null; currentSort = "date_desc"', context);
await context.renderTravels();
assert.deepEqual(travelScreenApiCalls, ['/api/travels'], 'travel list screen performs one list request');
assert.match(travelScreenView.innerHTML, /page-title/, 'travel list screen renders a page header');
assert.match(travelScreenControls.innerHTML, /travel-filter-grid/, 'travel list screen renders filters');
assert.match(travelScreenList.innerHTML, /Workation test/, 'travel list screen renders trip cards');
assert.match(travelScreenList.innerHTML, /openTravel\(7\)/, 'travel list cards link to trip detail');
criticalScreens.add('travels-list');

const travelDetailView = elementStub();
context.document.getElementById = id => (id === 'view' ? travelDetailView : null);
context.api = async path => {
  assert.equal(path, '/api/travels/7', 'travel detail fetches the selected trip');
  return sampleTravelDetail;
};
await context.openTravel(7);
assert.match(travelDetailView.innerHTML, /travel-detail-hero/, 'travel detail screen renders the hero');
assert.match(travelDetailView.innerHTML, /Trasa i miejsca/, 'travel detail screen renders route section');
assert.match(travelDetailView.innerHTML, /Uczestnicy/, 'travel detail screen renders participants section');
assert.match(travelDetailView.innerHTML, /Notatki dzienne/, 'travel detail screen renders daily notes');
criticalScreens.add('travel-detail');

vm.runInContext(fs.readFileSync(todoPath, 'utf8'), context, { filename: todoPath });
const todoView = elementStub();
context.document.getElementById = id => (id === 'view' ? todoView : null);
context.api = async path => {
  assert.equal(path, '/api/stats/todo', 'travel todo fetches the expected endpoint');
  return {
    total: 2,
    labels: { missing_rating: 'Bez oceny', missing_album: 'Bez albumu' },
    counts: { missing_rating: 1, missing_album: 1 },
    needs_attention: [{
      id: 1,
      name: 'Helsinki',
      start_date: '2025-07-18',
      missing_count: 2,
      missing_keys: ['missing_rating', 'missing_album'],
      missing: ['Bez oceny', 'Bez albumu'],
    }],
  };
};
vm.runInContext('currentTodoYear = null; currentTodoFilter = "all"', context);
await context.renderTodo();
assert.match(todoView.innerHTML, /aux-filter-panel/, 'travel todo uses compact filter panel');
assert.match(todoView.innerHTML, /todo-year-select/, 'travel todo year filter is a select control');
assert.match(todoView.innerHTML, /todo-filter-select/, 'travel todo missing filter is a select control');
assert.doesNotMatch(todoView.innerHTML, /sort-btn/, 'travel todo avoids horizontal chip filters');
assert.match(todoView.innerHTML, /worklist-list/, 'travel todo uses worklist card list');

const swSource = fs.readFileSync(swPath, 'utf8');
assert.match(swSource, /NO_STORE_API_PREFIXES/, 'service worker declares no-store API prefixes');
assert.match(swSource, /__NO_STORE_API_EXACT_PATHS__/, 'service worker receives exact no-store paths from backend');
assert.match(swSource, /__NO_STORE_API_PREFIXES__/, 'service worker receives no-store prefixes from backend');
assert.doesNotMatch(swSource, /\/api\/travels/, 'service worker no-store policy is not duplicated as hardcoded paths');
assert.doesNotMatch(swSource, /\/api\/stats/, 'service worker no-store prefixes are injected from backend');
assert.match(swSource, /Cache-Control/, 'service worker respects no-store cache headers');

vm.runInContext(fs.readFileSync(wizardPath, 'utf8'), context, { filename: wizardPath });
const wizardParticipantPickerHtml = context.wizardAvailableParticipantsHtml([{
  id: 3,
  name: 'Anna Nowak',
  relation_type: 'Rodzina',
}]);
assert.match(wizardParticipantPickerHtml, /person-row/, 'wizard participant picker uses shared picker rows');
assert.match(wizardParticipantPickerHtml, /wizardPickParticipant/, 'wizard participant picker keeps click action');
const wizardLocationPickerHtml = context.wizardGroupedLocationsHtml([{
  id: 10,
  name: 'Helsinki',
  location_type: 'miasto',
  country_name: 'Finlandia',
  parent_name: 'Uusimaa',
}]);
assert.match(wizardLocationPickerHtml, /wiz-picker-item/, 'wizard location picker keeps wizard row class');
assert.match(wizardLocationPickerHtml, /wizardPickLocation\(10\)/, 'wizard location picker keeps click action');

const wizardSaveButton = elementStub();
let wizardClosed = false;
let wizardOpenedTravel = null;
let wizardToast = null;
const wizardApiCalls = [];
context.document.getElementById = id => (id === 'wizard-next-btn' ? wizardSaveButton : null);
context.apiPost = async (path, body) => {
  wizardApiCalls.push({ path, body });
  return { id: 77 };
};
context.closeWizard = () => { wizardClosed = true; };
context.openTravel = id => { wizardOpenedTravel = id; };
context.toast = (message, type) => { wizardToast = { message, type }; };

vm.runInContext(`
  wizardState = {
    info: {
      name: 'Wizard trip',
      purpose: 'Test',
      start_date: '2025-07-10',
      end_date: '2025-07-12',
      amount: 100,
      currency: 'pln',
      number_of_flights: 2,
      rating: 4.5,
      has_photo_album: 1,
      is_description_complete: 0,
      notes: 'Note',
      reflections: '',
    },
    locations: [{
      id: 10,
      arrival: '2025-07-10',
      departure: '2025-07-12',
      notes: 'Stay',
    }],
    participants: [{ id: 3 }],
  };
`, context);
await context.wizardSave();
assert.equal(wizardApiCalls.length, 1, 'wizard final save uses one request');
assert.equal(wizardApiCalls[0].path, '/api/travels/wizard', 'wizard uses transactional save endpoint');
assert.equal(wizardApiCalls[0].body.travel.name, 'Wizard trip');
assert.equal(wizardApiCalls[0].body.locations[0].location_id, 10);
assert.equal(wizardApiCalls[0].body.locations[0].force_outside_range, true);
assert.equal(wizardApiCalls[0].body.participants[0].person_id, 3);
assert.equal(wizardClosed, true, 'wizard closes after successful transactional save');
assert.equal(wizardOpenedTravel, 77, 'wizard opens created travel');
assert.deepEqual(wizardToast, { message: 'Podróż utworzona', type: 'success' });

function statsPayload(overrides = {}) {
  return {
    total_trips: 8,
    total_days: 24,
    countries: 5,
    visited_locations: 14,
    flights: 6,
    albums: 3,
    avg_rating: 4.5,
    avg_trip_days: 3,
    amount_by_currency: { EUR: 1200, PLN: 900 },
    cost_summary: [{
      currency: 'EUR',
      trip_count: 2,
      days: 8,
      total: 1200,
      avg_trip: 600,
      median_trip: 600,
      avg_per_day: 150,
    }],
    purposes: [{ name: 'Miasto', count: 4 }, { name: 'Natura', count: 2 }],
    participants: [{ id: 1, name: 'Anna', relation_type: 'Rodzina', trips: 5, days: 16 }],
    top_expensive: [{ name: 'Helsinki', amount: 1200, currency: 'EUR' }],
    top_countries: [{ country: 'Finlandia', visits: 3, days_spent: 9 }],
    top_places: [{
      id: 10,
      location_name: 'Helsinki',
      country: 'Finlandia',
      location_type: 'miasto',
      lat: null,
      lon: null,
      visit_count: 3,
      days_spent: 9,
    }],
    by_month: [{ month: 7, days: 8, count: 2 }],
    cost_per_day: [{ name: 'Helsinki', amount: 1200, currency: 'EUR', days: 4, cost_per_day: 300 }],
    progress: { total: 8, described: 6, with_album: 3 },
    locations: 20,
    by_year: [{ year: 2025, count: 2, days: 8 }, { year: 2024, count: 1, days: 4 }],
    hall_of_fame: {
      longest: { id: 1, name: 'Longest', value: 8 },
      priciest: { id: 1, name: 'Priciest', value: 1200, currency: 'EUR' },
      best_rated: { id: 1, name: 'Best', value: 4.5 },
      most_places: { id: 2, name: 'Most places', value: 7 },
      most_flights: { id: 3, name: 'Most flights', value: 4 },
      most_countries: { id: 4, name: 'Most countries', value: 3 },
      top_country: { name: 'Finlandia', visits: 3, days: 9 },
      longest_gap: { id: 5, name: 'After break', value: 120 },
      longest_streak: { start_date: '2025-07-18', end_date: '2025-07-28', value: 11 },
      best_month: { year: 2025, month: 7, value: 11 },
    },
    current_trip: null,
    streak_months: 2,
    heatmap: [{ year: 2025, month: 7, days: 8 }],
    data_quality: {
      total: 8,
      counts: {
        missing_cost: 1,
        missing_rating: 2,
        missing_locations: 0,
        missing_reflections: 1,
        missing_album: 3,
        incomplete_description: 1,
      },
      needs_attention: [{ id: 2, name: 'Tallinn', missing: ['brak oceny', 'brak albumu'] }],
    },
    country_milestones: {
      new: [{ id: 3, name: 'Finlandia', first_visit: '2025-07-18', trips: 1 }],
      returning: [{ id: 4, name: 'Estonia', trips: 2 }],
    },
    country_history: {
      summary: {
        countries: 5,
        active_countries: 2,
        returning_countries: 2,
        single_visit_countries: 3,
        avg_days_per_country: 4.8,
      },
      top_returns: [{ name: 'Finlandia', trips: 3, days_spent: 9, years_visited: 2, last_visit: '2025-07-28' }],
      most_regular: [{ name: 'Estonia', trips: 2, days_spent: 5, years_visited: 2 }],
      longest_absences: [{ name: 'Litwa', trips: 1, days_since_last_visit: 400, last_visit: '2024-06-01' }],
      longest_gaps: [{ name: 'Czechy', longest_gap_days: 500, longest_gap_from: '2023-05-01', longest_gap_to: '2024-09-12' }],
      only_once: [{ name: 'Norwegia', days_spent: 6, first_visit: '2024-08-01', last_visit: '2024-08-06' }],
    },
    yearbook: [{
      year: 2025,
      trips: 2,
      days: 8,
      countries: 2,
      top_month: { month: 7, days: 8 },
      new_countries: [{ id: 3, name: 'Finlandia', first_visit: '2025-07-18', trips: 1 }],
      new_countries_count: 1,
      returning_countries: [{ id: 4, name: 'Estonia', first_visit: '2024-04-10', trips: 2 }],
      returning_countries_count: 1,
      months: [{ month: 7, days: 8 }, { month: 9, days: 2 }],
      highlights: {
        longest: {
          id: 1,
          name: 'Helsinki',
          start_date: '2025-07-18',
          end_date: '2025-07-21',
          purpose: 'Miasto',
          rating: 4.5,
          amount: 1200,
          currency: 'EUR',
          days: 4,
        },
        best_rated: {
          id: 1,
          name: 'Helsinki',
          start_date: '2025-07-18',
          end_date: '2025-07-21',
          purpose: 'Miasto',
          rating: 4.5,
          amount: 1200,
          currency: 'EUR',
          days: 4,
        },
        priciest: {
          id: 1,
          name: 'Helsinki',
          start_date: '2025-07-18',
          end_date: '2025-07-21',
          purpose: 'Miasto',
          rating: 4.5,
          amount: 1200,
          currency: 'EUR',
          days: 4,
        },
      },
      featured_trip: {
        id: 1,
        name: 'Helsinki',
        start_date: '2025-07-18',
        end_date: '2025-07-21',
        purpose: 'Miasto',
        rating: 4.5,
        amount: 1200,
        currency: 'EUR',
        days: 4,
      },
      story: {
        title: 'Rok spokojnych rozdziałów',
        summary: '2 podróże, 8 dni w drodze i 2 kraje.',
      },
      trips_list: [{
        id: 1,
        name: 'Helsinki',
        start_date: '2025-07-18',
        end_date: '2025-07-21',
        purpose: 'Miasto',
        rating: 4.5,
        amount: 1200,
        currency: 'EUR',
        days: 4,
      }],
    }],
    prev_period: null,
    year: null,
    ...overrides,
  };
}

const statsView = elementStub();
context.document.getElementById = id => (id === 'view' ? statsView : null);
context.openTravel = () => {};
context.openTodoView = () => {};
context.showTravelOnMap = () => {};
context.createColorIcon = () => null;
context.L = undefined;
vm.runInContext(fs.readFileSync(statsYearbookPath, 'utf8'), context, { filename: statsYearbookPath });
vm.runInContext(fs.readFileSync(statsPath, 'utf8'), context, { filename: statsPath });

const roundedRatingDelta = context.yoyDelta(4.4, 4.1);
assert.match(roundedRatingDelta, /\+0,3/, 'stats YoY delta rounds decimal averages');
assert.doesNotMatch(roundedRatingDelta, /000000000/, 'stats YoY delta hides floating-point noise');
assert.match(context.yoyDelta(12, 10), /\+2/, 'stats YoY delta keeps integer changes compact');

const hofRecords = context.hallOfFameRecords(statsPayload().hall_of_fame, ['', 'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip']);
assert.equal(hofRecords.length, 10, 'hall of fame includes all available record categories');
assert.equal(hofRecords.filter(r => r.id).length, 7, 'hall of fame marks only trip records as clickable');
assert.equal(hofRecords.find(r => r.key === 'top_country').id, undefined, 'country aggregate does not pretend to open a trip');
const hofHtml = context.renderHallOfFame(statsPayload().hall_of_fame, ['', 'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip']);
assert.match(hofHtml, /hof-grid/, 'hall of fame renders as a visible grid');
assert.doesNotMatch(hofHtml, /hof-scroll/, 'hall of fame no longer uses a horizontal scroll list');
assert.equal(count(hofHtml, 'hof-clickable'), 7, 'hall of fame click targets match trip-backed records');

let statsResponse = statsPayload();
const apiCalls = [];
context.__statsApi = async path => {
  apiCalls.push(path);
  const response = JSON.parse(JSON.stringify(statsResponse));
  const year = path.includes('year=2025') ? 2025 : null;
  response.year = year;
  return response;
};
vm.runInContext('api = __statsApi', context);

async function renderStatsSection(section, { year = null, payload = statsPayload() } = {}) {
  statsResponse = payload;
  vm.runInContext(
    `currentStatsSection = ${JSON.stringify(section)}; currentStatsYear = ${year == null ? 'null' : Number(year)};`,
    context,
  );
  await context.renderStats();
  return statsView.innerHTML;
}

const overviewStats = await renderStatsSection('overview');
assert.equal(apiCalls.at(-1), '/api/stats/overview', 'overview section uses the lightweight stats endpoint');
assert.match(overviewStats, /Podsumowanie/, 'stats render section tabs');
assert.match(overviewStats, /Hall of Fame/, 'overview keeps hall of fame records');
assert.match(overviewStats, /hof-grid/, 'overview shows hall of fame as a grid');
assert.doesNotMatch(overviewStats, /hof-scroll/, 'overview avoids horizontal hall of fame scroller');
assert.match(overviewStats, /Cel podr/, 'overview keeps purpose chart');
assert.doesNotMatch(overviewStats, /Koszty wed/, 'overview does not show cost section details');
criticalScreens.add('stats-overview');

const costsStats = await renderStatsSection('costs');
assert.match(costsStats, /Koszty wed/, 'costs section shows cost summary');
assert.match(costsStats, /Top 10/, 'costs section shows expensive trips');
assert.match(costsStats, /per dzie/, 'costs section shows cost per day');
assert.doesNotMatch(costsStats, /Historia kraj/, 'costs section does not show country history');

const participantsStats = await renderStatsSection('participants');
assert.match(participantsStats, /Uczestnicy/, 'participants section shows participant ranking');
assert.match(participantsStats, /Anna/, 'participants section renders participant names');

const countriesStats = await renderStatsSection('countries', { year: 2025 });
assert.equal(apiCalls.at(-1), '/api/stats?year=2025', 'stats year filter is passed to API');
assert.match(countriesStats, /Kraje w 2025/, 'country section keeps yearly country milestones');
assert.match(countriesStats, /Historia kraj/, 'country section shows country history');
assert.match(countriesStats, /Top kraj/, 'country section shows country ranking');
assert.doesNotMatch(countriesStats, /Podr.*y w roku/, 'non-overview sections stay focused after year changes');

const yearbookStats = await renderStatsSection('yearbook');
assert.match(yearbookStats, /Rocznik/, 'yearbook section renders the travel yearbook');
assert.match(yearbookStats, /Helsinki/, 'yearbook section renders highlighted trips');
assert.match(yearbookStats, /Podr.* roku/, 'yearbook section renders the featured trip');
assert.match(yearbookStats, /Rytm roku/, 'yearbook section renders month rhythm');
assert.match(yearbookStats, /Rok spokojnych/, 'yearbook section renders the annual story');
assert.match(yearbookStats, /Nowe kraje/, 'yearbook section renders country chapter details');
assert.doesNotMatch(yearbookStats, /Koszty wed/, 'yearbook section stays focused on the yearbook');
criticalScreens.add('stats-yearbook');

const filteredYearbookStats = await renderStatsSection('yearbook', { year: 2025 });
assert.equal(apiCalls.at(-1), '/api/stats?year=2025', 'yearbook section keeps year filter requests');
assert.match(filteredYearbookStats, /2025/, 'yearbook year filter keeps the selected chapter visible');

const qualityStats = await renderStatsSection('quality');
assert.match(qualityStats, /Jako/, 'quality section shows data quality card');
assert.match(qualityStats, /Lista/, 'quality section keeps todo shortcut');
assert.match(qualityStats, /Bez oceny/, 'quality section renders missing-data counters');

const emptyParticipantsStats = await renderStatsSection('participants', {
  payload: statsPayload({ participants: [] }),
});
assert.match(emptyParticipantsStats, /Brak uczestnik/, 'empty stats section shows an explicit empty state');

assert.deepEqual(
  [...criticalScreens].sort(),
  ['map', 'stats-overview', 'stats-yearbook', 'travel-detail', 'travels-list'].sort(),
  'critical UI smoke covers the main app screens',
);

console.log('JS smoke tests passed');
