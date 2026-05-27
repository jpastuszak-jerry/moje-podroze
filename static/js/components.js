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
  return renderSectionCard({
    title,
    className,
    body: `<div class="${escapeAttr(messageClass)}">${escapeHtml(message)}</div>`,
  });
}

function renderSectionCard({
  title = '',
  titleHtml = '',
  body = '',
  className = 'chart-card',
  titleClass = 'section-title',
  headerClass = '',
  subtitle = '',
  subtitleHtml = '',
  subtitleClass = '',
  actionsHtml = '',
} = {}) {
  const titleContent = titleHtml || escapeHtml(String(title || ''));
  const subtitleContent = subtitleHtml || (subtitle ? escapeHtml(String(subtitle)) : '');
  const titleNode = titleContent
    ? `<div class="${escapeAttr(titleClass)}">${titleContent}</div>`
    : '';
  const subtitleNode = subtitleContent
    ? `<div${subtitleClass ? ` class="${escapeAttr(subtitleClass)}"` : ''}>${subtitleContent}</div>`
    : '';
  const headingNode = subtitleNode ? `<div>${titleNode}${subtitleNode}</div>` : titleNode;
  const headerNode = actionsHtml
    ? `<div class="${escapeAttr(headerClass || 'section-header')}">${headingNode}${actionsHtml}</div>`
    : `${titleNode}${subtitleNode}`;
  return `<div class="${escapeAttr(className)}">
    ${headerNode}
    ${body}
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

function renderEntityCard({
  className = 'card',
  onclick = '',
  innerClass = 'card-inner',
  icon = '',
  iconHtml = null,
  iconClass = 'card-icon',
  iconStyle = '',
  bodyClass = 'card-body',
  title = '',
  titleHtml = null,
  titleClass = 'card-title',
  titleActionHtml = '',
  titleRowClass = 'worklist-card-title-row',
  subtitles = [],
  metaHtml = '',
  trailingHtml = '',
} = {}) {
  const iconContent = iconHtml != null ? iconHtml : escapeHtml(String(icon || ''));
  const iconNode = iconContent
    ? `<div class="${escapeAttr(iconClass)}"${iconStyle ? ` style="${escapeAttr(iconStyle)}"` : ''}>${iconContent}</div>`
    : '';
  const titleContent = titleHtml != null ? titleHtml : escapeHtml(String(title || ''));
  const titleNode = titleContent ? `<div class="${escapeAttr(titleClass)}">${titleContent}</div>` : '';
  const titleBlock = titleActionHtml
    ? `<div class="${escapeAttr(titleRowClass)}">${titleNode}${titleActionHtml}</div>`
    : titleNode;
  const subtitlesHtml = (subtitles || []).filter(item => item != null && item !== '').map(item => {
    if (item && typeof item === 'object') {
      const itemClass = item.className || 'card-subtitle';
      const content = item.html != null ? item.html : escapeHtml(String(item.text ?? ''));
      return content ? `<div class="${escapeAttr(itemClass)}">${content}</div>` : '';
    }
    return `<div class="card-subtitle">${escapeHtml(String(item))}</div>`;
  }).join('');
  return `<div class="${escapeAttr(className)}"${onclick ? ` onclick="${escapeAttr(onclick)}"` : ''}>
    <div class="${escapeAttr(innerClass)}">
      ${iconNode}
      <div class="${escapeAttr(bodyClass)}">
        ${titleBlock}
        ${subtitlesHtml}
        ${metaHtml}
      </div>
      ${trailingHtml}
    </div>
  </div>`;
}

function renderWorklistCard({
  onclick,
  icon = '',
  iconHtml = null,
  iconClass = 'card-icon worklist-icon',
  title,
  editOnclick = '',
  subtitle = '',
  badges = [],
  badgeTone = 'orange',
} = {}) {
  const badgesHtml = renderBadges(badges, { tone: badgeTone });
  return renderEntityCard({
    onclick,
    icon,
    iconHtml,
    iconClass,
    title: title || '(bez nazwy)',
    titleClass: 'card-title worklist-card-title',
    titleActionHtml: editOnclick
      ? `<button class="btn-add-small" onclick="event.stopPropagation(); ${escapeAttr(editOnclick)}">Edytuj</button>`
      : '',
    subtitles: [subtitle],
    metaHtml: badgesHtml ? `<div class="card-meta">${badgesHtml}</div>` : '',
  });
}

function renderPickerRow({
  id = '',
  onclick = '',
  icon = '',
  iconHtml = null,
  iconClass = 'avatar',
  title = '',
  titleHtml = null,
  subtitle = '',
  subtitleHtml = '',
  plusHtml = '＋',
  actionsHtml = '',
  rowClass = 'person-row',
} = {}) {
  const iconContent = iconHtml != null ? iconHtml : escapeHtml(String(icon || ''));
  const titleContent = titleHtml != null ? titleHtml : escapeHtml(String(title || ''));
  const subtitleContent = subtitleHtml || (subtitle ? escapeHtml(String(subtitle)) : '');
  const actionNode = actionsHtml || (plusHtml ? `<div class="person-row-plus">${plusHtml}</div>` : '');
  return `<div class="${escapeAttr(rowClass)}"${id ? ` id="${escapeAttr(id)}"` : ''}${onclick ? ` onclick="${escapeAttr(onclick)}"` : ''}>
    ${iconContent ? `<div class="${escapeAttr(iconClass)}">${iconContent}</div>` : ''}
    <div class="person-row-info">
      <div class="modal-row-title">${titleContent}</div>
      ${subtitleContent ? `<div class="modal-row-sub">${subtitleContent}</div>` : ''}
    </div>
    ${actionNode}
  </div>`;
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

function renderMetricItem(metric, {
  itemClass = 'metric-item',
  valueClass = 'metric-value',
  labelClass = 'metric-label',
  subClass = 'metric-sub',
  labelFirst = false,
} = {}) {
  const classes = [itemClass, metric.className].filter(Boolean).join(' ');
  const value = metric.valueHtml != null
    ? metric.valueHtml
    : escapeHtml(String(metric.value ?? '–'));
  const label = `<div class="${escapeAttr(labelClass)}">${escapeHtml(metric.label || '')}</div>`;
  const valueNode = `<div class="${escapeAttr(valueClass)}">${value}</div>`;
  const sub = metric.subHtml != null
    ? metric.subHtml
    : (metric.sub ? escapeHtml(String(metric.sub)) : '');
  return `<div class="${escapeAttr(classes)}">
    ${labelFirst ? label + valueNode : valueNode + label}
    ${sub ? `<div class="${escapeAttr(subClass)}">${sub}</div>` : ''}
  </div>`;
}

function renderMetricGrid(metrics, {
  className = 'metric-grid',
  ...itemOptions
} = {}) {
  return `<div class="${escapeAttr(className)}">
    ${(metrics || []).map(metric => renderMetricItem(metric, itemOptions)).join('')}
  </div>`;
}

function renderStatSummaryCard({ tone = 'blue', icon, value, valueHtml, label, extraHtml = '' }) {
  const valueContent = valueHtml != null ? valueHtml : escapeHtml(String(value ?? '–'));
  return `<div class="stat-card sc-${escapeAttr(tone)}">
    <div class="stat-card-top">
      <div class="stat-icon">${icon}</div>
      <div class="stat-value">${valueContent}</div>
    </div>
    <div class="stat-label">${escapeHtml(label)}</div>
    ${extraHtml}
  </div>`;
}

function renderContextCard({
  icon,
  label,
  value,
  valueHtml = null,
  sub = '',
  subHtml = '',
  onclick = '',
} = {}) {
  const tag = onclick ? 'button' : 'div';
  const classes = `context-card${onclick ? ' context-clickable' : ''}`;
  const valueContent = valueHtml != null ? valueHtml : escapeHtml(String(value ?? ''));
  const subContent = subHtml || (sub ? escapeHtml(String(sub)) : '');
  return `<${tag}${onclick ? ' type="button"' : ''} class="${escapeAttr(classes)}"${onclick ? ` onclick="${escapeAttr(onclick)}"` : ''}>
    <div class="context-icon">${icon || ''}</div>
    <div class="context-body">
      <div class="context-label">${escapeHtml(label || '')}</div>
      <div class="context-value">${valueContent}</div>
      ${subContent ? `<div class="context-sub">${subContent}</div>` : ''}
    </div>
  </${tag}>`;
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
