function yearbookTripMeta(trip) {
  const parts = [
    `${fmtDate(trip.start_date)} - ${fmtDate(trip.end_date)}`,
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
  return countries.map(c => `<span class="yearbook-chip">${escapeHtml(c.name)}${c.trips > 1 ? ` · ${c.trips}x` : ''}</span>`).join('');
}

function yearbookMonthLabel(month) {
  const monthLabels = ['', 'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
  return monthLabels[Number(month)] || month;
}

function renderYearbookMetric(value, label) {
  return `<div class="yearbook-story-metric">
    <strong>${escapeHtml(String(value))}</strong>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

function renderYearbookStory(chapter) {
  const story = chapter.story || {};
  const featuredTrip = chapter.featured_trip || chapter.highlights?.best_rated || chapter.highlights?.longest;
  const featuredHtml = featuredTrip
    ? `<button class="yearbook-featured" type="button" onclick="openTravel(${featuredTrip.id})">
        <span class="yearbook-mini-label">Podróż roku</span>
        <strong>${escapeHtml(featuredTrip.name || '(bez nazwy)')}</strong>
        <span>${yearbookTripMeta(featuredTrip)}</span>
      </button>`
    : `<div class="yearbook-featured yearbook-featured-empty">
        <span class="yearbook-mini-label">Podróż roku</span>
        <strong>Brak danych</strong>
      </div>`;

  return `<div class="yearbook-story">
    <div class="yearbook-story-copy">
      <div class="yearbook-story-title">${escapeHtml(story.title || `Rok ${chapter.year}`)}</div>
      <p>${escapeHtml(story.summary || 'Najważniejsze liczby i podróże z tego roku są zebrane poniżej.')}</p>
      <div class="yearbook-story-metrics">
        ${renderYearbookMetric(chapter.trips || 0, pluralTrips(chapter.trips || 0))}
        ${renderYearbookMetric(chapter.days || 0, 'dni')}
        ${renderYearbookMetric(chapter.countries || 0, 'krajów')}
        ${renderYearbookMetric(chapter.new_countries_count || 0, 'nowych')}
        ${renderYearbookMetric(chapter.returning_countries_count || 0, 'powrotów')}
      </div>
    </div>
    ${featuredHtml}
  </div>`;
}

function renderYearbookMonths(chapter) {
  const monthMap = new Map((chapter.months || []).map(item => [Number(item.month), Number(item.days || 0)]));
  if (!monthMap.size) return '';
  const maxDays = Math.max(...monthMap.values(), 1);
  const bars = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const days = monthMap.get(month) || 0;
    const share = days ? Math.max(12, Math.round((days / maxDays) * 100)) : 0;
    return `<div class="yearbook-month" title="${yearbookMonthLabel(month)}: ${days} dni">
      <div class="yearbook-month-track">
        <span class="yearbook-month-bar" style="--month-share: ${share}%"></span>
      </div>
      <span>${yearbookMonthLabel(month)}</span>
    </div>`;
  }).join('');

  return `<div class="yearbook-months">
    <div class="yearbook-mini-label">Rytm roku</div>
    <div class="yearbook-month-grid">${bars}</div>
  </div>`;
}

function renderYearbookChapter(chapter) {
  const highlights = chapter.highlights || {};
  const topMonth = chapter.top_month;
  const topMonthHtml = topMonth
    ? `<div class="yearbook-highlight">
        <div class="yearbook-highlight-label">Najaktywniejszy miesiąc</div>
        <div class="yearbook-highlight-value">${yearbookMonthLabel(topMonth.month)}</div>
        <div class="yearbook-highlight-name">${topMonth.days || 0} dni w trasie</div>
      </div>`
    : '';
  const highlightHtml = [
    yearbookHighlight('Najdłuższa', highlights.longest, `${highlights.longest?.days || 0} dni`, yearbookTripMeta(highlights.longest || {})),
    yearbookHighlight('Najwyżej oceniana', highlights.best_rated, highlights.best_rated?.rating ? stars(highlights.best_rated.rating) : '-', yearbookTripMeta(highlights.best_rated || {})),
    yearbookHighlight('Najwyższy koszt', highlights.priciest, highlights.priciest?.amount > 0 ? formatCost(highlights.priciest.amount, highlights.priciest.currency || 'PLN') : '-', yearbookTripMeta(highlights.priciest || {})),
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
    ${renderYearbookStory(chapter)}
    ${renderYearbookMonths(chapter)}
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
    : 'Lata jako rozdziały: rytm podróży, podróż roku, nowe kraje i powroty.';
  return renderSectionCard({
    title: 'Rocznik podróży',
    className: 'chart-card yearbook-card',
    body: `<div class="yearbook-subtitle">${escapeHtml(subtitle)}</div>
      ${chapters.map(renderYearbookChapter).join('')}`,
  });
}
