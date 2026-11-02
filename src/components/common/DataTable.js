import { esc } from '../../services/format.js';

/* columns: [{ key, label, align:'right'|'left', render(row) }] */
export function DataTable({ columns, rows = [], empty = 'Sin datos', className = '', foot = null }) {
  const head = columns.map(c => `<th class="${c.align === 'right' ? 'num' : ''}">${esc(c.label)}</th>`).join('');
  const body = rows.length ? rows.map(row => `<tr>${columns.map(c =>
    `<td class="${c.align === 'right' ? 'num' : ''}">${c.render ? c.render(row) : esc(row[c.key] ?? '')}</td>`).join('')}</tr>`).join('') : '';
  return `
    <div class="table-scroll">
      <table class="data-table ${esc(className)}">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
        ${foot ? `<tfoot>${foot}</tfoot>` : ''}
      </table>
    </div>
    ${rows.length ? '' : `<p class="empty-note">${esc(empty)}</p>`}`;
}
