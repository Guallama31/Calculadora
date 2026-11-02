import { esc } from '../../services/format.js';
import { cn } from '../../lib/utils.js';

export function DataTable({ columns, rows = [], empty = 'Sin datos', className = '', foot = null }) {
  return (
    <>
      <div className="table-scroll">
        <table className={cn('data-table', className)}>
          <thead>
            <tr>{columns.map((c, i) => <th key={i} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {columns.map((c, ci) => (
                  <td key={ci} className={c.align === 'right' ? 'num' : ''}>
                    {c.render ? c.render(row, ri) : esc(row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {foot && <tfoot>{foot}</tfoot>}
        </table>
      </div>
      {!rows.length && <p className="empty-note">{empty}</p>}
    </>
  );
}
