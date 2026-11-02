import { esc } from '../../services/format.js';

export function Tabs({ id = 'tabs', tabs, active }) {
  return `<div class="tabs" id="${esc(id)}" role="tablist">${tabs.map(tab => `
    <button type="button" class="tab ${tab.id === active ? 'active' : ''}" data-tab="${esc(tab.id)}" role="tab">
      ${esc(tab.label)}${tab.badge ? `<span class="tab-badge">${esc(tab.badge)}</span>` : ''}
    </button>`).join('')}</div>`;
}

export function bindTabs(root, id, onChange) {
  const container = root.querySelector(`#${id}`);
  if (!container) return;
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === button));
    onChange(button.dataset.tab);
  });
}
