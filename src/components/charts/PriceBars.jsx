import { esc, fmt } from '../../services/format.js';

export function PriceBars({ rows, label = 'Precio' }) {
  if (!rows.length) return <p className="empty-note">Sin precios para mostrar.</p>;
  const max = Math.max(...rows.map(r => r.price), 1);
  return (
    <div className="price-bars">
      <div className="chart-title">
        {label} <span>plata / unidad</span>
      </div>
      {rows.map(r => (
        <div className="bar-row" key={r.city}>
          <span className="bar-label">{esc(r.city)}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(2, (r.price / max) * 100)}%` }} />
          </div>
          <span className="bar-value">{fmt(r.price)}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfitBars({ rows }) {
  if (!rows.length) return <p className="empty-note">Sin datos.</p>;
  const max = Math.max(...rows.map(r => Math.abs(r.profit)), 1);
  return (
    <div className="price-bars">
      {rows.map(r => (
        <div className="bar-row" key={r.city}>
          <span className="bar-label">{esc(r.city)}</span>
          <div className="bar-track">
            <div
              className={`bar-fill ${r.profit >= 0 ? 'good' : 'bad'}`}
              style={{ width: `${Math.max(2, (Math.abs(r.profit) / max) * 100)}%` }}
            />
          </div>
          <span className={`bar-value ${r.profit >= 0 ? 'positive' : 'negative'}`}>{fmt(r.profit)}</span>
        </div>
      ))}
    </div>
  );
}
