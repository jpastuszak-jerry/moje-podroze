function renderTabs(items, activeId, {
  containerClass,
  buttonClass,
  ariaLabel,
  onClick,
} = {}) {
  const wrapClass = containerClass || 'ui-tabs';
  const tabClass = buttonClass || 'ui-tab';
  const actionFor = typeof onClick === 'function'
    ? onClick
    : item => onClick ? `${onClick}('${String(item.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')` : '';

  return `<div class="${escapeAttr(wrapClass)}" role="tablist" aria-label="${escapeAttr(ariaLabel || 'Zakładki')}">
    ${items.map(item => {
      const isActive = activeId === item.id;
      const action = actionFor(item);
      return `<button type="button"
        class="${escapeAttr(tabClass)}${isActive ? ' active' : ''}"
        role="tab"
        aria-selected="${isActive ? 'true' : 'false'}"
        ${action ? `onclick="${escapeAttr(action)}"` : ''}>${escapeHtml(item.label)}</button>`;
    }).join('')}
  </div>`;
}

function renderEmptyCard(title, message, {
  className = 'chart-card',
  messageClass = 'empty-card-text',
} = {}) {
  return `<div class="${escapeAttr(className)}">
    <div class="section-title">${escapeHtml(title)}</div>
    <div class="${escapeAttr(messageClass)}">${escapeHtml(message)}</div>
  </div>`;
}

function renderRankingBars(data, {
  nameKey,
  valueKey,
  valueLabel = null,
  color = 'var(--blue)',
} = {}) {
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
