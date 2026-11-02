import { esc, fmt } from '../../services/format.js';

/* Barras horizontales simples (SVG/HTML, sin dependencias). */
export function PriceBars(rows, { label = 'Precio' } = {}) {
  if (!rows.length) return '<p class="empty-note">Sin precios para mostrar.</p>';
  const max = Math.max(...rows.map(r => r.price), 1);
  return `
    <div class="price-bars">
      <div class="chart-title">${esc(label)} <span>plata / unidad</span></div>
      ${rows.map(r => `
        <div class="bar-row">
          <span class="bar-label">${esc(r.city)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, (r.price / max) * 100)}%"></div></div>
          <span class="bar-value">${fmt(r.price)}</span>
        </div>`).join('')}
    </div>`;
}

export function ProfitBars(rows) {
  if (!rows.length) return '<p class="empty-note">Sin datos.</p>';
  const max = Math.max(...rows.map(r => Math.abs(r.profit)), 1);
  return `<div class="price-bars">${rows.map(r => `
    <div class="bar-row">
      <span class="bar-label">${esc(r.city)}</span>
      <div class="bar-track"><div class="bar-fill ${r.profit >= 0 ? 'good' : 'bad'}" style="width:${Math.max(2, Math.abs(r.profit) / max * 100)}%"></div></div>
      <span class="bar-value ${r.profit >= 0 ? 'positive' : 'negative'}">${fmt(r.profit)}</span>
    </div>`).join('')}</div>`;
}
