import * as React from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import * as catalog from '../../services/catalog.js';
import { MODULES } from '../../settings/index.js';
import { MODULE_ICONS } from './sidebar-data.js';
import { useApp } from '../../app/AppContext.jsx';

const ITEM_PAGE_SIZE = 100;

export function GlobalSearch() {
  const { navigate } = useApp();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [itemLimit, setItemLimit] = React.useState(ITEM_PAGE_SIZE);
  const boxRef = React.useRef(null);

  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) return { modules: [], items: [] };
    return {
      modules: MODULES.filter(m => m.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5),
      items: catalog.search(q, itemLimit + 1),
    };
  }, [query, itemLimit]);
  const visibleItems = results.items.slice(0, itemLimit);
  const hasMoreItems = results.items.length > itemLimit;

  React.useEffect(() => {
    const onDown = event => { if (!boxRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pickModule = id => { navigate(id); setQuery(''); setOpen(false); };
  const pickItem = id => {
    const entry = catalog.get(id);
    const moduleId = entry?.refine ? 'refining'
      : entry?.categoryId === 'mounts' ? 'mounts' : 'crafting';
    navigate(moduleId, { itemId: id });
    setQuery('');
    setOpen(false);
  };
  const onKeyDown = event => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter') {
      if (results.modules.length) pickModule(results.modules[0].id);
      else if (results.items.length) pickItem(results.items[0].id);
    }
  };
  return (
    <div className="global-search" ref={boxRef}>
      <Search className="global-search-icon size-4" />
      <Input type="search" placeholder="Buscar módulos o ítems…" aria-label="Búsqueda global"
        aria-expanded={open && !!query.trim()} aria-controls="global-search-popover"
        value={query} onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setItemLimit(ITEM_PAGE_SIZE);
        }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {open && query.trim() && (
        <div className="search-popover" id="global-search-popover" role="group" aria-label="Resultados de búsqueda">
          {!results.modules.length && !results.items.length && <div className="search-hint">Sin resultados para «{query}».</div>}
          {results.modules.length > 0 && (
            <>
              <div className="search-section">Módulos</div>
              {results.modules.map(m => {
                const Icon = MODULE_ICONS[m.id];
                return (
                  <button type="button" key={m.id} className="dropdown-item" onClick={() => pickModule(m.id)}>
                    <Icon className="size-4" /><span>{m.label}</span><CornerDownLeft className="size-3 dropdown-chevron" />
                  </button>
                );
              })}
            </>
          )}
          {visibleItems.length > 0 && (
            <>
              <div className="search-section">Ítems · abre en su calculadora</div>
              {visibleItems.map(entry => (
                <button type="button" key={entry.id} data-id={entry.id} className="dropdown-item"
                  onClick={() => pickItem(entry.id)}>
                  <img src={catalog.icon(entry.id)} alt="" width="20" height="20" />
                  <span>{entry.es}<small style={{ color: 'var(--faint)' }}> · {entry.id}</small></span>
                </button>
              ))}
              {hasMoreItems && (
                <button type="button" className="dropdown-item" onClick={() => setItemLimit(limit => limit + ITEM_PAGE_SIZE)}>
                  Mostrar más ítems
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
