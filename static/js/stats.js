const CHART_PALETTE = ['#1a6fdb','#f97316','#059669','#7c3aed','#e11d48','#0891b2','#d97706','#9f1239'];

function svgDonut(data, { nameKey = 'name', valueKey = 'count' } = {}) {
  if (!data || !data.length) return '';
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  if (!total) return '';
  const cx = 80, cy = 80, rOut = 70, rIn = 46;
  let angle = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const v = d[valueKey] || 0;
    const sweep = (v / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    if (data.length === 1) {
      return `<circle cx="${cx}" cy="${cy}" r="${(rOut+rIn)/2}" fill="none" stroke="${color}" stroke-width="${rOut-rIn}"/>`;
    }
    const x0o = cx + rOut * Math.cos(a0), y0o = cy + rOut * Math.sin(a0);
    const x1o = cx + rOut * Math.cos(a1), y1o = cy + rOut * Math.sin(a1);
    const x0i = cx + rIn * Math.cos(a0), y0i = cy + rIn * Math.sin(a0);
    const x1i = cx + rIn * Math.cos(a1), y1i = cy + rIn * Math.sin(a1);
    const large = sweep > Math.PI ? 1 : 0;
    return `<path d="M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z" fill="${color}"/>`;
  }).join('');
  const legend = data.map((d, i) => {
    const pct = Math.round((d[valueKey] || 0) / total * 100);
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    return `<div class="chart-legend-row">
      <div class="chart-legend-dot" style="background:${color}"></div>
      <div class="chart-legend-name">${escapeHtml(d[nameKey] || '-')}</div>
      <div class="chart-legend-val">${d[valueKey]} <span style="color:var(--text3)">·&nbsp;${pct}%</span></div>
    </div>`;
  }).join('');
  return `<div class="donut-wrap">
    <svg viewBox="0 0 160 160" class="chart-svg donut-svg">
      ${segments}
      <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text)">${total}</text>
      <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="var(--text2)" letter-spacing="1">RAZEM</text>
    </svg>
    <div class="chart-legend">${legend}</div>
  </div>`;
}

function svgHeatmap(data) {
  if (!data || !data.length) return '';
  const map = {};
  data.forEach(d => { map[`${d.year}-${d.month}`] = d.days; });
  const years = [...new Set(data.map(d => d.year))].sort();
  const allYears = [];
  for (let y = years[years.length - 1]; y >= years[0]; y--) allYears.push(y);
  const maxDays = Math.max(...data.map(d => d.days), 1);
  const cellW = 30, cellH = 22, gap = 4, padL = 38, padT = 22;
  const W = padL + 12 * (cellW + gap) - gap + 4;
  const H = padT + allYears.length * (cellH + gap) - gap + 4;
  const monthLabels = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const colors = [
    'rgba(127,127,127,0.12)',
    'rgba(26,111,219,0.28)',
    'rgba(26,111,219,0.5)',
    'rgba(26,111,219,0.74)',
    '#1a6fdb',
  ];
  const headerLabels = monthLabels.map((m, i) =>
    `<text x="${padL + i * (cellW + gap) + cellW/2}" y="15" text-anchor="middle" font-size="10" fill="var(--text3)" font-weight="700">${m}</text>`
  ).join('');
  const yearLabels = allYears.map((y, i) =>
    `<text x="${padL - 8}" y="${padT + i * (cellH + gap) + cellH/2 + 4}" text-anchor="end" font-size="10" fill="var(--text2)" font-weight="600">${y}</text>`
  ).join('');
  const cells = allYears.map((y, ri) =>
    Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const days = map[`${y}-${mo}`] || 0;
      let level = 0;
      if (days > 0) {
        const ratio = days / maxDays;
        level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
      }
      const x = padL + i * (cellW + gap);
      const yPos = padT + ri * (cellH + gap);
      return `<rect x="${x}" y="${yPos}" width="${cellW}" height="${cellH}" rx="3" fill="${colors[level]}"><title>${y}-${String(mo).padStart(2, '0')}: ${days} dni</title></rect>`;
    }).join('')
  ).join('');
  const legendY = H + 18;
  const legendX = padL;
  const legend = `<text x="${legendX}" y="${legendY}" font-size="9" fill="var(--text3)">mniej</text>` +
    colors.map((c, i) => `<rect x="${legendX + 32 + i * 12}" y="${legendY - 8}" width="10" height="10" rx="2" fill="${c}"/>`).join('') +
    `<text x="${legendX + 32 + colors.length * 12 + 4}" y="${legendY}" font-size="9" fill="var(--text3)">więcej</text>`;
  return `<svg viewBox="0 0 ${W} ${H + 28}" class="chart-svg heatmap-svg" style="width:100%;height:auto">
    ${headerLabels}${yearLabels}${cells}${legend}
  </svg>`;
}

let currentStatsYear = null;
let currentStatsSection = 'overview';

const STATS_SECTIONS = [
  { id: 'overview', label: 'Podsumowanie' },
  { id: 'yearbook', label: 'Rocznik' },
  { id: 'countries', label: 'Kraje i miejsca' },
  { id: 'costs', label: 'Koszty' },
  { id: 'participants', label: 'Uczestnicy' },
  { id: 'quality', label: 'Jakość danych' },
];

function setStatsYear(y) {
  currentStatsYear = y;
  renderStats();
}

function setStatsSection(sectionId) {
  if (!STATS_SECTIONS.some(section => section.id === sectionId)) return;
  currentStatsSection = sectionId;
  renderStats();
}

function statsApiPath() {
  const endpoint = currentStatsSection === 'overview' ? '/api/stats/overview' : '/api/stats';
  return endpoint + (currentStatsYear ? '?year=' + currentStatsYear : '');
}

function pluralTrips(n) {
  if (n === 1) return 'podróż';
  const mod10 = n % 10;
  const mod100 = n % 100;
  return [2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100) ? 'podróże' : 'podróży';
}

function pluralYears(n) {
  if (n === 1) return 'rok';
  const mod10 = n % 10;
  const mod100 = n % 100;
  return [2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100) ? 'lata' : 'lat';
}

function formatCost(value, currency, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '–';
  return Number(value).toLocaleString('pl-PL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + (currency ? ' ' + escapeHtml(currency) : '');
}

function renderCostSummary(summary) {
  if (!summary || !summary.length) return '';
  const rows = summary.map(row => {
    const currency = row.currency || 'PLN';
    return `<div class="cost-summary-row">
      <div class="cost-summary-head">
        <div>
          <div class="cost-currency">${escapeHtml(currency)}</div>
          <div class="cost-sub">${row.trip_count} ${pluralTrips(row.trip_count)} z kosztem · ${row.days || 0} dni</div>
        </div>
        <div class="cost-total">${formatCost(row.total, currency)}</div>
      </div>
      <div class="cost-metrics">
        <div><span>średnio</span><strong>${formatCost(row.avg_trip, currency)}</strong></div>
        <div><span>mediana</span><strong>${formatCost(row.median_trip, currency)}</strong></div>
        <div><span>za dzień</span><strong>${row.avg_per_day == null ? '–' : formatCost(row.avg_per_day, currency, 0) + '/d'}</strong></div>
      </div>
    </div>`;
  }).join('');
  return renderSectionCard({
    title: '💸 Koszty według walut',
    className: 'chart-card cost-summary-card',
    body: `<div class="cost-summary-list">${rows}</div>`,
  });
}

function yearbookTripMeta(trip) {
  const parts = [
    `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`,
    `${trip.days || 0} dni`,
  ];
  if (trip.purpose) parts.push(escapeHtml(trip.purpose));
  if (trip.rating) parts.push(stars(trip.rating));
  if (trip.amount > 0) parts.push(formatCost(trip.amount, trip.currency || 'PLN'));
  return parts.join(' · ');
}

function yearbookHighlight(label, trip, valueHtml, subHtml = '') {
  if (!trip) return '';
  const tag = trip.id ? 'button' : 'div';
  const actionAttr = trip.id ? ` type="button" onclick="openTravel(${trip.id})"` : '';
  return `<${tag} class="yearbook-highlight"${actionAttr}>
    <div class="yearbook-highlight-label">${escapeHtml(label)}</div>
    <div class="yearbook-highlight-value">${valueHtml}</div>
    <div class="yearbook-highlight-name">${escapeHtml(trip.name || '(bez nazwy)')}</div>
    ${subHtml ? `<div class="yearbook-highlight-sub">${subHtml}</div>` : ''}
  </${tag}>`;
}

function yearbookCountryChips(countries, emptyText) {
  if (!countries || !countries.length) return `<span class="yearbook-muted">${escapeHtml(emptyText)}</span>`;
  return countries.map(c => `<span class="yearbook-chip">${escapeHtml(c.name)}${c.trips > 1 ? ` · ${c.trips}×` : ''}</span>`).join('');
}

function renderYearbookChapter(chapter) {
  const monthLabels = ['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const highlights = chapter.highlights || {};
  const topMonth = chapter.top_month;
  const topMonthHtml = topMonth
    ? `<div class="yearbook-highlight">
        <div class="yearbook-highlight-label">Najaktywniejszy miesiąc</div>
        <div class="yearbook-highlight-value">${monthLabels[topMonth.month] || topMonth.month}</div>
        <div class="yearbook-highlight-name">${topMonth.days || 0} dni w trasie</div>
      </div>`
    : '';
  const highlightHtml = [
    yearbookHighlight('Najdłuższa', highlights.longest, `${highlights.longest?.days || 0} dni`, yearbookTripMeta(highlights.longest || {})),
    yearbookHighlight('Najwyżej oceniana', highlights.best_rated, highlights.best_rated?.rating ? stars(highlights.best_rated.rating) : '–', yearbookTripMeta(highlights.best_rated || {})),
    yearbookHighlight('Najwyższy koszt', highlights.priciest, highlights.priciest?.amount > 0 ? formatCost(highlights.priciest.amount, highlights.priciest.currency || 'PLN') : '–', yearbookTripMeta(highlights.priciest || {})),
    topMonthHtml,
  ].filter(Boolean).join('');
  const tripsHtml = (chapter.trips_list || []).length
    ? chapter.trips_list.map(t => `<button class="yearbook-trip" type="button" onclick="openTravel(${t.id})">
        <span class="yearbook-trip-name">${escapeHtml(t.name || '(bez nazwy)')}</span>
        <span class="yearbook-trip-meta">${yearbookTripMeta(t)}</span>
      </button>`).join('')
    : `<div class="yearbook-muted">Brak podróży do pokazania.</div>`;

  return `<section class="yearbook-chapter">
    <div class="yearbook-head">
      <div>
        <div class="yearbook-year">${chapter.year}</div>
        <div class="yearbook-sub">${chapter.trips || 0} ${pluralTrips(chapter.trips || 0)} · ${chapter.days || 0} dni · ${chapter.countries || 0} krajów</div>
      </div>
      <button class="section-action secondary" type="button" onclick="setStatsYear(${chapter.year})">Pokaż rok</button>
    </div>
    ${highlightHtml ? `<div class="yearbook-highlights">${highlightHtml}</div>` : ''}
    <div class="yearbook-countries">
      <div>
        <div class="yearbook-mini-label">Nowe kraje</div>
        <div class="yearbook-chip-row">${yearbookCountryChips(chapter.new_countries, 'Brak nowych krajów')}</div>
      </div>
      <div>
        <div class="yearbook-mini-label">Powroty</div>
        <div class="yearbook-chip-row">${yearbookCountryChips(chapter.returning_countries, 'Brak powrotów')}</div>
      </div>
    </div>
    <div class="yearbook-trips">
      <div class="yearbook-mini-label">Wybrane podróże</div>
      ${tripsHtml}
    </div>
  </section>`;
}

function renderYearbook(yearbook, selectedYear) {
  const source = Array.isArray(yearbook) ? yearbook : [];
  const chapters = selectedYear ? source.filter(chapter => chapter.year === selectedYear) : source;
  if (!chapters.length) return '';
  const subtitle = selectedYear
    ? `Najważniejsze momenty z ${selectedYear}.`
    : 'Lata jako rozdziały: najważniejsze podróże, nowe kraje i powroty.';
  return renderSectionCard({
    title: '📖 Rocznik podróży',
    className: 'chart-card yearbook-card',
    body: `<div class="yearbook-subtitle">${escapeHtml(subtitle)}</div>
      ${chapters.map(renderYearbookChapter).join('')}`,
  });
}

function formatYoyNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return escapeHtml(value);
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toLocaleString('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function yoyDelta(current, prev, lowerBetter = false) {
  if (prev == null) return '';
  const delta = Number(current) - Number(prev);
  if (!Number.isFinite(delta)) return '';
  if (delta === 0) return `<div class="yoy yoy-flat">= ${formatYoyNumber(prev)}</div>`;
  const arrow = delta > 0 ? '↑' : '↓';
  const isGood = lowerBetter ? delta < 0 : delta > 0;
  const cls = isGood ? 'yoy-up' : 'yoy-down';
  const sign = delta > 0 ? '+' : '';
  return `<div class="yoy ${cls}">${arrow} ${sign}${formatYoyNumber(delta)}</div>`;
}

function simpleBar(val, max, color) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0;
  return `<div class="purpose-track"><div class="purpose-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function renderDataQuality(q) {
  if (!q || !q.total) return '';
  const labels = {
    missing_cost: 'Bez kosztu',
    missing_rating: 'Bez oceny',
    missing_locations: 'Bez miejsc',
    missing_reflections: 'Bez wspomnień',
    missing_album: 'Bez albumu',
    incomplete_description: 'Opis niekompletny',
  };
  const rows = Object.entries(labels)
    .map(([key, label]) => ({ key, label, value: q.counts?.[key] || 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const maxV = Math.max(...rows.map(r => r.value), 1);
  const bars = rows.length
    ? rows.map(r => `<div class="purpose-row">
        <div class="purpose-name">${escapeHtml(r.label)}</div>
        ${simpleBar(r.value, maxV, 'var(--orange)')}
        <div class="purpose-count">${r.value}</div>
      </div>`).join('')
    : `<div style="color:var(--text2);font-size:13px">Wszystkie podróże w tym zakresie wyglądają kompletnie.</div>`;
  const attention = (q.needs_attention || []).length
    ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
        ${(q.needs_attention || []).slice(0, 5).map(t => `
          <div class="purpose-row" onclick="openTravel(${t.id})" style="cursor:pointer">
            <div class="purpose-name" style="font-size:11px;line-height:1.35">${escapeHtml(t.name)}</div>
            <div style="font-size:11px;color:var(--text2);text-align:right;max-width:45%">${escapeHtml((t.missing || []).slice(0, 3).join(', '))}</div>
          </div>`).join('')}
      </div>`
    : '';
  return renderSectionCard({
    title: '🧭 Jakość danych',
    className: 'purpose-bar',
    headerClass: 'section-header stats-card-header',
    actionsHtml: '<button class="btn-add-small" onclick="openTodoView(currentStatsYear)">Lista</button>',
    body: `${bars}${attention}`,
  });
}

function renderCountryMilestones(milestones, year) {
  if (!year || !milestones) return '';
  const newCountries = milestones.new || [];
  const returning = milestones.returning || [];
  if (!newCountries.length && !returning.length) return '';
  const newHtml = newCountries.length
    ? newCountries.slice(0, 8).map(c => `<div class="chart-legend-row">
        <div class="chart-legend-dot" style="background:var(--green)"></div>
        <div class="chart-legend-name">${escapeHtml(c.name)}</div>
        <div class="chart-legend-val">${fmtDate(c.first_visit)}</div>
      </div>`).join('')
    : `<div style="color:var(--text2);font-size:13px">Brak nowych krajów w tym roku.</div>`;
  const returningHtml = returning.length
    ? returning.slice(0, 8).map(c => `<div class="chart-legend-row">
        <div class="chart-legend-dot" style="background:var(--blue)"></div>
        <div class="chart-legend-name">${escapeHtml(c.name)}</div>
        <div class="chart-legend-val">${c.trips}×</div>
      </div>`).join('')
    : `<div style="color:var(--text2);font-size:13px">Brak powrotów do wcześniej odwiedzonych krajów.</div>`;
  return renderSectionCard({
    title: `🌱 Kraje w ${year}`,
    body: `<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px">Nowe kraje (${newCountries.length})</div>
      <div class="chart-legend" style="margin-bottom:12px">${newHtml}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px">Powroty (${returning.length})</div>
      <div class="chart-legend">${returningHtml}</div>`,
  });
}

function countryDurationLabel(days) {
  const n = Number(days || 0);
  if (n < 31) return `${n} dni`;
  if (n < 365) return `${Math.round(n / 30)} mies.`;
  return `${(n / 365).toFixed(1).replace('.', ',')} lat`;
}

function countryHistoryRows(rows, { title, value, sub, empty }) {
  const body = rows && rows.length
    ? rows.slice(0, 5).map(c => `<div class="country-history-row">
        <div class="country-history-main">
          <div class="country-history-name">${escapeHtml(c.name)}</div>
          <div class="country-history-sub">${escapeHtml(sub(c))}</div>
        </div>
        <div class="country-history-value">${value(c)}</div>
      </div>`).join('')
    : `<div class="country-history-empty">${escapeHtml(empty)}</div>`;
  return `<div class="country-history-panel">
    <div class="country-history-panel-title">${escapeHtml(title)}</div>
    ${body}
  </div>`;
}

function renderCountryHistory(history, year) {
  if (!history || !history.summary || !history.summary.countries) return '';
  const summary = history.summary;
  const shownCountries = year ? summary.active_countries : summary.countries;
  const scopeLabel = year ? `kraje aktywne w ${year}` : 'kraje w historii podróży';
  const firstMetricLabel = year ? `W ${year}` : 'W historii';
  const avgDays = Number(summary.avg_days_per_country || 0).toLocaleString('pl-PL', { maximumFractionDigits: 1 });

  return renderSectionCard({
    title: '🌍 Historia krajów',
    className: 'chart-card country-history-card',
    body: `<div class="country-history-subtitle">${escapeHtml(scopeLabel)}</div>
      <div class="country-history-metrics">
        <div><strong>${shownCountries || 0}</strong><span>${escapeHtml(firstMetricLabel)}</span></div>
        <div><strong>${summary.returning_countries || 0}</strong><span>z powrotami</span></div>
        <div><strong>${summary.single_visit_countries || 0}</strong><span>tylko raz</span></div>
        <div><strong>${avgDays}</strong><span>śr. dni/kraj</span></div>
      </div>
      <div class="country-history-grid">
        ${countryHistoryRows(history.top_returns || [], {
        title: 'Najczęstsze powroty',
        value: c => `${c.trips}×`,
        sub: c => `${c.days_spent || 0} dni · ${c.years_visited || 0} ${pluralYears(c.years_visited || 0)} · ostatnio ${fmtDate(c.last_visit)}`,
        empty: 'Brak krajów z więcej niż jedną podróżą.',
      })}
      ${countryHistoryRows(history.most_regular || [], {
        title: 'Najregularniej odwiedzane',
        value: c => `${c.years_visited || 0} ${pluralYears(c.years_visited || 0)}`,
        sub: c => `${c.trips || 0} ${pluralTrips(c.trips || 0)} · ${c.days_spent || 0} dni`,
        empty: 'Jeszcze brak krajów odwiedzanych w wielu latach.',
      })}
      ${countryHistoryRows(history.longest_absences || [], {
        title: 'Najdłużej niewidziane',
        value: c => countryDurationLabel(c.days_since_last_visit),
        sub: c => `ostatnia wizyta ${fmtDate(c.last_visit)} · ${c.trips || 0}×`,
        empty: 'Brak zakończonych wizyt do policzenia przerwy.',
      })}
      ${countryHistoryRows(history.longest_gaps || [], {
        title: 'Najdłuższe przerwy między wizytami',
        value: c => countryDurationLabel(c.longest_gap_days),
        sub: c => `${fmtDate(c.longest_gap_from)} → ${fmtDate(c.longest_gap_to)}`,
        empty: 'Brak powrotów z policzalną przerwą.',
      })}
      ${countryHistoryRows(history.only_once || [], {
        title: 'Kraje odwiedzone tylko raz',
        value: c => fmtDate(c.first_visit),
        sub: c => `${c.days_spent || 0} dni · ostatnio ${fmtDate(c.last_visit)}`,
        empty: 'Każdy kraj z tego zakresu ma już powrót.',
      })}
      </div>`,
  });
}

function hallOfFameRecords(hof, monthLabels = []) {
  if (!hof) return [];
  return [
    hof.longest && {
      key: 'longest',
      icon: '📅',
      title: 'Najdłuższa',
      value: `${hof.longest.value} dni`,
      name: hof.longest.name,
      id: hof.longest.id,
      tone: '#1a6fdb',
      soft: 'rgba(26,111,219,0.12)',
      featured: true,
    },
    hof.priciest && {
      key: 'priciest',
      icon: '💰',
      title: 'Najdroższa',
      value: `${Math.round(hof.priciest.value).toLocaleString('pl-PL')} ${hof.priciest.currency}`,
      name: hof.priciest.name,
      id: hof.priciest.id,
      tone: '#e11d48',
      soft: 'rgba(225,29,72,0.12)',
      featured: true,
    },
    hof.best_rated && {
      key: 'best_rated',
      icon: '⭐',
      title: 'Najwyżej oceniana',
      valueHtml: stars(hof.best_rated.value),
      name: hof.best_rated.name,
      id: hof.best_rated.id,
      tone: '#f97316',
      soft: 'rgba(249,115,22,0.13)',
      featured: true,
    },
    hof.most_places && {
      key: 'most_places',
      icon: '📍',
      title: 'Najwięcej miejsc',
      value: `${hof.most_places.value} miejsc`,
      name: hof.most_places.name,
      id: hof.most_places.id,
      tone: '#7c3aed',
      soft: 'rgba(124,58,237,0.12)',
    },
    hof.most_flights && {
      key: 'most_flights',
      icon: '🛫',
      title: 'Najwięcej lotów',
      value: `${hof.most_flights.value} lotów`,
      name: hof.most_flights.name,
      id: hof.most_flights.id,
      tone: '#0891b2',
      soft: 'rgba(8,145,178,0.12)',
    },
    hof.most_countries && {
      key: 'most_countries',
      icon: '🌍',
      title: 'Najwięcej krajów',
      value: `${hof.most_countries.value} krajów`,
      name: hof.most_countries.name,
      id: hof.most_countries.id,
      tone: '#059669',
      soft: 'rgba(5,150,105,0.12)',
    },
    hof.top_country && {
      key: 'top_country',
      icon: '🏳️',
      title: 'Najczęstszy kraj',
      value: `${hof.top_country.visits}×`,
      name: hof.top_country.name,
      sub: `${hof.top_country.days} dni`,
      tone: '#d97706',
      soft: 'rgba(217,119,6,0.13)',
    },
    hof.longest_gap && {
      key: 'longest_gap',
      icon: '⏳',
      title: 'Najdłuższa przerwa',
      value: `${hof.longest_gap.value} dni`,
      name: hof.longest_gap.name,
      id: hof.longest_gap.id,
      tone: '#9f1239',
      soft: 'rgba(159,18,57,0.12)',
    },
    hof.longest_streak && {
      key: 'longest_streak',
      icon: '🔥',
      title: 'Najdłuższa seria',
      value: `${hof.longest_streak.value} dni`,
      name: `${fmtDate(hof.longest_streak.start_date)} – ${fmtDate(hof.longest_streak.end_date)}`,
      tone: '#dc2626',
      soft: 'rgba(220,38,38,0.12)',
    },
    hof.best_month && {
      key: 'best_month',
      icon: '🗓',
      title: 'Najlepszy miesiąc',
      value: `${hof.best_month.value} dni`,
      name: `${monthLabels[hof.best_month.month] || hof.best_month.month} ${hof.best_month.year}`,
      tone: '#4f46e5',
      soft: 'rgba(79,70,229,0.12)',
    },
  ].filter(Boolean);
}

function renderHallOfFameCard(record) {
  const classes = ['hof-card'];
  if (record.featured) classes.push('featured');
  if (record.id) classes.push('hof-clickable');
  const style = `--hof-accent:${record.tone};--hof-soft:${record.soft}`;
  const value = record.valueHtml != null ? record.valueHtml : escapeHtml(record.value);
  const body = `<div class="hof-icon">${record.icon}</div>
    <div class="hof-main">
      <div class="hof-cat">${escapeHtml(record.title)}</div>
      <div class="hof-value">${value}</div>
      <div class="hof-name">${escapeHtml(record.name)}</div>
      ${record.sub ? `<div class="hof-sub">${escapeHtml(record.sub)}</div>` : ''}
    </div>`;
  if (record.id) {
    const ariaLabel = `Otwórz podróż: ${record.title}, ${record.name}`;
    return `<button type="button" class="${escapeAttr(classes.join(' '))}" style="${escapeAttr(style)}" aria-label="${escapeAttr(ariaLabel)}" onclick="openTravel(${record.id})">${body}</button>`;
  }
  return `<div class="${escapeAttr(classes.join(' '))}" style="${escapeAttr(style)}">${body}</div>`;
}

function renderHallOfFame(hof, monthLabels = []) {
  const records = hallOfFameRecords(hof, monthLabels);
  if (!records.length) return '';
  return `<div class="hof-section">
    <div class="section-title hof-title-row">🏆 Hall of Fame <span class="hof-hint">${records.length} rekordów</span></div>
    <div class="hof-grid">${records.map(renderHallOfFameCard).join('')}</div>
  </div>`;
}

function formatAmountLines(currencies) {
  if (!currencies.length) return '–';
  return currencies.map(([cur, amt]) =>
    `<span class="stat-amount-line">${Math.round(amt).toLocaleString('pl-PL')} <span>${escapeHtml(cur)}</span></span>`
  ).join('');
}

function pluralMonths(n) {
  if (n === 1) return 'miesiąc';
  return n < 5 ? 'miesiące' : 'miesięcy';
}

function renderOverviewContext(s, currentYear) {
  const cards = [];
  if (!currentYear && s.current_trip) {
    const ct = s.current_trip;
    cards.push(renderContextCard({
      icon: '🧳',
      label: 'Aktualnie w trasie',
      value: ct.name,
      sub: `dzień ${ct.days_in} z ${ct.days_total}`,
      onclick: `openTravel(${ct.id})`,
    }));
  }
  if (!currentYear && s.streak_months > 0) {
    cards.push(renderContextCard({
      icon: '🔥',
      label: 'Streak',
      value: `${s.streak_months} ${pluralMonths(s.streak_months)} z rzędu`,
      sub: 'co najmniej jedna podróż',
    }));
  }
  if (s.progress) {
    cards.push(renderContextCard({
      icon: '✍️',
      label: 'Kompletność opisów',
      value: `${s.progress.described}/${s.progress.total}`,
      sub: 'podróży opisanych',
    }));
  }
  if (!cards.length) return '';
  return `<div class="stats-context-grid">${cards.join('')}</div>`;
}

function renderOverviewMetrics(s, prev, currentYear, currencies) {
  const cards = [
    renderStatSummaryCard({
      tone: 'teal',
      icon: '🛫',
      value: s.flights,
      label: 'Lotów',
      extraHtml: prev ? yoyDelta(s.flights, prev.flights) : '',
    }),
    renderStatSummaryCard({
      tone: 'green',
      icon: '📷',
      value: s.albums,
      label: 'Albumów',
      extraHtml: prev ? yoyDelta(s.albums, prev.albums) : '',
    }),
    renderStatSummaryCard({
      tone: 'orange',
      icon: '⭐',
      value: s.avg_rating || '–',
      label: 'Śr. ocena',
      extraHtml: prev ? yoyDelta(s.avg_rating, prev.avg_rating) : '',
    }),
    renderStatSummaryCard({
      tone: 'blue',
      icon: '📆',
      value: s.avg_trip_days || '–',
      label: 'Śr. długość (dni)',
    }),
    renderStatSummaryCard({
      tone: 'rose',
      icon: '💰',
      valueHtml: formatAmountLines(currencies),
      label: currencies.length === 1 ? `${currencies[0][0]} wydane` : 'Wydane',
    }),
  ];
  if (!currentYear && s.locations != null) {
    cards.push(renderStatSummaryCard({
      tone: 'purple',
      icon: '🗂',
      value: s.locations,
      label: 'Miejsc w bazie',
    }));
  }
  return `<div class="stats-grid">${cards.join('')}</div>`;
}

async function renderStats() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Statystyki</div></div>` + skeletonCards(3);
  const s = await api(statsApiPath());
  if (s.error) {
    view.innerHTML = emptyState({ icon: '📊', title: 'Nie udało się wczytać statystyk', message: s.error });
    return;
  }

  const months = ['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  const yearsDesc = (s.by_year || []).map(y => y.year).sort((a, b) => b - a);
  const filterBar = `<div class="sort-bar" style="margin-top:10px">
    <button class="sort-btn${!currentStatsYear ? ' active' : ''}" onclick="setStatsYear(null)">Wszystkie</button>
    ${yearsDesc.map(y => `<button class="sort-btn${currentStatsYear === y ? ' active' : ''}" onclick="setStatsYear(${y})">${y}</button>`).join('')}
  </div>`;

  let html = `<div class="page-header"><div class="page-title">Statystyki</div>${filterBar}</div>`;
  html += renderTabs(STATS_SECTIONS, currentStatsSection, {
    containerClass: 'stats-section-tabs',
    buttonClass: 'stats-section-tab',
    ariaLabel: 'Sekcje statystyk',
    onClick: section => `setStatsSection('${section.id}')`,
  });
  const heroLabel = currentStatsYear ? `Aktywność w ${currentStatsYear}` : 'Wszystkie podróże';
  const heroCurrencies = Object.entries(s.amount_by_currency || {});
  const prev = s.prev_period;

  if (currentStatsSection === 'overview') {
  html += `<div class="hero-card">
    <div class="hero-label">${escapeHtml(heroLabel)}${prev ? ` &nbsp;·&nbsp; <span style="opacity:0.6">vs ${prev.year}</span>` : ''}</div>
    ${renderHeroMetrics([
      { value: s.total_trips, label: currentStatsYear ? 'podróży w roku' : 'podróży', extraHtml: prev ? yoyDelta(s.total_trips, prev.total_trips) : '' },
      { value: s.total_days, label: 'dni w trasie', extraHtml: prev ? yoyDelta(s.total_days, prev.total_days) : '' },
      { value: s.countries, label: 'krajów', extraHtml: prev ? yoyDelta(s.countries, prev.countries) : '' },
      { value: s.visited_locations || 0, label: 'odwiedzonych miejsc', extraHtml: prev ? yoyDelta(s.visited_locations || 0, prev.visited_locations || 0) : '' },
    ])}
  </div>`;
  html += renderOverviewContext(s, currentStatsYear);
  html += renderOverviewMetrics(s, prev, currentStatsYear, heroCurrencies);
  html += renderHallOfFame(s.hall_of_fame, months);
  }

  html += '<div class="stats-2col">';
  let sectionItems = 0;
  if (currentStatsSection === 'yearbook') {
    const yearbookHtml = renderYearbook(s.yearbook, currentStatsYear);
    if (yearbookHtml) {
      html += yearbookHtml;
      sectionItems++;
    }
  }
  if (currentStatsSection === 'costs') {
    const costSummaryHtml = renderCostSummary(s.cost_summary);
    if (costSummaryHtml) {
      html += costSummaryHtml;
      sectionItems++;
    }
  }
  if (currentStatsSection === 'quality') {
    const dataQualityHtml = renderDataQuality(s.data_quality);
    if (dataQualityHtml) {
      html += dataQualityHtml;
      sectionItems++;
    }
  }
  if (currentStatsSection === 'countries') {
    const countryMilestonesHtml = renderCountryMilestones(s.country_milestones, currentStatsYear);
    const countryHistoryHtml = renderCountryHistory(s.country_history, currentStatsYear);
    if (countryMilestonesHtml) {
      html += countryMilestonesHtml;
      sectionItems++;
    }
    if (countryHistoryHtml) {
      html += countryHistoryHtml;
      sectionItems++;
    }
  }
  if (currentStatsSection === 'overview' && s.purposes && s.purposes.length) {
    html += renderSectionCard({
      title: '🎯 Cel podróży',
      body: svgDonut(s.purposes.map(p => ({ name: p.name || 'Inne', count: p.count }))),
    });
    sectionItems++;
  }
  if (currentStatsSection === 'participants' && s.participants && s.participants.length) {
    html += renderSectionCard({
      title: '👥 Uczestnicy',
      body: renderRankingBars(s.participants, {
          nameKey: 'name',
          valueKey: 'trips',
          color: 'var(--blue)',
          valueLabel: p => `${p.trips} ${pluralTrips(p.trips)} · ${p.days || 0} dni`,
        }),
    });
    sectionItems++;
  }
  if (currentStatsSection === 'countries' && s.top_countries && s.top_countries.length) {
    html += renderSectionCard({
      title: '🌍 Top krajów',
      body: renderRankingBars(s.top_countries, {
          nameKey: 'country',
          valueKey: 'visits',
          color: 'var(--green)',
          valueLabel: c => `${c.visits}× · ${c.days_spent || 0} dni`,
        }),
    });
    sectionItems++;
  }
  if (currentStatsSection === 'countries' && s.top_places && s.top_places.length) {
    html += renderSectionCard({
      title: '📍 Top miast i wysp',
      body: renderRankingBars(s.top_places.slice(0, 5), {
          nameKey: 'location_name',
          valueKey: 'visit_count',
          color: 'var(--purple)',
          valueLabel: p => `${p.visit_count}× · ${p.days_spent || 0} dni`,
        }),
    });
    sectionItems++;
    const mapped = s.top_places.filter(p => p.lat != null && p.lon != null);
    if (mapped.length) {
      html += renderSectionCard({
        title: '🗺 Top miejsca na mapie',
        className: 'chart-card stats-map-card',
        body: '<div id="stats-mini-map" class="stats-mini-map"></div>',
      });
      sectionItems++;
    }
  }
  if (currentStatsSection === 'overview' && !currentStatsYear && s.heatmap && s.heatmap.length) {
    html += renderSectionCard({
      title: '🗓 Kalendarz podróży',
      className: 'chart-card heatmap-card',
      body: svgHeatmap(s.heatmap),
    });
    sectionItems++;
  } else if (currentStatsSection === 'overview' && currentStatsYear && s.by_month && s.by_month.length) {
    const maxM = Math.max(...s.by_month.map(m => m.days), 1);
    const rows = s.by_month.map(m =>
      '<div class="purpose-row"><div class="purpose-name">'+months[m.month]+'</div>'+simpleBar(m.days,maxM,'var(--orange)')+'<div class="purpose-count">'+m.days+'</div></div>'
    ).join('');
    html += renderSectionCard({
      title: '🗓 Dni w trasie wg miesięcy',
      className: 'purpose-bar',
      body: rows,
    });
    sectionItems++;
  }
  if (currentStatsSection === 'costs' && s.top_expensive && s.top_expensive.length) {
    const rows = s.top_expensive.map((t, i) =>
      '<div class="purpose-row"><div class="purpose-name" style="font-size:11px;line-height:1.4">'+(i+1)+'. '+escapeHtml(t.name)+'</div><div style="min-width:100px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.amount).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'</div></div>'
    ).join('');
    html += renderSectionCard({
      title: '💰 Top 10 najdroższych wyjazdów',
      className: 'purpose-bar',
      body: rows,
    });
    sectionItems++;
  }
  if (currentStatsSection === 'costs' && s.cost_per_day && s.cost_per_day.length) {
    const rows = s.cost_per_day.map(t =>
      '<div class="purpose-row"><div class="purpose-name" style="font-size:11px">'+escapeHtml(t.name)+'</div><div style="min-width:110px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.cost_per_day).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'/d</div></div>'
    ).join('');
    html += renderSectionCard({
      title: '💸 Najdroższe wyjazdy per dzień',
      className: 'purpose-bar',
      body: rows,
    });
    sectionItems++;
  }
  if (sectionItems === 0 && currentStatsSection !== 'overview') {
    const emptyMessages = {
      yearbook: 'Brak podróży do pokazania w roczniku.',
      countries: 'Brak danych o krajach i miejscach dla wybranego zakresu.',
      costs: 'Brak wpisanych kosztów dla wybranego zakresu.',
      participants: 'Brak uczestników przypisanych do podróży w tym zakresie.',
      quality: 'Brak podróży do oceny jakości danych w tym zakresie.',
    };
    html += renderEmptyCard(
      STATS_SECTIONS.find(section => section.id === currentStatsSection)?.label || 'Brak danych',
      emptyMessages[currentStatsSection] || 'Brak danych dla wybranego zakresu.',
      {
        className: 'chart-card stats-empty-card',
        messageClass: 'stats-empty-text',
      }
    );
  }
  html += '</div><div style="height:16px"></div>';
  view.innerHTML = html;

  initStatsMiniMap(s.top_places || []);
}

function initStatsMiniMap(places) {
  const el = document.getElementById('stats-mini-map');
  if (!el || typeof L === 'undefined') return;
  const mapped = places.filter(p => p.lat != null && p.lon != null);
  if (!mapped.length) return;

  const m = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(m);

  const markers = mapped.map(p => {
    const icon = createColorIcon(p.location_type);
    const marker = L.marker([p.lat, p.lon], { icon });
    marker.bindTooltip(`${p.location_name} · ${p.visit_count}×`, { direction: 'top', offset: [0, -32] });
    marker.on('click', () => showTravelOnMap([p.id]));
    return marker;
  });
  const group = L.featureGroup(markers).addTo(m);
  m.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 6 });
}
