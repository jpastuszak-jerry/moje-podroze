/* ── SVG chart helpers ───────────────────────────────────── */
const CHART_PALETTE = ['#1a6fdb','#f97316','#059669','#7c3aed','#e11d48','#0891b2','#d97706','#9f1239'];

function svgSparkline(data, { valueKey = 'count', labelKey = 'year' } = {}) {
  if (!data || !data.length) return '';
  const W = 320, H = 110, padX = 14, padTop = 14, padBot = 26;
  const plotW = W - 2*padX, plotH = H - padTop - padBot;
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  const xAt = i => padX + (data.length === 1 ? plotW/2 : (i * plotW / (data.length - 1)));
  const yAt = v => padTop + plotH - (v / maxV) * plotH;
  const pts = data.map((d,i) => `${xAt(i)},${yAt(d[valueKey])}`).join(' ');
  const areaPts = `${padX},${padTop+plotH} ${pts} ${padX+plotW},${padTop+plotH}`;
  const dots = data.map((d,i) => `<circle cx="${xAt(i)}" cy="${yAt(d[valueKey])}" r="3.5" fill="var(--blue)" stroke="var(--card)" stroke-width="2"/>`).join('');
  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  const labels = data.map((d,i) => i % labelStep === 0 || i === data.length - 1
    ? `<text x="${xAt(i)}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--text2)">${d[labelKey]}</text>` : '').join('');
  const valueLabels = data.map((d,i) =>
    `<text x="${xAt(i)}" y="${yAt(d[valueKey])-9}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--text)">${d[valueKey]}</text>`
  ).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" class="chart-svg sparkline-svg">
    <defs><linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--blue)" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="var(--blue)" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${areaPts}" fill="url(#spark-grad)"/>
    <polyline points="${pts}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${valueLabels}${labels}
  </svg>`;
}

function svgDonut(data, { nameKey = 'name', valueKey = 'count' } = {}) {
  if (!data || !data.length) return '';
  const total = data.reduce((s,d) => s + (d[valueKey] || 0), 0);
  if (!total) return '';
  const cx = 80, cy = 80, rOut = 70, rIn = 46;
  let angle = -Math.PI / 2;
  const segments = data.map((d, i) => {
    const v = d[valueKey] || 0;
    const sweep = (v / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    const x0o = cx + rOut * Math.cos(a0), y0o = cy + rOut * Math.sin(a0);
    const x1o = cx + rOut * Math.cos(a1), y1o = cy + rOut * Math.sin(a1);
    const x0i = cx + rIn * Math.cos(a0), y0i = cy + rIn * Math.sin(a0);
    const x1i = cx + rIn * Math.cos(a1), y1i = cy + rIn * Math.sin(a1);
    const large = sweep > Math.PI ? 1 : 0;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    if (data.length === 1) {
      return `<circle cx="${cx}" cy="${cy}" r="${(rOut+rIn)/2}" fill="none" stroke="${color}" stroke-width="${rOut-rIn}"/>`;
    }
    return `<path d="M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z" fill="${color}"/>`;
  }).join('');
  const legend = data.map((d, i) => {
    const pct = Math.round((d[valueKey] || 0) / total * 100);
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    return `<div class="chart-legend-row">
      <div class="chart-legend-dot" style="background:${color}"></div>
      <div class="chart-legend-name">${escapeHtml(d[nameKey] || '–')}</div>
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

function svgGradientBars(data, { nameKey, valueKey, valueLabel = null, color = 'var(--blue)' }) {
  if (!data || !data.length) return '';
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  return data.map(d => {
    const pct = Math.max(8, Math.round((d[valueKey] / maxV) * 100));
    const label = valueLabel ? valueLabel(d) : d[valueKey];
    return `<div class="gbar-row">
      <div class="gbar-name">${escapeHtml(d[nameKey])}</div>
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

async function renderStats() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Statystyki</div></div>` + skeletonCards(3);
  const url = '/api/stats' + (currentStatsYear ? '?year=' + currentStatsYear : '');
  const s = await api(url);
  const months = ['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paz','Lis','Gru'];
  function bar(val, max, color) { return '<div class="purpose-track"><div class="purpose-fill" style="width:'+Math.round(val/max*100)+'%;background:'+color+'"></div></div>'; }

  const yearsDesc = (s.by_year || []).map(y => y.year).sort((a,b) => b-a);
  const filterBar = `<div class="sort-bar" style="margin-top:10px">
    <button class="sort-btn${!currentStatsYear ? ' active' : ''}" onclick="setStatsYear(null)">Wszystkie</button>
    ${yearsDesc.map(y => `<button class="sort-btn${currentStatsYear === y ? ' active' : ''}" onclick="setStatsYear(${y})">${y}</button>`).join('')}
  </div>`;
  let html = `<div class="page-header"><div class="page-title">Statystyki</div>${filterBar}</div>`;

  // Hero card
  const heroLabel = currentStatsYear ? `Rok ${currentStatsYear}` : 'Wszystkie podróże';
  const heroCurrencies = Object.entries(s.amount_by_currency || {});
  const heroAmount = heroCurrencies.length
    ? heroCurrencies.map(([cur, amt]) => `${Math.round(amt).toLocaleString('pl-PL')} <span class="hero-cur">${escapeHtml(cur)}</span>`).join(' &nbsp;·&nbsp; ')
    : '';
  const prev = s.prev_period;
  html += `<div class="hero-card">
    <div class="hero-label">${escapeHtml(heroLabel)}${prev ? ` &nbsp;·&nbsp; <span style="opacity:0.6">vs ${prev.year}</span>` : ''}</div>
    <div class="hero-numbers">
      <div class="hero-number"><div class="hero-val">${s.total_trips}</div><div class="hero-key">podróży</div>${prev ? yoyDelta(s.total_trips, prev.total_trips) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.total_days}</div><div class="hero-key">dni w trasie</div>${prev ? yoyDelta(s.total_days, prev.total_days) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.countries}</div><div class="hero-key">krajów</div>${prev ? yoyDelta(s.countries, prev.countries) : ''}</div>
      <div class="hero-number"><div class="hero-val">${s.flights}</div><div class="hero-key">lotów</div>${prev ? yoyDelta(s.flights, prev.flights) : ''}</div>
    </div>
    ${heroAmount ? `<div class="hero-amount">${heroAmount}</div>` : ''}
  </div>`;
  if (s.hall_of_fame) {
    const hof = s.hall_of_fame;
    const records = [
      hof.longest     && { icon:'📅', title:'Najdłuższa',        sub: hof.longest.value+' dni',                                               id: hof.longest.id,      name: hof.longest.name },
      hof.priciest    && { icon:'💰', title:'Najdroższa',         sub: Math.round(hof.priciest.value).toLocaleString('pl-PL')+' '+hof.priciest.currency, id: hof.priciest.id,     name: hof.priciest.name },
      hof.best_rated  && { icon:'⭐', title:'Najwyżej oceniana',  sub: stars(hof.best_rated.value),                                            id: hof.best_rated.id,   name: hof.best_rated.name },
      hof.most_places && { icon:'📍', title:'Najwięcej miejsc',   sub: hof.most_places.value+' miejsc',                                        id: hof.most_places.id,  name: hof.most_places.name },
      hof.most_flights&& { icon:'🛫', title:'Najwięcej lotów',    sub: hof.most_flights.value+' lotów',                                        id: hof.most_flights.id, name: hof.most_flights.name },
    ].filter(Boolean);
    if (records.length) {
      html += '<div class="purpose-bar"><div class="section-title">🏆 Hall of Fame</div>';
      records.forEach(r => {
        html += `<div class="purpose-row" onclick="openTravel(${r.id})" style="cursor:pointer;align-items:center;gap:0">
          <div style="font-size:20px;width:32px;text-align:center;flex-shrink:0">${r.icon}</div>
          <div style="flex:1;min-width:0;padding:0 10px">
            <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.06em">${r.title}</div>
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--blue);white-space:nowrap;flex-shrink:0">${r.sub}</div>
        </div>`;
      });
      html += '</div>';
    }
  }
  html += '<div class="stats-grid">';
  html += '<div class="stat-card sc-blue"><div class="stat-icon">✈️</div><div class="stat-value">'+s.total_trips+'</div><div class="stat-label">Podróży</div>'+(prev?yoyDelta(s.total_trips, prev.total_trips):'')+'</div>';
  html += '<div class="stat-card sc-orange"><div class="stat-icon">📅</div><div class="stat-value">'+s.total_days+'</div><div class="stat-label">Dni w trasie</div>'+(prev?yoyDelta(s.total_days, prev.total_days):'')+'</div>';
  html += '<div class="stat-card sc-green"><div class="stat-icon">🌍</div><div class="stat-value">'+s.countries+'</div><div class="stat-label">Krajów</div>'+(prev?yoyDelta(s.countries, prev.countries):'')+'</div>';
  html += '<div class="stat-card sc-purple"><div class="stat-icon">📍</div><div class="stat-value">'+s.locations+'</div><div class="stat-label">Miejsc (all)</div></div>';
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
  html += '</div>';
  if (s.purposes && s.purposes.length) {
    html += '<div class="chart-card"><div class="section-title">🎯 Cel podróży</div>'
      + svgDonut(s.purposes.map(p => ({ name: p.name || 'Inne', count: p.count })))
      + '</div>';
  }
  if (s.participation) {
    html += '<div class="purpose-bar"><div class="section-title">Kto jeździł</div>';
    html += '<div class="purpose-row"><div class="purpose-name">👨 Jarek sam</div>'+bar(s.participation.sam,s.total_trips,'var(--blue)')+'<div class="purpose-count">'+s.participation.sam+'</div></div>';
    html += '<div class="purpose-row"><div class="purpose-name">👩 Hania sama</div>'+bar(s.participation.hanna_solo,s.total_trips,'var(--purple)')+'<div class="purpose-count">'+s.participation.hanna_solo+'</div></div>';
    html += '<div class="purpose-row"><div class="purpose-name">👫 Razem</div>'+bar(s.participation.razem,s.total_trips,'var(--green)')+'<div class="purpose-count">'+s.participation.razem+'</div></div></div>';
  }
  if (s.top_countries && s.top_countries.length) {
    html += '<div class="chart-card"><div class="section-title">🌍 Top krajów</div>'
      + svgGradientBars(s.top_countries, { nameKey: 'country', valueKey: 'visits', color: 'var(--green)' })
      + '</div>';
  }
  if (s.top_places && s.top_places.length) {
    html += '<div class="chart-card"><div class="section-title">📍 Top miast i wysp</div>'
      + svgGradientBars(s.top_places, {
          nameKey: 'location_name',
          valueKey: 'visit_count',
          color: 'var(--purple)',
          valueLabel: p => `${p.visit_count}× · ${p.days_spent || 0}d`,
        })
      + '</div>';
  }
  if (s.by_year && s.by_year.length) {
    html += '<div class="chart-card"><div class="section-title">📅 Wyjazdy wg roku</div>'
      + svgSparkline(s.by_year, { valueKey: 'count', labelKey: 'year' })
      + '</div>';
  }
  if (s.by_month && s.by_month.length) {
    const maxM = Math.max(...s.by_month.map(m=>m.count));
    html += '<div class="purpose-bar"><div class="section-title">🗓 Ulubiony miesiąc</div>';
    s.by_month.forEach(m => { html += '<div class="purpose-row"><div class="purpose-name">'+months[m.month]+'</div>'+bar(m.count,maxM,'var(--orange)')+'<div class="purpose-count">'+m.count+'</div></div>'; });
    html += '</div>';
  }
  if (s.top_expensive && s.top_expensive.length) {
    html += '<div class="purpose-bar"><div class="section-title">💰 Top 10 najdroższych wyjazdów</div>';
    s.top_expensive.forEach((t,i) => { html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px;line-height:1.4">'+(i+1)+'. '+escapeHtml(t.name)+'</div><div style="min-width:100px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.amount).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'</div></div>'; });
    html += '</div>';
  }
  if (s.cost_per_day && s.cost_per_day.length) {
    html += '<div class="purpose-bar"><div class="section-title">💸 Najdroższe wyjazdy per dzień</div>';
    s.cost_per_day.forEach(t => { html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px">'+escapeHtml(t.name)+'</div><div style="min-width:110px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.cost_per_day).toLocaleString('pl-PL')+' '+escapeHtml(t.currency || 'PLN')+'/d</div></div>'; });
    html += '</div>';
  }
  html += '<div style="height:16px"></div>';
  view.innerHTML = html;
}
