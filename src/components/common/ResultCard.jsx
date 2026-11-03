import { cn } from '../../lib/utils.js';
export function ResultCard({ id, label, value = '0', tone = '', sub = '' }) {
  return (
    <div className={cn('result-card', tone)} id={id}>
      <span className="result-label">{label}</span>
      <strong className="result-value">{value}</strong>
      {sub && <small className="result-sub">{sub}</small>}
    </div>
  );
}
export function ResultGrid({ cards, className }) {
  return (
    <div className={cn('result-grid', className)}>
      {cards.map((c, i) => (
        <ResultCard key={c.id || i} {...c} />
      ))}
    </div>
  );
}
