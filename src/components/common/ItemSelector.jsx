/* Buscador de ítems (React) con autocompletado, variantes y ficha. */
import * as React from 'react';
import * as catalog from '../../services/catalog.js';
import { fmt } from '../../services/format.js';
import { CATEGORIES } from '../../settings/index.js';
import { Field, Select } from './Field.jsx';
import { cn } from '../../lib/utils.js';

const SUGGESTION_PAGE_SIZE = 100;

export function ItemSelector({
  id = 'item',
  placeholder = 'Buscar por nombre o ID…',
  filter = null,
  quality = 1,
  value = null,
  onChange = () => {},
  showCategory = false,
  showVariants = true,
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(-1);
  const [suggestionLimit, setSuggestionLimit] = React.useState(SUGGESTION_PAGE_SIZE);
  const [current, setCurrent] = React.useState(null);
  const [category, setCategory] = React.useState('');
  const [subcategory, setSubcategory] = React.useState('');
  const rootRef = React.useRef(null);
  const listRef = React.useRef(null);

  const subcategoryOptions = React.useMemo(() => {
    if (!category) return [];
    const options = new Map();
    catalog.entries.forEach(entry => {
      if (entry.categoryId !== category || (filter && !filter(entry)) || !entry.subcategoryId) return;
      if (!options.has(entry.subcategoryId)) {
        options.set(entry.subcategoryId, catalog.subcategoryLabel(category, entry.subcategoryId));
      }
    });
    return [...options]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [category, filter]);
  const subcategoryItems = React.useMemo(() => {
    if (!category || !subcategory) return [];
    return catalog.entries
      .filter(
        entry =>
          entry.lvl === 0 &&
          entry.categoryId === category &&
          entry.subcategoryId === subcategory &&
          (!filter || filter(entry)),
      )
      .sort((a, b) => a.tier - b.tier || a.es.localeCompare(b.es, 'es') || a.id.localeCompare(b.id));
  }, [category, subcategory, filter]);
  const categoryFilter = React.useCallback(
    entry =>
      (!filter || filter(entry)) &&
      (!category || entry.categoryId === category) &&
      (!subcategory || entry.subcategoryId === subcategory),
    [filter, category, subcategory],
  );
  const searchResults = React.useMemo(() => {
    if (!query.trim()) return catalog.search('', 12, categoryFilter);
    return catalog.search(query, suggestionLimit + 1, categoryFilter);
  }, [query, categoryFilter, suggestionLimit]);
  const suggestions = searchResults.slice(0, suggestionLimit);
  const hasMoreSuggestions = !!query.trim() && searchResults.length > suggestionLimit;

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

  const clearSelection = () => {
    setCurrent(null);
    setQuery('');
    setOpen(false);
    setCursor(-1);
    setSuggestionLimit(SUGGESTION_PAGE_SIZE);
    onChange(null);
  };

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor(c => Math.min(suggestions.length - 1, c + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor(c => Math.max(0, c - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(suggestions[cursor >= 0 ? cursor : 0]);
    } else if (event.key === 'Escape') setOpen(false);
  };

  React.useEffect(() => {
    if (!open || cursor < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [cursor, open]);

  const variants = current ? catalog.variants(current.base) : [];

  return (
    <div className="item-selector" id={`${id}-selector`} ref={rootRef}>
      {showCategory && (
        <>
          <Select
            id={`${id}-category`}
            label="Categoría"
            options={CATEGORIES}
            value={category}
            onChange={value => {
              setCategory(value);
              setSubcategory('');
              clearSelection();
            }}
          />
          {subcategoryOptions.length > 1 && (
            <Select
              id={`${id}-subcategory`}
              label="Subcategoría"
              options={[{ value: '', label: 'Todas las subcategorías' }, ...subcategoryOptions]}
              value={subcategory}
              onChange={value => {
                setSubcategory(value);
                clearSelection();
              }}
            />
          )}
          {subcategory && (
            <Field label="Ítem">
              <select
                id={`${id}-exact-item`}
                value={current ? (current.lvl > 0 ? current.base : current.id) : ''}
                onChange={event => {
                  const entry = catalog.get(event.target.value);
                  if (entry) select(entry);
                }}
              >
                <option value="">Elegí un ítem…</option>
                {subcategoryItems.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.es}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      <div className="search-wrap">
        <input
          type="search"
          id={`${id}-search`}
          className="item-search"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={open && cursor >= 0 ? `${id}-option-${cursor}` : undefined}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setCursor(-1);
            setSuggestionLimit(SUGGESTION_PAGE_SIZE);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {open && (
          <div
            className="suggestions"
            id={`${id}-suggestions`}
            ref={listRef}
            role="listbox"
            aria-label="Sugerencias de ítems"
          >
            {suggestions.length ? (
              suggestions.map((entry, i) => (
                <div
                  key={entry.id}
                  data-index={i}
                  data-id={entry.id}
                  id={`${id}-option-${i}`}
                  role="option"
                  aria-selected={i === cursor}
                  className={cn('suggestion', i === cursor && 'active')}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => select(entry)}
                >
                  <img src={catalog.icon(entry.id, quality)} alt="" loading="lazy" />
                  <div className="suggestion-text">
                    <strong>{entry.es}</strong>
                    <small>{entry.id}</small>
                  </div>
                  <span className="pill">T{entry.tier}</span>
                  {entry.lvl > 0 && <span className="pill gold">.{entry.lvl}</span>}
                </div>
              ))
            ) : (
              <div className="suggestion muted">Sin resultados</div>
            )}
            {hasMoreSuggestions && (
              <button
                type="button"
                className="suggestion-more"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setSuggestionLimit(limit => limit + SUGGESTION_PAGE_SIZE)}
              >
                Mostrar más resultados
              </button>
            )}
          </div>
        )}
      </div>
      {showVariants && variants.length > 1 && (
        <div className="enchant-chips" id={`${id}-chips`}>
          {variants.map(v => (
            <button
              type="button"
              key={v.id}
              data-id={v.id}
              className={cn('chip', v.id === current.id && 'active')}
              onClick={() => select(v)}
            >
              .{v.lvl}
            </button>
          ))}
        </div>
      )}
      {current ? (
        <div className="item-card" id={`${id}-card`}>
          <img src={catalog.icon(current.id, quality)} alt="" />
          <div className="item-card-text">
            <strong>{current.es}</strong>
            <small>{current.id}</small>
            <div className="tags">
              <span className="pill">T{current.tier}</span>
              <span className="pill gold">.{current.lvl}</span>
              <span className="pill">{catalog.categoryLabel(current.categoryId)}</span>
              <span className="pill">valor {fmt(current.value)}</span>
              {current.amount > 1 && <span className="pill">×{current.amount}</span>}
              {catalog.isUntranslated(current) && (
                <span
                  className="pill warn"
                  title="El dump del juego no trae nombre oficial; se muestra el ID."
                >
                  {catalog.UNTRANSLATED_LABEL}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="item-card empty" id={`${id}-card`}>
          <span>Elegí un ítem</span>
        </div>
      )}
    </div>
  );
}
