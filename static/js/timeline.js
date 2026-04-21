async function renderTimeline() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="page-header"><div class="page-title">Oś czasu</div></div><div class="spinner"></div>`;
  const travels = await api('/api/travels');
  const sorted = [...travels].sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!sorted.length) { view.innerHTML = `<div class="page-header"><div class="page-title">Oś czasu</div></div><div class="empty">Brak podróży</div>`; return; }
  let html = '<div class="page-header"><div class="page-title">Oś czasu</div></div><div class="timeline">';
  let lastYear = null, lastEndDate = null;
  sorted.forEach((t, idx) => {
    const startD = parseDate(t.start_date); const endD = parseDate(t.end_date);
    const year = startD ? startD.getFullYear() : '?';
    const days = daysCount(t.start_date, t.end_date);
    const done = t.is_description_complete; const isLast = idx === sorted.length - 1;
    if (year !== lastYear) { lastYear = year; lastEndDate = null; html += `<div class="timeline-year">${year}</div>`; }
    if (lastEndDate) {
      const gapDays = Math.round((startD - lastEndDate) / 86400000);
      if (gapDays >= 30) {
        const gapMonths = Math.round(gapDays / 30);
        html += `<div class="tl-gap"><div class="tl-gap-line" style="height:20px"></div><div class="tl-gap-label">${gapMonths < 2 ? gapDays+' dni przerwy' : gapMonths+' mies. przerwy'}</div></div>`;
      }
    }
    html += `<div class="tl-item" onclick="openTravel(${t.id})"><div class="tl-spine">
      <div class="tl-dot${done?' done':''}"></div>${!isLast?'<div class="tl-line"></div>':''}</div>
      <div class="tl-card${done?' done':''}">
        <div class="tl-card-title">${t.name||'(bez nazwy)'}${done?' ✓':''}</div>
        <div class="tl-card-date">${fmtDate(t.start_date)} – ${fmtDate(t.end_date)} · ${days} ${days===1?'dzień':days<5?'dni':'dni'}</div>
        <div class="tl-card-meta">
          ${t.purpose?`<span class="badge ${purposeColor(t.purpose)}">${purposeIcon(t.purpose)} ${t.purpose}</span>`:''}
          ${t.amount>0?`<span class="badge badge-purple">${Math.round(t.amount).toLocaleString('pl-PL')} ${t.currency}</span>`:''}
          ${t.rating?`<span class="badge badge-orange">${stars(t.rating)}</span>`:''}
          ${t.has_photo_album?`<span class="badge badge-green">📷</span>`:''}
        </div>
      </div></div>`;
    lastEndDate = endD;
  });
  html += '</div>';
  view.innerHTML = html;
}
