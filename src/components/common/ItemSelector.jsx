/* Buscador de ítems (React) con autocompletado, variantes y ficha. */
import * as React from 'react';
import * as catalog from '../../services/catalog.js';
import { fmt } from '../../services/format.js';
import { cn } from '../../lib/utils.js';

export function ItemSelector({ id = 'item', placeholder = 'Buscar por nombre o ID…', filter = null,
  quality = 1, value = null, onChange = () => {} }) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(-1);
  const [current, setCurrent] = React.useState(null);
  const rootRef = React.useRef(null);
  const listRef = React.useRef(null);

  const suggestions = React.useMemo(() => {
    if (!query.trim()) return catalog.search('', 12, filter);
    return catalog.search(query, 40, filter);
  }, [query, filter]);

  React.useEffect(() => {
    const entry = value ? catalog.get(value) : null;
    if (entry && (!filter || filter(entry))) {
      setCurrent(entry);
      setQuery(entry.es);
    }
  }, [value, filter]);

  React.useEffect(() => {
    const onDown = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const select = entry => {
    if (!entry) return;
    setCurrent(entry);
    setQuery(entry.es);
    setOpen(false);
    setCursor(-1);
    onChange(entry);
  };

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(suggestions.length - 1, c + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); select(suggestions[cursor >= 0 ? cursor : 0]); }
    else if (event.key === 'Escape') setOpen(false);
  };

  React.useEffect(() => {
    if (!open || cursor < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [cursor, open]);

  const variants = current ? catalog.variants(current.base) : [];

  return (
    <div className="item-selector" id={`${id}-selector`} ref={rootRef}>
      <div className="search-wrap">
        <input type="search" id={`${id}-search`} className="item-search" placeholder={placeholder}
          autoComplete="off" spellCheck="false" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
        {open && (
          <div className="suggestions" id={`${id}-suggestions`} ref={listRef}>
            {suggestions.length ? suggestions.map((entry, i) => (
              <div key={entry.id} data-index={i} data-id={entry.id}
                className={cn('suggestion', i === cursor && 'active')} onMouseDown={e => e.preventDefault()}
                onClick={() => select(entry)}>
                <img src={catalog.icon(entry.id, quality)} alt="" loading="lazy" />
                <div className="suggestion-text"><strong>{entry.es}</strong><small>{entry.id}</small></div>
                <span className="pill">T{entry.tier}</span>
                {entry.lvl > 0 && <span className="pill gold">.{entry.lvl}</span>}
              </div>
            )) : <div className="suggestion muted">Sin resultados</div>}
          </div>
        )}
      </div>
      {variants.length > 1 && (
        <div className="enchant-chips" id={`${id}-chips`}>
          {variants.map(v => (
            <button type="button" key={v.id} data-id={v.id}
              className={cn('chip', v.id === current.id && 'active')} onClick={() => select(v)}>.{v.lvl}</button>
          ))}
        </div>
      )}
      {current ? (
        <div className="item-card" id={`${id}-card`}>
          <img src={catalog.icon(current.id, quality)} alt="" />
          <div className="item-card-text">
            <strong>{current.es}</strong><small>{current.id}</small>
            <div className="tags">
              <span className="pill">T{current.tier}</span>
              <span className="pill gold">.{current.lvl}</span>
              <span className="pill">{current.cat || '—'}</span>
              <span className="pill">valor {fmt(current.value)}</span>
              {current.amount > 1 && <span className="pill">×{current.amount}</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="item-card empty" id={`${id}-card`}><span>Elegí un ítem</span></div>
      )}
    </div>
  );
}
