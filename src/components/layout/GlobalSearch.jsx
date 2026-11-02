import * as React from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import * as catalog from '../../services/catalog.js';
import { MODULES } from '../../settings/index.js';
import { MODULE_ICONS } from './sidebar-data.js';
import { useApp } from '../../app/AppContext.jsx';

export function GlobalSearch() {
  const { navigate } = useApp();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef(null);

  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) return { modules: [], items: [] };
    return {
      modules: MODULES.filter(m => m.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5),
      items: catalog.search(q, 8),
    };
  }, [query]);

  React.useEffect(() => {
    const onDown = event => { if (!boxRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pickModule = id => { navigate(id); setQuery(''); setOpen(false); };
  const pickItem = id => { navigate('crafting', { itemId: id }); setQuery(''); setOpen(false); };
  const onKeyDown = event => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter') {
      if (results.modules.length) pickModule(results.modules[0].id);
      else if (results.items.length) pickItem(results.items[0].id);
    }
  };
  const hasResults = results.modules.length || results.items.length;

  return (
    <div className="global-search" ref={boxRef}>
      <Search className="global-search-icon size-4" />
      <Input type="search" placeholder="Buscar módulos o ítems…" aria-label="Búsqueda global"
        value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      {open && query.trim() && (
        <div className="search-popover">
          {!hasResults && <div className="search-hint">Sin resultados para «{query}».</div>}
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
          {results.items.length > 0 && (
            <>
              <div className="search-section">Ítems · abre en Crafteo</div>
              {results.items.map(entry => (
                <button type="button" key={entry.id} className="dropdown-item" onClick={() => pickItem(entry.id)}>
                  <img src={catalog.icon(entry.id)} alt="" width="20" height="20" />
                  <span>{entry.es}<small style={{ color: 'var(--faint)' }}> · {entry.id}</small></span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
