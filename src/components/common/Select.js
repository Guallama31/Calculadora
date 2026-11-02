import { esc } from '../../services/format.js';

export function Select({ id, label, options, value = '', hint = '', hidden = false, attrs = '' }) {
  const opts = options.map(o => {
    const val = typeof o === 'string' ? o : o.value;
    const text = typeof o === 'string' ? o : o.label;
    return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(text)}</option>`;
  }).join('');
  return `
    <label class="field" ${hidden ? 'hidden' : ''}>
      <span>${esc(label)}</span>
      <select id="${esc(id)}" ${attrs}>${opts}</select>
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
    </label>`;
}

export function NumberField({ id, label, value = 0, min = 0, step = 1, hint = '', hidden = false, placeholder = '' }) {
  return `
    <label class="field" ${hidden ? 'hidden' : ''}>
      <span>${esc(label)}</span>
      <input type="number" id="${esc(id)}" value="${esc(value)}" min="${min}" step="${step}" placeholder="${esc(placeholder)}">
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
    </label>`;
}

export function Toggle({ id, label, checked = false, hint = '' }) {
  return `
    <label class="toggle">
      <input type="checkbox" id="${esc(id)}" ${checked ? 'checked' : ''}>
      <span class="switch"></span><span>${esc(label)}</span>
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
    </label>`;
}
