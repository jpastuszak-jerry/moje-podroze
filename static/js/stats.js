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

function svgGradientBars(data, { nameKey, valueKey, valueLabel = null, color = 'var(--blue)' }) {
  if (!data || !data.length) return '';
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  return data.map(d => {
    const pct = Math.max(8, Math.round(((d[valueKey] || 0) / maxV) * 100));
    const label = valueLabel ? valueLabel(d) : d[valueKey];
    return `<div class="gbar-row">
      <div class="gbar-name">${escapeHtml(d[nameKey] || '-')}</div>
      <div class="gbar-track"><div class="gbar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="gbar-val">${label}</div>
    </div>`;
  }).join('');
}

let currentStatsYear = null;

function setStatsYear(y) {
  currentStatsYear = y;
  renderStats();
}

function pluralTrips(n) {
  return n === 1 ? 'podróż' : (n < 5 ? 'podróże' : 'podróży');
}

function yoyDelta(current, prev, lowerBetter = false) {
  if (prev == null) return '';
  const delta = current - prev;
  if (delta === 0) return `<div class="yoy yoy-flat">= ${prev}</div>`;
  const arrow = delta > 0 ? '↑' : '↓';
  const isGood = lowerBetter ? delta < 0 : delta > 0;
  const cls = isGood ? 'yoy-up' : 'yoy-down';
  const sign = delta > 0 ? '+' : '';
  return `<div class="yoy ${cls}">${arrow} ${sign}${delta}</div>`;
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
  return `<div class="purpose-bar">
    <div class="section-title">🧭 Jakość danych</div>
    ${bars}
    ${attention}
  </div>`;
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
  return `<div class="chart-card">
    <div class="section-title">🌱 Kraje w ${year}</div>
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px">Nowe kraje (${newCountries.length})</div>
    <div class="chart-legend" style="margin-bottom:12px">${newHtml}</div>
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px">Powroty (${returning.length})</div>
    <div class="chart-legend">${returningHtml}</div>
  </div>`;
}

async function renderStats() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Statystyki</div></div>` + skeletonCards(3);
  const url = '/api/stats' + (currentStatsYear ? '?year=' + currentStatsYear : '');
  const s = await api(url);
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
  const heroLabel = currentStatsYear ? `Aktywność w ${currentStatsYear}` : 'Wszystkie podróże';
  const heroCurrencies = Object.entries(s.amount_by_currency || {});
  const heroAmount = heroCurrencies.length
    ? heroCurrencies.map(([cur, amt]) => `${Math.round(amt).toLocaleString('pl-PL')} <span class="hero-cur">${escapeHtml(cur)}</span>`).join(' &nbsp;·&nbsp; ')
    : '';
  const prev = s.prev_period;

  html += `<div class="hero-card">
    <div class="hero-label">${escapeHtml(heroLabel)}${prev ? ` &nbsp;·&nbsp; <span style="opacity:0.6">vs ${prev.year}</span>` : ''}</div>
    <div class="hero-numbers">
      <div class="hero-number"><div class="hero-val">${s.total_trips}</div><div class="hero-key">${currentStatsYear ? 'podróży w roku' : 'podróży'}</div>${prev ? yoyDelta(s.total_trips, prev.total_trips) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.total_days}</div><div class="hero-key">dni w trasie</div>${prev ? yoyDelta(s.total_days, prev.total_days) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.countries}</div><div class="hero-key">krajów</div>${prev ? yoyDelta(s.countries, prev.countries) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.flights}</div><div class="hero-key">lotów</div>${prev ? yoyDelta(s.flights, prev.flights) : ''}</div>
    </div>
    ${heroAmount ? `<div class="hero-amount">${heroAmount}</div>` : ''}
  </div>`;

  if (!currentStatsYear && (s.current_trip || s.streak_months > 0)) {
    html += '<div class="streak-strip">';
    if (s.current_trip) {
      const ct = s.current_trip;
      html += `<div class="streak-card streak-active" onclick="openTravel(${ct.id})">
        <div class="streak-icon">🧳</div>
        <div class="streak-body">
          <div class="streak-label">Aktualnie w trasie</div>
          <div class="streak-value">${escapeHtml(ct.name)}</div>
          <div class="streak-sub">dzień ${ct.days_in} z ${ct.days_total}</div>
        </div>
      </div>`;
    }
    if (s.streak_months > 0) {
      html += `<div class="streak-card streak-fire">
        <div class="streak-icon">🔥</div>
        <div class="streak-body">
          <div class="streak-label">Streak</div>
          <div class="streak-value">${s.streak_months} ${s.streak_months === 1 ? 'miesiąc' : (s.streak_months < 5 ? 'miesiące' : 'miesięcy')} z rzędu</div>
          <div class="streak-sub">co najmniej jedna podróż</div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  if (s.hall_of_fame) {
    const hof = s.hall_of_fame;
    const grads = [
      'linear-gradient(135deg,#1a6fdb,#0d47a1)',
      'linear-gradient(135deg,#e11d48,#9f1239)',
      'linear-gradient(135deg,#f97316,#c2410c)',
      'linear-gradient(135deg,#7c3aed,#4c1d95)',
      'linear-gradient(135deg,#0891b2,#164e63)',
    ];
    const records = [
      hof.longest && { icon:'📅', title:'Najdłuższa', value: hof.longest.value+' dni', id: hof.longest.id, name: hof.longest.name },
      hof.priciest && { icon:'💰', title:'Najdroższa', value: Math.round(hof.priciest.value).toLocaleString('pl-PL')+' '+hof.priciest.currency, id: hof.priciest.id, name: hof.priciest.name },
      hof.best_rated && { icon:'⭐', title:'Najwyżej oceniana', value: stars(hof.best_rated.value), id: hof.best_rated.id, name: hof.best_rated.name },
      hof.most_places && { icon:'📍', title:'Najwięcej miejsc', value: hof.most_places.value+' miejsc', id: hof.most_places.id, name: hof.most_places.name },
      hof.most_flights && { icon:'🛫', title:'Najwięcej lotów', value: hof.most_flights.value+' lotów', id: hof.most_flights.id, name: hof.most_flights.name },
    ].filter(Boolean);
    if (records.length) {
      html += '<div class="hof-section">';
      html += `<div class="section-title hof-title-row">🏆 Hall of Fame <span class="hof-hint">${records.length} kategorie · przesuń →</span></div>`;
      html += '<div class="hof-scroll-wrap"><div class="hof-scroll">';
      records.forEach((r, i) => {
        html += `<div class="hof-card" onclick="openTravel(${r.id})" style="background:${grads[i % grads.length]}">
          <div class="hof-icon">${r.icon}</div>
          <div class="hof-cat">${escapeHtml(r.title)}</div>
          <div class="hof-name">${escapeHtml(r.name)}</div>
          <div class="hof-value">${r.value}</div>
        </div>`;
      });
      html += '</div><div class="hof-fade"></div></div>';
      html += '<div class="hof-dots">' + records.map((_, i) => `<div class="hof-dot${i === 0 ? ' active' : ''}"></div>`).join('') + '</div>';
      html += '</div>';
    }
  }

  html += '<div class="stats-grid">';
  html += '<div class="stat-card sc-blue"><div class="stat-icon">✈️</div><div class="stat-value">'+s.total_trips+'</div><div class="stat-label">'+(currentStatsYear?'Podróży w roku':'Podróży')+'</div>'+(prev?yoyDelta(s.total_trips, prev.total_trips):'')+'</div>';
  html += '<div class="stat-card sc-orange"><div class="stat-icon">📅</div><div class="stat-value">'+s.total_days+'</div><div class="stat-label">Dni w trasie</div>'+(prev?yoyDelta(s.total_days, prev.total_days):'')+'</div>';
  html += '<div class="stat-card sc-green"><div class="stat-icon">🌍</div><div class="stat-value">'+s.countries+'</div><div class="stat-label">Krajów</div>'+(prev?yoyDelta(s.countries, prev.countries):'')+'</div>';
  html += '<div class="stat-card sc-purple"><div class="stat-icon">📍</div><div class="stat-value">'+(s.visited_locations || 0)+'</div><div class="stat-label">Odwiedzonych miejsc</div>'+(prev?yoyDelta(s.visited_locations || 0, prev.visited_locations || 0):'')+'</div>';
  html += '<div class="stat-card sc-teal"><div class="stat-icon">🛫</div><div class="stat-value">'+s.flights+'</div><div class="stat-label">Lotów</div>'+(prev?yoyDelta(s.flights, prev.flights):'')+'</div>';
  html += '<div class="stat-card sc-green"><div class="stat-icon">📷</div><div class="stat-value">'+s.albums+'</div><div class="stat-label">Albumów</div>'+(prev?yoyDelta(s.albums, prev.albums):'')+'</div>';
  html += '<div class="stat-card sc-orange"><div class="stat-icon">⭐</div><div class="stat-value">'+(s.avg_rating||'–')+'</div><div class="stat-label">Śr. ocena</div>'+(prev?yoyDelta(s.avg_rating, prev.avg_rating):'')+'</div>';
  const currencies = Object.entries(s.amount_by_currency || {});
  if (currencies.length === 0) {
    html += '<div class="stat-card sc-rose"><div class="stat-icon">💰</div><div class="stat-value">–</div><div class="stat-label">Wydane</div></div>';
  } else if (currencies.length === 1) {
    const [cur, amt] = currencies[0];
    html += '<div class="stat-card sc-rose"><div class="stat-icon">💰</div><div class="stat-value" style="font-size:15px">'+Math.round(amt).toLocaleString('pl-PL')+'</div><div class="stat-label">'+escapeHtml(cur)+' wydane</div></div>';
  } else {
    const lines = currencies.map(([cur, amt]) => `<div style="font-size:13px;font-weight:700;line-height:1.2">${Math.round(amt).toLocaleString('pl-PL')} <span style="font-size:10px;font-weight:600;opacity:0.8">${escapeHtml(cur)}</span></div>`).join('');
    html += '<div class="stat-card sc-rose"><div class="stat-icon">💰</div><div style="display:flex;flex-direction:column;gap:3px;align-items:center">'+lines+'</div><div class="stat-label" style="margin-top:4px">Wydane</div></div>';
  }
  html += '<div class="stat-card sc-blue"><div class="stat-icon">📆</div><div class="stat-value">'+(s.avg_trip_days||'–')+'</div><div class="stat-label">Śr. długość (dni)</div></div>';
  if (s.progress) html += '<div class="stat-card sc-purple"><div class="stat-icon">✍️</div><div class="stat-value">'+s.progress.described+'/'+s.progress.total+'</div><div class="stat-label">Opisanych</div></div>';
  if (!currentStatsYear) html += '<div class="stat-card sc-teal"><div class="stat-icon">🗂</div><div class="stat-value">'+s.locations+'</div><div class="stat-label">Miejsc w bazie</div></div>';
  html += '</div>';

  html += '<div class="stats-2col">';
  html += renderDataQuality(s.data_quality);
  html += renderCountryMilestones(s.country_milestones, currentStatsYear);
  if (s.purposes && s.purposes.length) {
    html += '<div class="chart-card"><div class="section-title">🎯 Cel podróży</div>'
      + svgDonut(s.purposes.map(p => ({ name: p.name || 'Inne', count: p.count }))) + '</div>';
  }
  if (s.participants && s.participants.length) {
    html += '<div class="chart-card"><div class="section-title">👥 Uczestnicy</div>'
      + svgGradientBars(s.participants, {
          nameKey: 'name',
          valueKey: 'trips',
          color: 'var(--blue)',
          valueLabel: p => `${p.trips} ${pluralTrips(p.trips)} · ${p.days || 0} dni`,
        }) + '</div>';
  }
  if (s.top_countries && s.top_countries.length) {
    html += '<div class="chart-card"><div class="section-title">🌍 Top krajów</div>'
      + svgGradientBars(s.top_countries, {
          nameKey: 'country',
          valueKey: 'visits',
          color: 'var(--green)',
          valueLabel: c => `${c.visits}× · ${c.days_spent || 0} dni`,
        }) + '</div>';
  }
  if (s.top_places && s.top_places.length) {
    html += '<div class="chart-card"><div class="section-title">📍 Top miast i wysp</div>'
      + svgGradientBars(s.top_places.slice(0, 5), {
          nameKey: 'location_name',
          valueKey: 'visit_count',
          color: 'var(--purple)',
          valueLabel: p => `${p.visit_count}× · ${p.days_spent || 0} dni`,
        }) + '</div>';
    const mapped = s.top_places.filter(p => p.lat != null && p.lon != null);
    if (mapped.length) {
      html += `<div class="chart-card stats-map-card">
        <div class="section-title">🗺 Top miejsca na mapie</div>
        <div id="stats-mini-map" class="stats-mini-map"></div>
      </div>`;
    }
  }
  if (!currentStatsYear && s.heatmap && s.heatmap.length) {
    html += '<div class="chart-card heatmap-card"><div class="section-title">🗓 Kalendarz podróży</div>'
      + svgHeatmap(s.heatmap) + '</div>';
  } else if (currentStatsYear && s.by_month && s.by_month.length) {
    const maxM = Math.max(...s.by_month.map(m => m.days), 1);
    html += '<div class="purpose-bar"><div class="section-title">🗓 Dni w trasie wg miesięcy</div>';
    s.by_month.forEach(m => {
      html += '<div class="purpose-row"><div class="purpose-name">'+months[m.month]+'</div>'+simpleBar(m.days,maxM,'var(--orange)')+'<div class="purpose-count">'+m.days+'</div></div>';
    });
    html += '</div>';
  }
  if (s.top_expensive && s.top_expensive.length) {
    html += '<div class="purpose-bar"><div class="section-title">💰 Top 10 najdroższych wyjazdów</div>';
    s.top_expensive.forEach((t, i) => {
      html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px;line-height:1.4">'+(i+1)+'. '+escapeHtml(t.name)+'</div><div style="min-width:100px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.amount).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'</div></div>';
    });
    html += '</div>';
  }
  if (s.cost_per_day && s.cost_per_day.length) {
    html += '<div class="purpose-bar"><div class="section-title">💸 Najdroższe wyjazdy per dzień</div>';
    s.cost_per_day.forEach(t => {
      html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px">'+escapeHtml(t.name)+'</div><div style="min-width:110px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.cost_per_day).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'/d</div></div>';
    });
    html += '</div>';
  }
  html += '</div><div style="height:16px"></div>';
  view.innerHTML = html;

  const hofScroll = view.querySelector('.hof-scroll');
  const hofDots = view.querySelectorAll('.hof-dot');
  if (hofScroll && hofDots.length) {
    const firstCard = hofScroll.querySelector('.hof-card');
    const cardStep = firstCard ? firstCard.offsetWidth + 10 : 180;
    hofScroll.addEventListener('scroll', () => {
      const idx = Math.min(hofDots.length - 1, Math.round(hofScroll.scrollLeft / cardStep));
      hofDots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, { passive: true });
  }

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
