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
