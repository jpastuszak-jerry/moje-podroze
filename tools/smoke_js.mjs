import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const utilsPath = path.join(repoRoot, 'static', 'js', 'utils.js');

function elementStub() {
  return {
    dataset: {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
    },
    style: {},
    removed: false,
    remove() { this.removed = true; },
    addEventListener() {},
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
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
      classList: { add() {}, remove() {} },
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

function count(haystack, needle) {
  return (haystack.match(new RegExp(needle, 'g')) || []).length;
}

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

console.log('JS smoke tests passed');
