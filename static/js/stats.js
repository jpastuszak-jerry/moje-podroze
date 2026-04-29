async function renderStats() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Statystyki</div></div>` + skeletonCards(3);
  const s = await api('/api/stats');
  const months = ['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paz','Lis','Gru'];
  function bar(val, max, color) { return '<div class="purpose-track"><div class="purpose-fill" style="width:'+Math.round(val/max*100)+'%;background:'+color+'"></div></div>'; }
  function purposeSection(title, items, nameFn, valFn, maxVal, color) {
    if (!items || !items.length) return '';
    return '<div class="purpose-bar"><div class="section-title">'+title+'</div>'+items.map(i=>'<div class="purpose-row"><div class="purpose-name" style="font-size:12px">'+nameFn(i)+'</div>'+bar(valFn(i),maxVal,color)+'<div class="purpose-count">'+valFn(i)+'</div></div>').join('')+'</div>';
  }
  let html = '<div class="page-header"><div class="page-title">Statystyki</div></div>';
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
  html += '<div class="stat-card sc-blue"><div class="stat-icon">✈️</div><div class="stat-value">'+s.total_trips+'</div><div class="stat-label">Podróży</div></div>';
  html += '<div class="stat-card sc-orange"><div class="stat-icon">📅</div><div class="stat-value">'+s.total_days+'</div><div class="stat-label">Dni w trasie</div></div>';
  html += '<div class="stat-card sc-green"><div class="stat-icon">🌍</div><div class="stat-value">'+s.countries+'</div><div class="stat-label">Krajów</div></div>';
  html += '<div class="stat-card sc-purple"><div class="stat-icon">📍</div><div class="stat-value">'+s.locations+'</div><div class="stat-label">Miejsc</div></div>';
  html += '<div class="stat-card sc-teal"><div class="stat-icon">🛫</div><div class="stat-value">'+s.flights+'</div><div class="stat-label">Lotów</div></div>';
  html += '<div class="stat-card sc-green"><div class="stat-icon">📷</div><div class="stat-value">'+s.albums+'</div><div class="stat-label">Albumów</div></div>';
  html += '<div class="stat-card sc-orange"><div class="stat-icon">⭐</div><div class="stat-value">'+(s.avg_rating||'–')+'</div><div class="stat-label">Śr. ocena</div></div>';
  html += '<div class="stat-card sc-rose"><div class="stat-icon">💰</div><div class="stat-value" style="font-size:15px">'+(s.total_amount>0?Math.round(s.total_amount).toLocaleString('pl-PL'):'–')+'</div><div class="stat-label">PLN wydane</div></div>';
  html += '<div class="stat-card sc-blue"><div class="stat-icon">📆</div><div class="stat-value">'+(s.avg_trip_days||'–')+'</div><div class="stat-label">Śr. długość (dni)</div></div>';
  if (s.progress) html += '<div class="stat-card sc-purple"><div class="stat-icon">✍️</div><div class="stat-value">'+s.progress.described+'/'+s.progress.total+'</div><div class="stat-label">Opisanych</div></div>';
  html += '</div>';
  if (s.purposes && s.purposes.length) html += purposeSection('Cel podróży', s.purposes, p=>p.name||'Inne', p=>p.count, s.total_trips, 'var(--blue)');
  if (s.participation) {
    html += '<div class="purpose-bar"><div class="section-title">Kto jeździł</div>';
    html += '<div class="purpose-row"><div class="purpose-name">👨 Jarek sam</div>'+bar(s.participation.sam,s.total_trips,'var(--blue)')+'<div class="purpose-count">'+s.participation.sam+'</div></div>';
    html += '<div class="purpose-row"><div class="purpose-name">👩 Hania sama</div>'+bar(s.participation.hanna_solo,s.total_trips,'var(--purple)')+'<div class="purpose-count">'+s.participation.hanna_solo+'</div></div>';
    html += '<div class="purpose-row"><div class="purpose-name">👫 Razem</div>'+bar(s.participation.razem,s.total_trips,'var(--green)')+'<div class="purpose-count">'+s.participation.razem+'</div></div></div>';
  }
  if (s.top_countries && s.top_countries.length) html += purposeSection('🌍 Top krajów', s.top_countries, c=>c.country, c=>c.visits, s.top_countries[0].visits, 'var(--green)');
  if (s.top_places && s.top_places.length) {
    const maxV = s.top_places[0].visit_count;
    html += '<div class="purpose-bar"><div class="section-title">📍 Top miast i wysp</div>';
    s.top_places.forEach(p => { html += '<div class="purpose-row"><div class="purpose-name" style="font-size:12px">'+p.location_name+' <span style="color:var(--text3)">('+p.country+')</span></div>'+bar(p.visit_count,maxV,'var(--purple)')+'<div class="purpose-count">'+p.visit_count+'x · '+(p.days_spent||0)+'d</div></div>'; });
    html += '</div>';
  }
  if (s.by_year && s.by_year.length) {
    const maxY = Math.max(...s.by_year.map(y=>y.count));
    html += '<div class="purpose-bar"><div class="section-title">📅 Wyjazdy wg roku</div>';
    s.by_year.forEach(y => { html += '<div class="purpose-row"><div class="purpose-name">'+y.year+'</div>'+bar(y.count,maxY,'var(--blue)')+'<div class="purpose-count">'+y.count+'</div></div>'; });
    html += '</div>';
  }
  if (s.by_month && s.by_month.length) {
    const maxM = Math.max(...s.by_month.map(m=>m.count));
    html += '<div class="purpose-bar"><div class="section-title">🗓 Ulubiony miesiąc</div>';
    s.by_month.forEach(m => { html += '<div class="purpose-row"><div class="purpose-name">'+months[m.month]+'</div>'+bar(m.count,maxM,'var(--orange)')+'<div class="purpose-count">'+m.count+'</div></div>'; });
    html += '</div>';
  }
  if (s.top_expensive && s.top_expensive.length) {
    html += '<div class="purpose-bar"><div class="section-title">💰 Top 10 najdroższych wyjazdów</div>';
    s.top_expensive.forEach((t,i) => { html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px;line-height:1.4">'+(i+1)+'. '+t.name+'</div><div style="min-width:100px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.amount).toLocaleString('pl-PL')+' PLN</div></div>'; });
    html += '</div>';
  }
  if (s.cost_per_day && s.cost_per_day.length) {
    html += '<div class="purpose-bar"><div class="section-title">💸 Najdroższe wyjazdy per dzień</div>';
    s.cost_per_day.forEach(t => { html += '<div class="purpose-row"><div class="purpose-name" style="font-size:11px">'+t.name+'</div><div style="min-width:110px;text-align:right;font-size:11px;font-weight:500;color:var(--text)">'+parseFloat(t.cost_per_day).toLocaleString('pl-PL')+' PLN/d</div></div>'; });
    html += '</div>';
  }
  html += '<div style="height:16px"></div>';
  view.innerHTML = html;
}
