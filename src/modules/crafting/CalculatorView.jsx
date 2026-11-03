/* Vista de calculadora reutilizable por los 8 módulos de producción (React). */
import * as React from 'react';
import { CITIES, CRAFT_CITIES, TAX } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import * as engine from '../../services/engine.js';
import { bonusFor, bestCityFor, cityLabel } from '../../services/bonus.js';
import { esc, fmt, fmt1, fmt2, ageFromDate } from '../../services/format.js';
import { useApp } from '../../app/AppContext.jsx';
import { Select, NumberField, Toggle } from '../../components/common/Field.jsx';
import { Tabs } from '../../components/common/Tabs.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ResultGrid } from '../../components/common/ResultCard.jsx';
import { ItemSelector } from '../../components/common/ItemSelector.jsx';
import { ProfitBars } from '../../components/charts/PriceBars.jsx';
import { MODULE_ICONS } from '../../components/layout/sidebar-data.js';
import { cn } from '../../lib/utils.js';
import TransmutationView from './TransmutationView.jsx';

const CITY_OPTIONS = CITIES.map(c => ({ value: c.value, label: c.label }));
const TABS = [{ id: 'calc', label: 'Calculadora' }, { id: 'cities', label: 'Comparar ciudades' }];
const REFINING_TYPES = [
  { value: 'wood', label: 'Madera · tablas' },
  { value: 'ore', label: 'Mineral · lingotes' },
  { value: 'hide', label: 'Pieles · cuero' },
  { value: 'fiber', label: 'Fibra · tela' },
  { value: 'rock', label: 'Piedra · bloques' },
];
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));

function Age({ value, manual, missing, city, source }) {
  if (manual) return <span className="age none">precio manual</span>;
  if (missing) return <span className="age none">No se registra precio</span>;
  if (!value) return <span className="age none">sin dato</span>;
  const a = ageFromDate(value);
  return <span className={`age ${a.tone}`}>
    {source === 'cache' ? 'cotización anterior · ' : ''}{city ? `${city} · ` : ''}{a.label}
  </span>;
}

function lowestRecordedPrice(map, id, cities, quality, mode) {
  const quotes = cities.map(city => api.priceAt(map, id, city, quality, mode)).filter(Boolean);
  if (!quotes.length) return null;
  return quotes.reduce((lowest, quote) => quote.price < lowest.price ? quote : lowest);
}

export default function CalculatorView({
  moduleId, scopeLabel = 'Catálogo completo', filter = null, meta, showModuleHead = true,
}) {
  const { shared, prefs, setPrefs, pending, navigate } = useApp();
  const Icon = MODULE_ICONS[moduleId];
  const isEnchanting = moduleId === 'enchanting';
  const isRefining = moduleId === 'refining';
  const tabs = isRefining
    ? [...TABS, { id: 'transmutation', label: 'Transmutación' }]
    : TABS;
  const showSellCityPrices = moduleId === 'crafting' || moduleId === 'enchanting';
  const initialCfg = React.useMemo(() => ({
    craftCity: prefs.craftCity || 'Thetford', syncBuy: prefs.syncBuyCity !== false,
    runs: 1, rrrMode: prefs.rrrMode || 'auto', rrrPreset: '15.2', rrr: 15.2,
    focus: !!prefs.focus, dailyBonus: prefs.dailyBonus || 0,
    stationFee: prefs.stationFee || 0,
    buyCity: prefs.buyCity || 'Martlock', buyMode: prefs.buyMode || 'instant', buyOrderFee: false,
    sellCity: prefs.sellCity || 'Lymhurst', sellMode: prefs.sellMode || 'order',
    journal: false,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [item, setItem] = React.useState(null);
  const [refiningType, setRefiningType] = React.useState('');
  const [refiningTier, setRefiningTier] = React.useState('');
  const [refiningLevel, setRefiningLevel] = React.useState('');
  const [useHeartRecipe, setUseHeartRecipe] = React.useState(false);
  const [enchantBase, setEnchantBase] = React.useState(null);
  const [baseMode, setBaseMode] = React.useState('buy');
  const [cfg, setCfg] = React.useState(initialCfg);
  const [prices, setPrices] = React.useState({});
  const [manualPrices, setManualPrices] = React.useState({});
  const [saleQuotes, setSaleQuotes] = React.useState(null);
  const [rowCities, setRowCities] = React.useState({});
  const [tab, setTab] = React.useState('calc');
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [compare, setCompare] = React.useState(null);
  const [compareBusy, setCompareBusy] = React.useState(false);
  const autoPriceRequest = React.useRef('');
  const priceLoadId = React.useRef(0);

  const refiningEntries = React.useMemo(
    () => catalog.entries.filter(entry => entry.refine),
    [],
  );
  const refiningTierOptions = [...new Set(refiningEntries
    .filter(entry => entry.ccat === refiningType && entry.lvl === 0)
    .map(entry => entry.tier))]
    .sort((a, b) => a - b)
    .map(tier => ({ value: String(tier), label: `T${tier}` }));
  const refiningEnchantmentOptions = [...new Set(refiningEntries
    .filter(entry => entry.ccat === refiningType && entry.tier === Number(refiningTier))
    .map(entry => entry.lvl))]
    .sort((a, b) => a - b)
    .map(level => ({
      value: String(level),
      label: level === 0 ? '.0 · Sin encantamiento' : `.${level}`,
    }));

  const enchantmentOptions = React.useMemo(
    () => {
      if (!enchantBase) return [];
      const variants = catalog.enchantmentVariants(enchantBase.base);
      const sequential = [];
      for (let level = 1; variants.some(option => option.lvl === level); level += 1) {
        sequential.push(variants.find(option => option.lvl === level));
      }
      return sequential;
    },
    [enchantBase],
  );
  const recipeResources = React.useMemo(() => {
    if (!item) return [];
    if (isRefining) return useHeartRecipe && item.alternateRes ? item.alternateRes : item.res;
    if (!isEnchanting) return item.res;
    const baseResources = baseMode === 'buy'
      ? (enchantBase ? [{ id: enchantBase.id, es: enchantBase.es, q: 1, ret: false, kind: 'base' }] : [])
      : (enchantBase?.res || []).map(resource => ({ ...resource, kind: 'craft' }));
    const enchantResources = enchantmentOptions
      .filter(option => option.lvl <= item.lvl)
      .map((option, index) => ({
        ...option.upgrade,
        ret: false,
        kind: 'enchantment',
        stepLabel: `Paso .${index} → .${option.lvl}`,
      }));
    return [...baseResources, ...enchantResources];
  }, [item, isEnchanting, isRefining, useHeartRecipe, enchantBase, baseMode, enchantmentOptions]);

  const currentTarget = key => targets().find(target => target.key === key) || null;
  const manualKey = target => JSON.stringify([
    shared.server, shared.quality, target.id, target.city, target.mode,
  ]);
  const priceRecord = key => {
    const target = currentTarget(key);
    const override = target ? manualPrices[`${key}|${manualKey(target)}`] : undefined;
    if (override !== undefined) return {
      ...prices[key], value: override, manual: true, source: 'manual', missing: false,
    };
    const record = prices[key];
    if (target && record?.context && record.context !== manualKey(target)) {
      return { ...record, value: '', date: null, missing: true };
    }
    return record;
  };
  const getPrice = key => Number(priceRecord(key)?.value) || 0;
  const setPrice = (key, value) => {
    const target = currentTarget(key);
    if (!target) return;
    setManualPrices(current => ({ ...current, [`${key}|${manualKey(target)}`]: value }));
  };
  const clearManualPrice = key => {
    const target = currentTarget(key);
    if (!target) return;
    const storageKey = `${key}|${manualKey(target)}`;
    setManualPrices(current => {
      const next = { ...current };
      delete next[storageKey];
      return next;
    });
  };

  const setField = (key, value) => {
    setCfg(current => {
      const next = { ...current, [key]: value };
      if ((key === 'craftCity' || key === 'syncBuy') && next.syncBuy && next.craftCity !== 'auto') {
        next.buyCity = next.craftCity;
      }
      if (key === 'rrr' && next.rrrMode === 'manual') next.rrrPreset = 'custom';
      if (key === 'rrrPreset' && value !== 'custom') next.rrr = Number(value);
      return next;
    });
    const persist = {
      craftCity: 'craftCity', syncBuy: 'syncBuyCity', focus: 'focus', dailyBonus: 'dailyBonus',
      stationFee: 'stationFee', buyCity: 'buyCity', sellCity: 'sellCity',
      buyMode: 'buyMode', sellMode: 'sellMode', rrrMode: 'rrrMode',
    }[key];
    if (persist) setPrefs({ [persist]: value });
  };

  /* ---- Prefill desde búsqueda global, oportunidad o último ítem ---- */
  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const p = pending || {};
    if (p.tab) setTab(p.tab);
    if (p.opportunity) {
      if (isEnchanting) {
        const entry = catalog.get(p.opportunity.id);
        if (entry) applyEnchantBase(catalog.get(entry.base), entry.lvl);
      } else if (isRefining) {
        const entry = catalog.get(p.opportunity.id);
        if (entry) selectRefiningItem(entry);
        applyOpportunity(p.opportunity);
      } else applyOpportunity(p.opportunity);
      return;
    }
    const wanted = p.itemId || prefs[`lastItem:${moduleId}`]
      || (moduleId === 'crafting' ? prefs.lastItem : null);
    if (wanted) {
      const entry = catalog.get(wanted);
      if (isEnchanting) {
        const base = entry?.lvl > 0 ? catalog.get(entry.base) : entry;
        if (catalog.isEnchantableBase(base)) applyEnchantBase(base, entry?.lvl);
      } else if (isRefining) {
        if (entry?.refine) selectRefiningItem(entry);
      } else if (entry && (!filter || filter(entry))) applyItem(entry);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!isRefining) return;
    if (!refiningType || !refiningTier || !refiningLevel) {
      if (item) setItem(null);
      return;
    }
    const selected = refiningEntries.find(entry => entry.ccat === refiningType
      && entry.tier === Number(refiningTier) && entry.lvl === Number(refiningLevel));
    if (selected?.id !== item?.id) {
      if (selected) applyItem(selected);
      else setItem(null);
    }
  }, [isRefining, refiningEntries, refiningType, refiningTier, refiningLevel, item]);

  function applyItem(entry) {
    if (!entry) {
      setItem(null);
      return;
    }
    if (isRefining && entry.id !== item?.id) setUseHeartRecipe(false);
    setItem(entry);
    setPrefs({
      [`lastItem:${moduleId}`]: entry.id,
      ...(moduleId === 'crafting' ? { lastItem: entry.id } : {}),
    });
  }

  function selectRefiningItem(entry) {
    if (!entry?.refine) return;
    setRefiningType(entry.ccat);
    setRefiningTier(String(entry.tier));
    setRefiningLevel(String(entry.lvl));
    applyItem(entry);
  }

  function applyEnchantBase(entry, level = null) {
    if (!entry) {
      setEnchantBase(null);
      setItem(null);
      return;
    }
    if (!catalog.isEnchantableBase(entry)) return;
    setEnchantBase(entry);
    const options = catalog.enchantmentVariants(entry.base);
    const selected = options.find(option => option.lvl === Number(level)) || options[0];
    setItem(selected || null);
    if (selected) setPrefs({ [`lastItem:${moduleId}`]: selected.id });
  }

  function selectEnchantment(level) {
    const selected = enchantmentOptions.find(option => option.lvl === Number(level));
    if (!selected) return;
    setItem(selected);
    setPrefs({ [`lastItem:${moduleId}`]: selected.id });
  }

  function applyOpportunity(row) {
    const entry = catalog.get(row.id);
    if (!entry) return;
    setItem(entry);
    const craftOk = CRAFT_CITIES.some(c => c.value === row.craftCity);
    const buyOk = CITY_OPTIONS.some(c => c.value === (row.materialPrices?.[0]?.city || row.buyCity));
    const sellOk = CITY_OPTIONS.some(c => c.value === row.sellCity);
    setCfg(c => ({
      ...c,
      craftCity: craftOk ? row.craftCity : c.craftCity, syncBuy: false,
      buyCity: buyOk ? (row.materialPrices?.[0]?.city || row.buyCity) : c.buyCity,
      sellCity: sellOk ? row.sellCity : c.sellCity,
      buyMode: row.buyMode || c.buyMode, sellMode: row.sellMode || c.sellMode,
      focus: !!row.focus, dailyBonus: row.dailyBonus || 0,
      stationFee: row.stationFeePer100 || 0, rrrMode: 'manual', rrr: row.rrr,
    }));
    const next = { [`sell:${entry.id}`]: { value: row.sellPrice, date: row.sellDate, manual: false } };
    (row.materialPrices || []).forEach(p => {
      next[`mat:${p.id}`] = { value: p.price, date: p.date, manual: false };
    });
    setPrices(next);
    setStatus('Oportunidad cargada desde Flipping: revisá los diarios y precios.');
  }

  /* ---- RRR ---- */
  const bonus = React.useMemo(() => {
    const city = cfg.craftCity === 'auto'
      ? (item ? bestCityFor(item.ccat, item.refine) : 'Thetford') : cfg.craftCity;
    return bonusFor({ city, ccat: item?.ccat || '', isRefining: !!item?.refine,
      focus: cfg.focus, dailyBonusPct: cfg.dailyBonus });
  }, [cfg.craftCity, cfg.focus, cfg.dailyBonus, item]);
  const rrr = cfg.rrrMode === 'manual' ? clamp(cfg.rrr, 0, 100) : Math.round(bonus.rrrPct * 100) / 100;

  /* ---- Motor ---- */
  const result = React.useMemo(() => {
    if (!item) return null;
    const resources = recipeResources.map(r => ({
      id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: getPrice(`mat:${r.id}`),
    }));
    const j = item.journal;
    return engine.calculate({
      item, runs: Math.max(1, Number(cfg.runs) || 1),
      rrrPct: isEnchanting && baseMode === 'buy' ? 0 : rrr,
      itemValue: isEnchanting ? (enchantBase?.value || 0) : item.value,
      station: { mode: 'nutrition', feePer100: isEnchanting && baseMode === 'buy' ? 0 : Number(cfg.stationFee) || 0 },
      resources, buyMode: cfg.buyMode, buyOrderFee: cfg.buyOrderFee,
      sellMode: cfg.sellMode, sellPrice: getPrice(`sell:${item.id}`),
      journal: cfg.journal && j ? { enabled: true, fame: j.fame, max: j.max,
        emptyPrice: getPrice(`jrn:${j.empty}`), fullPrice: getPrice(`jrn:${j.full}`) } : null,
      premium: shared.premium,
    });
  }, [item, recipeResources, cfg, prices, manualPrices, rrr, shared.premium, isEnchanting, baseMode, enchantBase]); // eslint-disable-line react-hooks/exhaustive-deps
  const requiredPriceKeys = item ? [
    `sell:${item.id}`,
    ...recipeResources.map(resource => `mat:${resource.id}`),
    ...(cfg.journal && item.journal ? [`jrn:${item.journal.empty}`, `jrn:${item.journal.full}`] : []),
  ] : [];
  const missingPriceCount = requiredPriceKeys.filter(key => !(getPrice(key) > 0)).length;
  const pricesComplete = !!item && missingPriceCount === 0;

  const taxRate = shared.premium ? 4 : 8;
  const orderFee = cfg.sellMode === 'order' ? 2.5 : 0;

  /* ---- Precios ---- */
  function targets() {
    if (!item) return [];
    const list = recipeResources.map(r => ({
      key: `mat:${r.id}`, id: r.id, city: rowCities[r.id] ?? cfg.buyCity,
      mode: cfg.buyMode === 'instant' ? 'sell' : 'buy',
    }));
    list.push({ key: `sell:${item.id}`, id: item.id, city: cfg.sellCity,
      mode: cfg.sellMode === 'instant' ? 'buy' : 'sell' });
    const j = item.journal;
    if (cfg.journal && j) {
      list.push({ key: `jrn:${j.empty}`, id: j.empty, city: cfg.buyCity, mode: 'sell' });
      list.push({ key: `jrn:${j.full}`, id: j.full, city: cfg.sellCity,
        mode: cfg.sellMode === 'instant' ? 'buy' : 'sell' });
    }
    return list;
  }

  const priceRequestSignature = item ? JSON.stringify({
    server: shared.server, quality: shared.quality,
    sellCityPrices: showSellCityPrices ? CITIES.map(city => city.value) : [],
    targets: targets().map(({ key, id, city, mode }) => [key, id, city, mode]),
  }) : '';

  async function loadPrices() {
    const list = targets();
    if (!list.length) { setStatus('Elegí primero un ítem.'); return; }
    const cities = [...new Set([
      ...list.flatMap(target => target.city === 'Global' ? CITIES.map(city => city.value) : [target.city]),
      ...(showSellCityPrices ? CITIES.map(city => city.value) : []),
    ])];
    const currentRequest = ++priceLoadId.current;
    autoPriceRequest.current = priceRequestSignature;
    setBusy(true);
    setSaleQuotes(null);
    setStatus('Consultando precios…');
    try {
      const rows = await api.fetchPrices({
        server: shared.server, quality: shared.quality,
        ids: list.map(t => t.id), cities,
      });
      if (currentRequest !== priceLoadId.current) return;
      const map = api.indexRows(rows);
      const resolved = list.map(target => ({
        ...target,
        quote: target.city === 'Global'
          ? lowestRecordedPrice(map, target.id, CITIES.map(city => city.value), shared.quality, target.mode)
          : api.priceFor(api.pick(map, target.id, target.city, shared.quality), target.mode),
      }));
      setPrices(current => {
        const next = { ...current };
        resolved.forEach(({ key, quote }) => {
          next[key] = quote
            ? {
              value: quote.price, date: quote.date, city: quote.city, manual: false,
              source: quote.source, missing: false,
              context: manualKey(targets().find(target => target.key === key)),
            }
            : { value: '', date: null, city: null, manual: false, missing: true };
        });
        return next;
      });
      let bestCityLabel = '';
      if (showSellCityPrices && item) {
        const saleMode = cfg.sellMode === 'instant' ? 'buy' : 'sell';
        const quotes = CITIES.map(city => {
          const quote = api.priceAt(map, item.id, city.value, shared.quality, saleMode);
          return quote
            ? { ...quote, label: city.label }
            : { city: city.value, label: city.label, price: null, date: null };
        }).sort((a, b) => (b.price || 0) - (a.price || 0));
        setSaleQuotes({ itemId: item.id, sellMode: cfg.sellMode, quotes });
        bestCityLabel = quotes[0]?.label || '';
        const selectedQuote = quotes.find(quote => quote.city === cfg.sellCity);
        const selectedTarget = {
          key: `sell:${item.id}`, id: item.id, city: cfg.sellCity, mode: saleMode,
        };
        setPrices(current => ({
          ...current,
          [`sell:${item.id}`]: selectedQuote
            ? {
              value: selectedQuote.price, date: selectedQuote.date, city: selectedQuote.city,
              manual: false, source: selectedQuote.source, missing: false, context: manualKey(selectedTarget),
            }
            : { value: '', date: null, city: null, manual: false, missing: true },
        }));
      }
      const missingCount = resolved.filter(target => !target.quote).length;
      const hasGlobalTarget = list.some(target => target.city === 'Global');
      setStatus(`✔ Precios actualizados · ${rows.length} registros recibidos.${missingCount ? ` ${missingCount} precios sin registrar; cargalos manualmente.` : ''}${hasGlobalTarget ? ' Menor precio registrado por ciudad, sin promediar.' : ''}${bestCityLabel ? ` Mejor precio de venta: ${bestCityLabel}.` : ''}${api.cacheNotice(rows) ? ` ${api.cacheNotice(rows)}` : ''}`);
    } catch (error) {
      if (currentRequest === priceLoadId.current) setStatus('✖ ' + error.message);
    } finally {
      if (currentRequest === priceLoadId.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    if (!priceRequestSignature || autoPriceRequest.current === priceRequestSignature) return undefined;
    const timer = setTimeout(() => {
      if (autoPriceRequest.current === priceRequestSignature) return;
      autoPriceRequest.current = priceRequestSignature;
      void loadPrices();
    }, 250);
    return () => clearTimeout(timer);
  }, [priceRequestSignature]);

  async function compareCities() {
    if (!item) { setStatus('Elegí un ítem primero.'); return; }
    const ids = [item.id, ...recipeResources.map(r => r.id)];
    const cities = CITIES.map(c => c.value);
    setCompareBusy(true);
    setStatus('Comparando ciudades…');
    try {
      const rows = await api.fetchPrices({ server: shared.server, quality: shared.quality, ids, cities,
      });
      const map = api.indexRows(rows);
      const buyPriceMode = cfg.buyMode === 'instant' ? 'sell' : 'buy';
      const list = [];
      cities.forEach(city => {
        const sale = api.priceFor(api.pick(map, item.id, city, shared.quality),
          cfg.sellMode === 'instant' ? 'buy' : 'sell');
        if (!sale) return;
        let ok = true;
        const resources = recipeResources.map(r => {
          const materialCity = rowCities[r.id] ?? cfg.buyCity;
          let quote = materialCity === 'Global'
            ? lowestRecordedPrice(map, r.id, cities, shared.quality, buyPriceMode)
            : api.priceFor(api.pick(map, r.id, materialCity, shared.quality), buyPriceMode);
          if (!quote && materialCity !== 'Global') {
            quote = api.bestPrice(map, r.id, cities.slice(0, 7), shared.quality, buyPriceMode);
          }
          if (!quote) ok = false;
          return { id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: quote?.price || 0 };
        });
        if (!ok) return;
        const r = engine.calculate({
          item, runs: Number(cfg.runs) || 1,
          rrrPct: isEnchanting && baseMode === 'buy' ? 0 : rrr,
          itemValue: isEnchanting ? (enchantBase?.value || 0) : item.value,
          station: { mode: 'nutrition', feePer100: isEnchanting && baseMode === 'buy' ? 0 : Number(cfg.stationFee) || 0 },
          resources, buyMode: cfg.buyMode, buyOrderFee: cfg.buyOrderFee,
          sellMode: cfg.sellMode, sellPrice: sale.price, journal: null, premium: shared.premium,
        });
        list.push({ city, price: sale.price, profit: r.profit / r.outputQty, roi: r.roi,
          age: ageFromDate(sale.date).label });
      });
      list.sort((a, b) => b.profit - a.profit);
      setCompare(list);
      setStatus(list.length ? '✔ Comparación lista.' : '✖ Sin precios suficientes.');
    } catch (error) {
      setStatus('✖ ' + error.message);
    } finally { setCompareBusy(false); }
  }

  /* ---- Tablas ---- */
  const resourceById = id => result?.resources.find(r => r.id === id);
  const materialColumns = [
    { label: 'Material', render: r => (
      <div className="material-cell">
        <img src={catalog.icon(r.id, shared.quality)} alt="" />
        <div><strong>{r.es}</strong><small>{r.id}</small>
          {r.kind === 'base' && <span className="badge-no-return">ítem base comprado</span>}
          {r.kind === 'enchantment' && (
            <>
              <span className="badge-no-return">{r.stepLabel}</span>
              <span className="badge-no-return">runa, alma o reliquia</span>
            </>
          )}
          {r.ret === false && <span className="badge-no-return">no retorna</span>}
        </div>
      </div>
    ) },
    { label: isEnchanting ? 'Por encantamiento' : 'Por crafteo', align: 'right', render: r => fmt(r.q) },
    { label: 'Bruto', align: 'right', render: r => fmt(resourceById(r.id)?.grossQty || 0) },
    { label: 'Devuelto', align: 'right', render: r => '−' + fmt(resourceById(r.id)?.expected || 0) },
    { label: 'Neto', align: 'right', render: r => fmt(resourceById(r.id)?.netQty || 0) },
    { label: 'Ciudad', render: r => (
      <select className="row-city" value={rowCities[r.id] ?? cfg.buyCity}
        onChange={e => setRowCities(current => ({ ...current, [r.id]: e.target.value }))}>
        <option value="Global">Menor precio registrado (todas las ciudades)</option>
        {CITY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    ) },
    { label: 'Precio', align: 'right', render: r => {
      const key = `mat:${r.id}`;
      return (
        <div className="price-cell">
          <input className={cn('row-price', priceRecord(key)?.manual && 'manual')} type="number" min="0"
            aria-label={`Precio de ${r.es}`} value={priceRecord(key)?.value ?? ''}
            placeholder={priceRecord(key)?.missing ? '—' : 'Manual'}
            onChange={e => setPrice(key, e.target.value)} />
          <Age value={priceRecord(key)?.date} manual={priceRecord(key)?.manual}
            source={priceRecord(key)?.source} missing={priceRecord(key)?.missing}
            city={priceRecord(key)?.city} />
          {priceRecord(key)?.manual && <button type="button" className="btn ghost"
            onClick={() => clearManualPrice(key)}>Usar precio AODP</button>}
        </div>
      );
    } },
    { label: 'Coste neto', align: 'right', render: r => getPrice(`mat:${r.id}`) > 0
      ? fmt(resourceById(r.id)?.netCost || 0)
      : priceRecord(`mat:${r.id}`)?.missing ? 'No se registra precio' : '—' },
  ];

  const saleCityColumns = [
    { label: 'Ciudad', render: quote => (
      <div className="sale-city-choice">
        <strong>{quote.label}</strong>
        {quote.price && quote.price === saleQuotes?.quotes.find(entry => entry.price)?.price
          && <span className="pill positive">Mejor precio</span>}
      </div>
    ) },
    { label: 'Precio de venta', align: 'right', render: quote => quote.price
      ? fmt(quote.price)
      : <span className="hint">No se registra precio</span> },
    { label: 'Actualizado', render: quote => quote.price
      ? <Age value={quote.date} />
      : <span className="age none">No se registra precio</span> },
    { label: '', align: 'right', render: quote => (
      <button type="button" className="btn tiny" disabled={!quote.price} onClick={() => {
        setField('sellCity', quote.city);
        const target = {
          key: `sell:${item.id}`, id: item.id, city: quote.city,
          mode: cfg.sellMode === 'instant' ? 'buy' : 'sell',
        };
        setPrices(current => ({
          ...current,
          [`sell:${item.id}`]: {
            value: quote.price, date: quote.date, city: quote.city, manual: false,
            source: quote.source, missing: false, context: manualKey(target),
          },
        }));
      }}>Elegir ciudad</button>
    ) },
  ];

  const breakdown = result && pricesComplete ? [
    ['Unidades producidas', fmt(result.outputQty), ''],
    ['Ingreso bruto', fmt(result.grossRevenue), ''],
    ['Impuesto de venta', '−' + fmt(result.salesTax), 'negative'],
    ['Tarifa de orden de venta', '−' + fmt(result.setupFee), 'negative'],
    ['Ingreso por diarios llenos', '+' + fmt(result.journalRevenue), 'positive'],
    ['Materiales brutos', fmt(result.grossMaterials), ''],
    ['Devolución por RRR', '+' + fmt(result.returnedValue), 'positive'],
    ['Materiales netos', fmt(result.netMaterials), ''],
    ['Tarifa de orden de compra', '−' + fmt(result.buyOrderFee), 'negative'],
    ['Tasa de estación', '−' + fmt(result.stationFee), 'negative'],
    ['Diarios vacíos', '−' + fmt(result.journalCost), 'negative'],
    ['Coste total', fmt(result.totalCosts), 'total'],
  ] : [];

  const verdict = !result ? '—' : !pricesComplete ? 'Precios incompletos'
    : result.profit > 0 ? 'Rentable' : result.profit < 0 ? 'Pérdida' : 'Punto muerto';
  const verdictTone = !result || !pricesComplete ? '' : result.profit > 0 ? 'good' : result.profit < 0 ? 'bad' : 'even';
  const craftingEnabled = !isEnchanting || baseMode === 'craft';

  return (
    <div className="module-view" data-module={moduleId}>
      {showModuleHead && <div className="module-head">
        <div>
          <h1>{Icon ? <Icon className="size-5" /> : <span className="head-emoji">{meta?.icon}</span>}{meta?.label}</h1>
          <p>{meta?.description}</p>
        </div>
        <span className="module-badge">{meta?.group}</span>
      </div>}
      <Tabs id="calc-tabs" tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'calc' ? (
        <div className="work-grid">
          <div className="config-col">
            <section className="card">
              <div className="card-head"><h2>1 · Ítem</h2><span className="card-tag">{scopeLabel}</span></div>
              {isRefining ? (
                <>
                  <Select id="calc-refining-type" label="Tipo de recurso"
                    options={[{ value: '', label: 'Elegí un recurso…' }, ...REFINING_TYPES]}
                    value={refiningType}
                    onChange={value => {
                      setRefiningType(value);
                      setRefiningTier('');
                      setRefiningLevel('');
                    }} />
                  <Select id="calc-refining-tier" label="Nivel"
                    options={[{ value: '', label: 'Elegí un nivel…' }, ...refiningTierOptions]}
                    value={refiningTier} disabled={!refiningType}
                    onChange={value => {
                      setRefiningTier(value);
                      setRefiningLevel('');
                    }} />
                  <Select id="calc-refining-enchantment" label="Encantamiento"
                    options={[{ value: '', label: 'Elegí un encantamiento…' }, ...refiningEnchantmentOptions]}
                    value={refiningLevel} disabled={!refiningTier}
                    onChange={setRefiningLevel} />
                  <div className={cn('item-card', !item && 'empty')} id="calc-refining-selection">
                    {item ? (
                      <>
                        <img src={catalog.icon(item.id, shared.quality)} alt="" />
                        <div className="item-card-text">
                          <strong>{item.es}</strong><small>{item.id}</small>
                          <div className="tags">
                            <span className="pill">T{item.tier}</span>
                            <span className="pill gold">.{item.lvl}</span>
                          </div>
                        </div>
                      </>
                    ) : <span>Elegí tipo, nivel y encantamiento</span>}
                  </div>
                </>
              ) : isEnchanting ? (
                <>
                  <ItemSelector id="calc-item" filter={catalog.isEnchantableBase} quality={shared.quality}
                    value={enchantBase?.id || null} showCategory showVariants={false}
                    placeholder="Buscar el ítem base por nombre o ID…" onChange={entry => applyEnchantBase(entry)} />
                  <Select id="calc-enchantment-level" label="Encantamiento de destino"
                    options={enchantmentOptions.map(option => ({
                      value: String(option.lvl),
                      label: `.${option.lvl} · ${option.upgrade.es}`,
                    }))}
                    value={item ? String(item.lvl) : ''}
                    disabled={!enchantBase}
                    onChange={selectEnchantment} />
                </>
              ) : (
                <ItemSelector id="calc-item" filter={filter} quality={shared.quality} value={item?.id || null}
                  showCategory={moduleId === 'crafting'}
                  placeholder="Buscar por nombre o ID del ítem…" onChange={applyItem} />
              )}
            </section>

            <section className="card">
              <div className="card-head"><h2>2 · Producción</h2></div>
              {isEnchanting && (
                <Select id="calc-base-mode" label="Cómo obtener el ítem base"
                  options={[{ value: 'buy', label: 'Comprar el ítem base' },
                    { value: 'craft', label: 'Craftear el ítem base' }]}
                  value={baseMode} onChange={setBaseMode} />
              )}
              <NumberField id="calc-runs" label={isEnchanting ? 'Cantidad (lote)' : 'Crafteos (lotes)'}
                value={cfg.runs} min={1}
                onChange={v => setField('runs', v)} />
              {!isEnchanting && (
                <Select id="calc-craft-city" label="Dónde craftear" options={CRAFT_CITIES}
                value={cfg.craftCity} onChange={v => setField('craftCity', v)}
                  hint="Define el bonus de producción y el RRR" />
              )}
              {isEnchanting && craftingEnabled && (
                <Select id="calc-craft-city" label="Dónde craftear el ítem base" options={CRAFT_CITIES}
                  value={cfg.craftCity} onChange={v => setField('craftCity', v)}
                  hint="Define el bonus de producción y el RRR del ítem base" />
              )}
              {(!isEnchanting || craftingEnabled) && (
                <Toggle id="calc-sync-buy" label="Comprar materiales en esa ciudad"
                  checked={cfg.syncBuy} disabled={!craftingEnabled} onChange={v => setField('syncBuy', v)} />
              )}
              {(!isEnchanting || craftingEnabled) && (
              <Select id="calc-rrr-mode" label="Return Rate"
                options={[{ value: 'auto', label: 'Automático (ciudad + Focus)' }, { value: 'manual', label: 'Manual' }]}
                value={cfg.rrrMode} disabled={!craftingEnabled} onChange={v => setField('rrrMode', v)} />
              )}
              {(!isEnchanting || craftingEnabled) && cfg.rrrMode === 'manual' && (
                <Select id="calc-rrr-preset" label="Preset"
                  options={[{ value: '15.2', label: 'Sin bonus · 15,2 %' }, { value: '36.7', label: 'Ciudad · 36,7 %' },
                    { value: '43.5', label: 'Focus · 43,5 %' }, { value: '53.9', label: 'Ciudad + Focus · 53,9 %' },
                    { value: 'custom', label: 'Personalizado' }]}
                  value={cfg.rrrPreset} disabled={!craftingEnabled} onChange={v => setField('rrrPreset', v)} />
              )}
              {(!isEnchanting || craftingEnabled) && <NumberField id="calc-rrr" label="RRR (%)" value={cfg.rrrMode === 'manual' ? cfg.rrr : rrr}
                min={0} step={0.1} disabled={!craftingEnabled} readOnly={cfg.rrrMode !== 'manual'}
                onChange={v => setField('rrr', v)} />
              }
              {(!isEnchanting || craftingEnabled) && <p className="hint" id="calc-rrr-info">
                {cfg.rrrMode === 'manual'
                  ? 'RRR manual: podés usar un preset o escribir el valor.'
                  : `Bonus en ${cityLabel(cfg.craftCity === 'auto' ? (item ? bestCityFor(item.ccat, item.refine) : 'Thetford') : cfg.craftCity)}: ${bonus.total.toFixed(2)} → RRR ${fmt2(rrr)} % (base ${bonus.base.toFixed(2)} + categoría ${bonus.modifier.toFixed(2)} + Focus ${bonus.focus.toFixed(2)} + diario ${bonus.daily.toFixed(2)})`}
              </p>}
              {(!isEnchanting || craftingEnabled) && <Toggle id="calc-focus" label="Usar Focus (+59 % bonus)"
                checked={cfg.focus} disabled={!craftingEnabled} onChange={v => setField('focus', v)} />}
              {(!isEnchanting || craftingEnabled) && <NumberField id="calc-daily-bonus" label="Bonus diario (%)" value={cfg.dailyBonus}
                disabled={!craftingEnabled}
                onChange={v => setField('dailyBonus', v)} />
              }
              {(!isEnchanting || craftingEnabled) && <hr />}
              {(!isEnchanting || craftingEnabled) && <NumberField id="calc-station-fee" label="Tasa de estación (plata / 100 nutrición)"
                value={cfg.stationFee} onChange={v => setField('stationFee', v)}
                disabled={!craftingEnabled} hint="Valor que fija el dueño de la estación; se introduce a mano" />}
              {(!isEnchanting || craftingEnabled) && <p className="hint" id="calc-station-info">
                Nutrición por crafteo: {fmt2(result?.nutritionPerRun || 0)} · total: {fmt2(result?.nutritionTotal || 0)} · coste: {fmt(result?.stationFee || 0)} p
              </p>}
              {isEnchanting && !craftingEnabled && (
                <p className="hint" id="calc-crafting-disabled">
                  Los bonus de crafteo y la tasa de estación solo se aplican si crafteás el ítem base.
                </p>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h2>3 · Mercado e impuestos</h2></div>
              <Select id="calc-buy-city"
                label={isEnchanting && baseMode === 'buy'
                  ? 'Dónde comprar el ítem base y los materiales' : 'Dónde comprar los materiales'}
                options={CITY_OPTIONS}
                value={cfg.buyCity} onChange={v => setField('buyCity', v)} />
              <Select id="calc-buy-mode" label="Modo de compra"
                options={[{ value: 'instant', label: 'Compra inmediata (sell_price_min)' },
                  { value: 'order', label: 'Orden de compra (buy_price_max)' }]}
                value={cfg.buyMode} onChange={v => setField('buyMode', v)} />
              <Toggle id="calc-buy-order-fee" label="Sumar tarifa de orden de compra (2,5 %)"
                checked={cfg.buyOrderFee} onChange={v => setField('buyOrderFee', v)} />
              <hr />
              <Select id="calc-sell-city" label="Dónde vender" options={CITY_OPTIONS}
                value={cfg.sellCity} onChange={v => setField('sellCity', v)} />
              <Select id="calc-sell-mode" label="Modo de venta"
                options={[{ value: 'order', label: 'Orden de venta (sell_price_min)' },
                  { value: 'instant', label: 'Venta directa (buy_price_max)' }]}
                value={cfg.sellMode} onChange={v => setField('sellMode', v)} />
              <div className="tax-box" id="calc-tax-summary">
                <div><span>Impuesto de transacción ({shared.premium ? 'Premium' : 'sin Premium'})</span><b>{taxRate} %</b></div>
                <div><span>Tarifa de orden de venta</span><b>{cfg.sellMode === 'order' ? '2,5 %' : 'no aplica'}</b></div>
                <div><span>Deducción total</span><b>{fmt2(taxRate + orderFee)} %</b></div>
                <div><span>Tarifa de orden de compra</span><b>{cfg.buyMode === 'order' && cfg.buyOrderFee ? '2,5 %' : 'no aplica'}</b></div>
              </div>
              <button type="button" className="btn primary full" id="calc-load-prices" disabled={busy}
                onClick={() => loadPrices()}>↻ Cargar precios del mercado</button>
              <p className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')} id="calc-status">{status}</p>
            </section>

            <section className="card">
              <div className="card-head"><h2>4 · Diarios</h2></div>
              <Toggle id="calc-journal" label="Usar diarios de crafteo" checked={cfg.journal}
                disabled={!item?.journal} onChange={v => setField('journal', v)} />
              {!item?.journal ? (
                <p className="hint" id="calc-journal-none">Este ítem no genera diarios.</p>
              ) : cfg.journal ? (
                <div id="calc-journal-block">
                  <p className="hint" id="calc-journal-name">
                    {item.journal.type} · fama por crafteo {fmt(item.journal.fame)} · máxima {fmt(item.journal.max)}
                  </p>
                  <NumberField id="calc-journal-empty" label="Diario vacío · precio unitario"
                    value={priceRecord(`jrn:${item.journal.empty}`)?.value ?? ''}
                    placeholder={priceRecord(`jrn:${item.journal.empty}`)?.missing ? 'No se registra precio' : 'Manual'}
                    onChange={v => setPrice(`jrn:${item.journal.empty}`, v)} />
                  {priceRecord(`jrn:${item.journal.empty}`)?.manual && <button type="button" className="btn ghost"
                    onClick={() => clearManualPrice(`jrn:${item.journal.empty}`)}>Usar precio AODP</button>}
                  <NumberField id="calc-journal-full" label="Diario lleno · precio unitario"
                    value={priceRecord(`jrn:${item.journal.full}`)?.value ?? ''}
                    placeholder={priceRecord(`jrn:${item.journal.full}`)?.missing ? 'No se registra precio' : 'Manual'}
                    onChange={v => setPrice(`jrn:${item.journal.full}`, v)} />
                  {priceRecord(`jrn:${item.journal.full}`)?.manual && <button type="button" className="btn ghost"
                    onClick={() => clearManualPrice(`jrn:${item.journal.full}`)}>Usar precio AODP</button>}
                  <Age value={priceRecord(`jrn:${item.journal.empty}`)?.date}
                    manual={priceRecord(`jrn:${item.journal.empty}`)?.manual}
                    source={priceRecord(`jrn:${item.journal.empty}`)?.source}
                    missing={priceRecord(`jrn:${item.journal.empty}`)?.missing} />
                  <Age value={priceRecord(`jrn:${item.journal.full}`)?.date}
                    manual={priceRecord(`jrn:${item.journal.full}`)?.manual}
                    source={priceRecord(`jrn:${item.journal.full}`)?.source}
                    missing={priceRecord(`jrn:${item.journal.full}`)?.missing} />
                  <p className="hint" id="calc-journal-fame">
                    Vacíos: {result?.journal?.required ?? 0} · llenos: {result?.journal?.full ?? 0} · parcial: {fmt2(result?.journal?.partialPct ?? 0)} %
                  </p>
                </div>
              ) : null}
            </section>
          </div>

          <div className="results-col">
            <section className="card">
              <div className="card-head"><h2>{isRefining
                ? (useHeartRecipe ? 'Receta alternativa y precios' : 'Receta principal y precios')
                : 'Receta y precios'}</h2>
                <span className="card-tag" id="calc-recipe-meta">
                  {item ? `${item.id} · ${recipeResources.length} materiales` : 'Sin ítem'}
                </span>
              </div>
              {isRefining && item?.alternateRes?.length > 0 && (
                <Toggle id="calc-refining-heart-recipe" label="Usar receta alternativa con corazones"
                  checked={useHeartRecipe} onChange={setUseHeartRecipe}
                  hint="La receta principal siempre se conserva; esta opción cambia los materiales usados en el cálculo." />
              )}
              {isRefining && useHeartRecipe && item?.alternateRes?.length > 0 && (
                <div className="primary-recipe-reference" id="calc-primary-recipe-ref">
                  <strong>Receta principal (siempre)</strong>
                  <ul>{item.res.map(resource => (
                    <li key={resource.id}>
                      <span>{resource.es} <small>{resource.id}</small></span>
                      <b>× {fmt(resource.q)}</b>
                    </li>
                  ))}</ul>
                </div>
              )}
              <div id="calc-materials">
                {item ? (
                  <DataTable columns={materialColumns} rows={recipeResources} className="materials-table"
                    empty="Sin materiales"
                    foot={<tr><td colSpan="7"><strong>Total de materiales (neto)</strong></td>
                    <td className="num" id="calc-materials-total">{pricesComplete ? fmt(result?.netMaterials || 0)
                      : 'Completá precios'}</td></tr>} />
                ) : <p className="empty-note">Elegí un ítem para ver su receta.</p>}
              </div>
              <div className="sale-row">
                <div>
                  <strong>Precio de venta unitario</strong>
                  <small className="hint" id="calc-sale-hint">
                    Referencia: {cfg.sellMode === 'order' ? 'sell_price_min' : 'buy_price_max'} de {cfg.sellCity}.
                  </small>
                </div>
                <div className="sale-controls">
                  <input type="number" id="calc-sale-price" min="0" aria-label="Precio de venta"
                    className={cn(priceRecord(`sell:${item?.id}`)?.manual && 'manual')}
                    value={item ? (priceRecord(`sell:${item.id}`)?.value ?? '') : ''}
                    placeholder={priceRecord(`sell:${item?.id}`)?.missing ? 'No se registra precio' : 'Manual'}
                    onChange={e => item && setPrice(`sell:${item.id}`, e.target.value)} />
                  {item && <Age value={priceRecord(`sell:${item.id}`)?.date}
                    manual={priceRecord(`sell:${item.id}`)?.manual}
                    source={priceRecord(`sell:${item.id}`)?.source}
                    missing={priceRecord(`sell:${item.id}`)?.missing}
                    city={priceRecord(`sell:${item.id}`)?.city} />}
                  {item && priceRecord(`sell:${item.id}`)?.manual && (
                    <button type="button" className="btn ghost" onClick={() => clearManualPrice(`sell:${item.id}`)}>
                      Usar precio AODP
                    </button>
                  )}
                  <button type="button" className="btn ghost" id="calc-use-sell-price" disabled={!item || busy}
                    onClick={() => item && loadPrices()}>
                    Actualizar precios
                  </button>
                </div>
              </div>
              {showSellCityPrices && item && saleQuotes?.itemId === item.id &&
                saleQuotes.sellMode === cfg.sellMode && (
                  <section className="sale-city-prices" id="calc-sale-city-prices">
                    <div className="card-head">
                      <h3>Precios de venta por ciudad</h3>
                      <span className="card-tag">
                        {cfg.sellMode === 'order' ? 'Órdenes de venta' : 'Venta directa'}
                      </span>
                    </div>
                    <p className="hint">Mejores precios disponibles según los datos actuales de AODP.</p>
                    <DataTable columns={saleCityColumns} rows={saleQuotes.quotes}
                      className="sale-city-table" empty="No hay precios disponibles en las ciudades consultadas." />
                  </section>
                )}
            </section>

            <section className="card">
              <div className="card-head"><h2>Resultado</h2>
                <span className={cn('verdict', verdictTone)} id="calc-verdict">{verdict}</span>
              </div>
              {item && !pricesComplete && (
                <p className="hint" id="calc-missing-prices">
                  Completá {missingPriceCount} precio{missingPriceCount === 1 ? '' : 's'} con datos del mercado o ingresalos manualmente para calcular resultados.
                </p>
              )}
              <ResultGrid cards={[
                { id: 'calc-profit', label: 'Ganancia neta', value: pricesComplete ? fmt(result?.profit || 0) : '—',
                  tone: cn('hero', (result?.profit || 0) < 0 && 'negative') },
                { id: 'calc-roi', label: 'ROI', value: pricesComplete ? fmt2(result?.roi || 0) + ' %' : '—' },
                { id: 'calc-unit', label: 'Ganancia por ítem', value: pricesComplete ? fmt(result?.profitPerItem || 0) : '—' },
                { id: 'calc-breakeven', label: 'Precio de equilibrio',
                  value: !pricesComplete || result?.breakEven == null ? '—' : fmt(result.breakEven) },
              ]} />
              <div className="breakdown" id="calc-breakdown">
                {result && <div className="breakdown-table">{breakdown.map(([label, value, tone]) => (
                  <div className={cn('line', tone)} key={label}><span>{label}</span><b>{value}</b></div>
                ))}</div>}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h2>Comparativa Premium</h2><span className="card-tag">Mismo escenario</span></div>
              <div className="premium-grid">
                <div className="premium-col"><span className="pill blue">Con Premium · 4 %</span>
                  <strong id="calc-premium-profit">{pricesComplete ? fmt(result?.premiumComparison.withPremium || 0) : '—'}</strong><small>ganancia neta</small></div>
                <div className="premium-col"><span className="pill">Sin Premium · 8 %</span>
                  <strong id="calc-nopremium-profit">{pricesComplete ? fmt(result?.premiumComparison.withoutPremium || 0) : '—'}</strong><small>ganancia neta</small></div>
                <div className="premium-col accent"><span className="pill gold">Diferencia</span>
                  <strong id="calc-premium-delta">{pricesComplete ? fmt(result?.premiumComparison.delta || 0) : '—'}</strong>
                  <small id="calc-premium-note">{pricesComplete ? `ahorro ${fmt(result?.premiumComparison.taxSaved || 0)} p` : 'Precios pendientes'}</small></div>
              </div>
              <p className="hint">La tarifa de orden (2,5 %) es igual con y sin Premium: cambia solo el impuesto de transacción.</p>
            </section>

            <details className="card notes">
              <summary>Cómo se calcula</summary>
              <div className="notes-body">
                <p><strong>Impuestos:</strong> 4 % con Premium / 8 % sin Premium sobre el ingreso bruto, más 2,5 % por orden de venta (y por republicación). Tarifa de orden de compra opcional.</p>
                <p><strong>Estación:</strong> <code>nutrición = valor del ítem × 0,1125 × crafteos</code>; <code>coste = tarifa × nutrición / 100</code>.</p>
                <p><strong>Materiales:</strong> devolución por material según RRR, con tope <code>maxreturnamount</code>; los artefactos no retornan.</p>
                <p><strong>Diarios:</strong> fama por crafteo → diarios vacíos <code>ceil</code> y llenos <code>floor</code>.</p>
              </div>
            </details>
          </div>
        </div>
      ) : isRefining && tab === 'transmutation' ? (
        <TransmutationView />
      ) : (
        <div className="work-grid">
          <div className="config-col">
            <section className="card">
              <div className="card-head"><h2>Comparar ciudades</h2></div>
              <p className="hint">Calcula la ganancia del ítem actual en cada mercado con una sola petición de precios. Usa la configuración de la pestaña «Calculadora».</p>
              <button type="button" className="btn primary full" id="calc-compare-btn" disabled={compareBusy}
                onClick={compareCities}>Comparar en todas las ciudades</button>
              <p className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')} id="calc-compare-status">{status}</p>
            </section>
          </div>
          <div className="results-col">
            <section className="card">
              <div className="card-head"><h2>Ganancia por ciudad</h2>
                <span className="card-tag" id="calc-compare-meta">{compare ? `${compare.length} ciudades · ${item?.id}` : 'Sin datos'}</span>
              </div>
              <div id="calc-compare-results">
                {compare?.length ? (
                  <>
                    <DataTable columns={[
                      { label: 'Ciudad', render: r => <strong>{r.city}</strong> },
                      { label: 'Precio', align: 'right', render: r => fmt(r.price) },
                      { label: 'Ganancia / u', align: 'right', render: r => <span className={r.profit >= 0 ? 'positive' : 'negative'}>{fmt(r.profit)}</span> },
                      { label: 'ROI', align: 'right', render: r => fmt2(r.roi) + ' %' },
                      { label: 'Edad', align: 'right', render: r => esc(r.age) },
                    ]} rows={compare} />
                    <ProfitBars rows={compare.map(r => ({ city: r.city, profit: r.profit }))} />
                  </>
                ) : <p className="empty-note">Elegí un ítem y pulsá «Comparar en todas las ciudades».</p>}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
