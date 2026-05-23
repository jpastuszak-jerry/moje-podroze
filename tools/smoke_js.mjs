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
const locationsPath = path.join(repoRoot, 'static', 'js', 'locations.js');
const mapPath = path.join(repoRoot, 'static', 'js', 'map.js');
const travelsPath = path.join(repoRoot, 'static', 'js', 'travels.js');
const statsPath = path.join(repoRoot, 'static', 'js', 'stats.js');
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
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
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
assert.match(appCssSource, /#view\.map-view-mode\s*\{\s*overflow:\s*hidden;/, 'mobile map view disables page scroll');
assert.match(appCssSource, /\.map-screen-shell[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/, 'map screen uses a dedicated flex shell');
assert.match(appCssSource, /@media\s*\(max-width:\s*899px\)[\s\S]*#theme-toggle[\s\S]*bottom:\s*calc\(72px \+ var\(--safe-bottom\)\)/, 'mobile theme toggle is anchored away from map toolbar controls');
assert.match(appCssSource, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)\s*34px\s*34px/, 'mobile map toolbar keeps filters and buttons in a fixed grid');

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

const rankingHtml = context.renderRankingBars(
  [{ name: 'Ala', score: 10 }, { name: 'Ola', score: 5 }],
  { nameKey: 'name', valueKey: 'score', color: 'red' },
);
assert.match(rankingHtml, /gbar-row/, 'renderRankingBars renders rows');
assert.match(rankingHtml, /width:100%/, 'renderRankingBars scales top value to full width');

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
  last_visit: '2025-07-21',
  address: 'Market Square',
  notes: 'Port i centrum.',
}, [{ id: 1 }], [{ id: 2 }]);
assert.match(locationProfileHtml, /GPS zapisany/, 'location detail profile shows GPS status');
assert.match(locationProfileHtml, /Wizyty łącznie/, 'location detail profile shows visit metrics');
assert.match(locationProfileHtml, /Google Maps/, 'location detail profile keeps external map link');
const locationVisitsHtml = context.renderLocationVisitSection('Wizyty', [{
  id: 1,
  travel_name: 'Finlandia',
  arrival_date: '2025-07-18',
  departure_date: '2025-07-21',
  notes: 'Spacer',
}], 'x');
assert.match(locationVisitsHtml, /location-visit-row/, 'location detail renders visit rows as buttons');

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

vm.runInContext(fs.readFileSync(travelsPath, 'utf8'), context, { filename: travelsPath });
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

const swSource = fs.readFileSync(swPath, 'utf8');
assert.match(swSource, /NO_STORE_API_PREFIXES/, 'service worker declares no-store API prefixes');
assert.match(swSource, /\/api\/travels/, 'service worker treats travel cost data as no-store');
assert.match(swSource, /\/api\/stats/, 'service worker treats stats cost and quality data as no-store');
assert.match(swSource, /Cache-Control/, 'service worker respects no-store cache headers');

vm.runInContext(fs.readFileSync(wizardPath, 'utf8'), context, { filename: wizardPath });

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
      returning_countries: [{ id: 4, name: 'Estonia', first_visit: '2024-04-10', trips: 2 }],
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
vm.runInContext(fs.readFileSync(statsPath, 'utf8'), context, { filename: statsPath });

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
assert.match(overviewStats, /Podsumowanie/, 'stats render section tabs');
assert.match(overviewStats, /Hall of Fame/, 'overview keeps hall of fame records');
assert.match(overviewStats, /Cel podr/, 'overview keeps purpose chart');
assert.doesNotMatch(overviewStats, /Koszty wed/, 'overview does not show cost section details');

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
assert.match(yearbookStats, /Nowe kraje/, 'yearbook section renders country chapter details');
assert.doesNotMatch(yearbookStats, /Koszty wed/, 'yearbook section stays focused on the yearbook');

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

console.log('JS smoke tests passed');
