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

function renderSelectOptions(options, selectedValue = '', {
  valueKey = 'value',
  labelKey = 'label',
  countKey = 'count',
  emptyOption = null,
} = {}) {
  const normalized = [];
  if (emptyOption) {
    normalized.push(typeof emptyOption === 'string'
      ? { value: '', label: emptyOption }
      : emptyOption);
  }
  normalized.push(...(options || []));

  const selected = String(selectedValue ?? '');
  return normalized.map(option => {
    const isObject = option && typeof option === 'object';
    const value = isObject
      ? option[valueKey] ?? option.key ?? option.id ?? option.name ?? option.label ?? ''
      : option;
    const label = isObject
      ? option[labelKey] ?? option.name ?? option.value ?? option.key ?? ''
      : option;
    const count = isObject ? option[countKey] : null;
    const countLabel = count != null ? ` (${count})` : '';
    return `<option value="${escapeAttr(String(value ?? ''))}"${String(value ?? '') === selected ? ' selected' : ''}>${escapeHtml(String(label ?? ''))}${countLabel}</option>`;
  }).join('');
}

function renderSelectControl({
  label,
  id,
  onchange,
  options,
  optionsHtml = '',
  selectedValue = '',
  valueKey = 'value',
  labelKey = 'label',
  countKey = 'count',
  emptyOption = null,
  controlClass = 'aux-control',
  selectClass = 'filter-select',
} = {}) {
  const renderedOptions = optionsHtml || renderSelectOptions(options, selectedValue, {
    valueKey,
    labelKey,
    countKey,
    emptyOption,
  });
  return `<label class="${escapeAttr(String(controlClass || ''))}">
    <span>${escapeHtml(String(label || ''))}</span>
    <select class="${escapeAttr(String(selectClass || ''))}" id="${escapeAttr(String(id || ''))}" onchange="${escapeAttr(String(onchange || ''))}">${renderedOptions}</select>
  </label>`;
}

function renderFilterSummary({
  count,
  countLabel,
  detail,
  resetOnclick = '',
  resetLabel = 'Wyczyść',
  summaryClass = 'aux-filter-summary',
  textClass = 'aux-filter-summary-text',
} = {}) {
  const details = Array.isArray(detail)
    ? detail.map(escapeHtml).join(' · ')
    : escapeHtml(detail || '');
  return `<div class="${escapeAttr(summaryClass)}">
    <div class="${escapeAttr(textClass)}"><strong>${escapeHtml(String(count ?? ''))} ${escapeHtml(String(countLabel || ''))}</strong><span>${details}</span></div>
    ${resetOnclick ? `<button class="filter-reset-btn" type="button" onclick="${escapeAttr(resetOnclick)}">${escapeHtml(resetLabel)}</button>` : ''}
  </div>`;
}

function renderFilterInner({
  controls = [],
  summary = null,
  innerClass = 'aux-filter-inner',
  gridClass = 'aux-filter-grid',
} = {}) {
  const controlsHtml = controls
    .map(control => typeof control === 'string' ? control : renderSelectControl(control))
    .join('');
  return `<div class="${escapeAttr(innerClass)}">
    <div class="${escapeAttr(gridClass)}">${controlsHtml}</div>
    ${summary ? renderFilterSummary(summary) : ''}
  </div>`;
}

function renderFilterPanel({
  controls = [],
  summary = null,
  panelClass = 'aux-filter-panel',
  innerClass = 'aux-filter-inner',
  gridClass = 'aux-filter-grid',
} = {}) {
  return `<div class="${escapeAttr(panelClass)}">
    ${renderFilterInner({ controls, summary, innerClass, gridClass })}
  </div>`;
}

function renderBadge(content, {
  tone = 'blue',
  className = '',
  html = false,
} = {}) {
  const classes = ['badge'];
  if (tone) classes.push(String(tone).startsWith('badge-') ? tone : `badge-${tone}`);
  if (className) classes.push(className);
  return `<span class="${escapeAttr(classes.join(' '))}">${html ? content : escapeHtml(String(content ?? ''))}</span>`;
}

function renderBadges(items, {
  tone = 'blue',
} = {}) {
  return (items || []).filter(Boolean).map(item => {
    if (typeof item === 'string' || typeof item === 'number') return renderBadge(item, { tone });
    return renderBadge(item.html ?? item.label ?? '', {
      tone: item.tone ?? tone,
      className: item.className || '',
      html: Boolean(item.html),
    });
  }).join('');
}

function renderHeroMetrics(metrics, {
  className = 'hero-numbers',
} = {}) {
  return `<div class="${escapeAttr(className)}">
    ${(metrics || []).map(metric => {
      const value = metric.valueHtml != null ? metric.valueHtml : escapeHtml(String(metric.value ?? ''));
      return `<div class="hero-number">
        <div class="hero-val">${value}</div>
        <div class="hero-key">${escapeHtml(metric.label || '')}</div>
        ${metric.extraHtml || ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderCardList(items, renderer, {
  className = 'card-list',
} = {}) {
  return `<div class="${escapeAttr(className)}">${(items || []).map(renderer).join('')}</div>`;
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
