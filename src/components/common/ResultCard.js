import { esc } from '../../services/format.js';

export function ResultCard({ id = '', label, value = '0', tone = '', sub = '' }) {
  return `
    <div class="result-card ${esc(tone)}" ${id ? `id="${esc(id)}"` : ''}>
      <span class="result-label">${esc(label)}</span>
      <strong class="result-value">${value}</strong>
      ${sub ? `<small class="result-sub">${esc(sub)}</small>` : ''}
    </div>`;
}

export function ResultGrid(cards, className = '') {
  return `<div class="result-grid ${esc(className)}">${cards.map(ResultCard).join('')}</div>`;
}

export function SectionCard(title, body, extra = '') {
  return `<section class="card"><div class="card-head"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
}
