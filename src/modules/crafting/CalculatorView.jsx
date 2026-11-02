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

const CITY_OPTIONS = CITIES.map(c => ({ value: c.value, label: c.label }));
const TABS = [{ id: 'calc', label: 'Calculadora' }, { id: 'cities', label: 'Comparar ciudades' }];
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));

function Age({ value, manual }) {
  if (manual) return <span className="age none">precio manual</span>;
  const a = ageFromDate(value);
  return <span className={`age ${a.tone}`}>{a.label}</span>;
}

export default function CalculatorView({ moduleId, scopeLabel = 'Catálogo completo', filter = null, meta }) {
  const { shared, prefs, setPrefs, pending, navigate } = useApp();
  const Icon = MODULE_ICONS[moduleId];
  const initialCfg = React.useMemo(() => ({
    craftCity: prefs.craftCity || 'Thetford', syncBuy: prefs.syncBuyCity !== false,
    runs: 1, rrrMode: prefs.rrrMode || 'auto', rrrPreset: '15.2', rrr: 15.2,
    focus: !!prefs.focus, dailyBonus: prefs.dailyBonus || 0,
    stationFee: prefs.stationFee || 0, itemValue: 0,
    buyCity: prefs.buyCity || 'Martlock', buyMode: prefs.buyMode || 'instant', buyOrderFee: false,
    sellCity: prefs.sellCity || 'Lymhurst', sellMode: prefs.sellMode || 'order',
    relists: 0, otherCosts: 0, journal: false, overwrite: false, proxy: '', proxyUrl: '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [item, setItem] = React.useState(null);
  const [cfg, setCfg] = React.useState(initialCfg);
  const [prices, setPrices] = React.useState({});
  const [rowCities, setRowCities] = React.useState({});
  const [tab, setTab] = React.useState('calc');
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [compare, setCompare] = React.useState(null);
  const [compareBusy, setCompareBusy] = React.useState(false);

  const getPrice = key => Number(prices[key]?.value) || 0;
  const setPrice = (key, value, extra = {}) =>
    setPrices(current => ({ ...current, [key]: { value, manual: true, date: null, ...extra } }));

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
    if (p.opportunity) { applyOpportunity(p.opportunity); return; }
    const wanted = p.itemId || prefs.lastItem;
    if (wanted) {
      const entry = catalog.get(wanted);
      if (entry && (!filter || filter(entry))) applyItem(entry);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyItem(entry) {
    setItem(entry);
    setCfg(c => ({ ...c, itemValue: entry.value }));
    setPrefs({ lastItem: entry.id });
  }

  function applyOpportunity(row) {
    const entry = catalog.get(row.id);
    if (!entry) return;
    setItem(entry);
    const craftOk = CRAFT_CITIES.some(c => c.value === row.craftCity);
    const buyOk = CITY_OPTIONS.some(c => c.value === (row.materialPrices?.[0]?.city || row.buyCity));
    const sellOk = CITY_OPTIONS.some(c => c.value === row.sellCity);
    setCfg(c => ({
      ...c, itemValue: entry.value,
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
    setStatus('Oportunidad cargada desde Flipping: ajustá diarios, transporte y precios.');
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
    const resources = item.res.map(r => ({
      id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: getPrice(`mat:${r.id}`),
    }));
    const j = item.journal;
    return engine.calculate({
      item, runs: Math.max(1, Number(cfg.runs) || 1), rrrPct: rrr,
      itemValue: Number(cfg.itemValue) || 0,
      station: { mode: 'nutrition', feePer100: Number(cfg.stationFee) || 0 },
      resources, buyMode: cfg.buyMode, buyOrderFee: cfg.buyOrderFee,
      sellMode: cfg.sellMode, sellPrice: getPrice(`sell:${item.id}`),
      relists: Number(cfg.relists) || 0, otherCosts: Number(cfg.otherCosts) || 0,
      journal: cfg.journal && j ? { enabled: true, fame: j.fame, max: j.max,
        emptyPrice: getPrice(`jrn:${j.empty}`), fullPrice: getPrice(`jrn:${j.full}`) } : null,
      premium: shared.premium,
    });
  }, [item, cfg, prices, rrr, shared.premium]); // eslint-disable-line react-hooks/exhaustive-deps

  const taxRate = shared.premium ? 4 : 8;
  const orderFee = cfg.sellMode === 'order' ? 2.5 * (1 + (Number(cfg.relists) || 0)) : 0;

  /* ---- Precios ---- */
  function targets() {
    if (!item) return [];
    const list = item.res.map(r => ({
      key: `mat:${r.id}`, id: r.id, city: rowCities[r.id] || cfg.buyCity,
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

  async function loadPrices(only = null) {
    const list = only || targets();
    if (!list.length) { setStatus('Elegí primero un ítem.'); return; }
    setBusy(true);
    setStatus('Consultando precios…');
    try {
      const rows = await api.fetchPrices({
        server: shared.server, quality: shared.quality,
        ids: list.map(t => t.id), cities: list.map(t => t.city),
        proxy: cfg.proxy === 'custom' ? cfg.proxyUrl.trim() : '',
      });
      const map = api.indexRows(rows);
      let applied = 0, skipped = 0;
      setPrices(current => {
        const next = { ...current };
        list.forEach(t => {
          if (!cfg.overwrite && next[t.key]?.manual) { skipped++; return; }
          const quote = api.priceFor(api.pick(map, t.id, t.city, shared.quality), t.mode);
          if (!quote) return;
          next[t.key] = { value: quote.price, date: quote.date, manual: false };
          applied++;
        });
        return next;
      });
      setStatus(`✔ ${applied} precios actualizados${skipped ? ` · ${skipped} manuales respetados` : ''}.`);
    } catch (error) {
      setStatus('✖ ' + error.message);
    } finally { setBusy(false); }
  }

  async function compareCities() {
    if (!item) { setStatus('Elegí un ítem primero.'); return; }
    const ids = [item.id, ...item.res.map(r => r.id)];
    const cities = CITIES.map(c => c.value);
    setCompareBusy(true);
    setStatus('Comparando ciudades…');
    try {
      const rows = await api.fetchPrices({ server: shared.server, quality: shared.quality, ids, cities,
        proxy: cfg.proxy === 'custom' ? cfg.proxyUrl.trim() : '' });
      const map = api.indexRows(rows);
      const buyPriceMode = cfg.buyMode === 'instant' ? 'sell' : 'buy';
      const list = [];
      cities.forEach(city => {
        const sale = api.priceFor(api.pick(map, item.id, city, shared.quality),
          cfg.sellMode === 'instant' ? 'buy' : 'sell');
        if (!sale) return;
        let ok = true;
        const resources = item.res.map(r => {
          let quote = api.priceFor(api.pick(map, r.id, rowCities[r.id] || cfg.buyCity, shared.quality), buyPriceMode);
          if (!quote) quote = api.bestPrice(map, r.id, cities.slice(0, 7), shared.quality, buyPriceMode);
          if (!quote) ok = false;
          return { id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: quote?.price || 0 };
        });
        if (!ok) return;
        const r = engine.calculate({
          item, runs: Number(cfg.runs) || 1, rrrPct: rrr, itemValue: Number(cfg.itemValue) || 0,
          station: { mode: 'nutrition', feePer100: Number(cfg.stationFee) || 0 },
          resources, buyMode: cfg.buyMode, buyOrderFee: cfg.buyOrderFee,
          sellMode: cfg.sellMode, sellPrice: sale.price, relists: Number(cfg.relists) || 0,
          otherCosts: Number(cfg.otherCosts) || 0, journal: null, premium: shared.premium,
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
          {r.ret === false && <span className="badge-no-return">no retorna</span>}
        </div>
      </div>
    ) },
    { label: 'Por crafteo', align: 'right', render: r => fmt(r.q) },
    { label: 'Bruto', align: 'right', render: r => fmt(resourceById(r.id)?.grossQty || 0) },
    { label: 'Devuelto', align: 'right', render: r => '−' + fmt(resourceById(r.id)?.expected || 0) },
    { label: 'Neto', align: 'right', render: r => fmt(resourceById(r.id)?.netQty || 0) },
    { label: 'Ciudad', render: r => (
      <select className="row-city" value={rowCities[r.id] || ''}
        onChange={e => setRowCities(current => ({ ...current, [r.id]: e.target.value }))}>
        <option value="">Global</option>
        {CITY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    ) },
    { label: 'Precio', align: 'right', render: r => {
      const key = `mat:${r.id}`;
      return (
        <div className="price-cell">
          <input className={cn('row-price', prices[key]?.manual && 'manual')} type="number" min="0"
            aria-label={`Precio de ${r.es}`} value={prices[key]?.value ?? 0}
            onChange={e => setPrice(key, e.target.value)} />
          <Age value={prices[key]?.date} manual={prices[key]?.manual} />
        </div>
      );
    } },
    { label: 'Coste neto', align: 'right', render: r => fmt(resourceById(r.id)?.netCost || 0) },
  ];

  const breakdown = result ? [
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
    ['Otros costes', '−' + fmt(result.otherCosts), 'negative'],
    ['Coste total', fmt(result.totalCosts), 'total'],
  ] : [];

  const verdict = !result ? '—' : result.profit > 0 ? 'Rentable' : result.profit < 0 ? 'Pérdida' : 'Punto muerto';
  const verdictTone = !result ? '' : result.profit > 0 ? 'good' : result.profit < 0 ? 'bad' : 'even';

  return (
    <div className="module-view" data-module={moduleId}>
      <div className="module-head">
        <div>
          <h1>{Icon ? <Icon className="size-5" /> : <span className="head-emoji">{meta?.icon}</span>}{meta?.label}</h1>
          <p>{meta?.description}</p>
        </div>
        <span className="module-badge">{meta?.group}</span>
      </div>
      <Tabs id="calc-tabs" tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'calc' ? (
        <div className="work-grid">
          <div className="config-col">
            <section className="card">
              <div className="card-head"><h2>1 · Ítem</h2><span className="card-tag">{scopeLabel}</span></div>
              <ItemSelector id="calc-item" filter={filter} quality={shared.quality} value={item?.id || null}
                placeholder="Buscar por nombre o ID del ítem…" onChange={applyItem} />
            </section>

            <section className="card">
              <div className="card-head"><h2>2 · Producción</h2></div>
              <Select id="calc-craft-city" label="Dónde craftear" options={CRAFT_CITIES}
                value={cfg.craftCity} onChange={v => setField('craftCity', v)}
                hint="Define el bonus de producción y el RRR" />
              <Toggle id="calc-sync-buy" label="Comprar materiales en esa ciudad"
                checked={cfg.syncBuy} onChange={v => setField('syncBuy', v)} />
              <NumberField id="calc-runs" label="Crafteos (lotes)" value={cfg.runs} min={1}
                onChange={v => setField('runs', v)} />
              <Select id="calc-rrr-mode" label="Return Rate"
                options={[{ value: 'auto', label: 'Automático (ciudad + Focus)' }, { value: 'manual', label: 'Manual' }]}
                value={cfg.rrrMode} onChange={v => setField('rrrMode', v)} />
              {cfg.rrrMode === 'manual' && (
                <Select id="calc-rrr-preset" label="Preset"
                  options={[{ value: '15.2', label: 'Sin bonus · 15,2 %' }, { value: '36.7', label: 'Ciudad · 36,7 %' },
                    { value: '43.5', label: 'Focus · 43,5 %' }, { value: '53.9', label: 'Ciudad + Focus · 53,9 %' },
                    { value: 'custom', label: 'Personalizado' }]}
                  value={cfg.rrrPreset} onChange={v => setField('rrrPreset', v)} />
              )}
              <NumberField id="calc-rrr" label="RRR (%)" value={cfg.rrrMode === 'manual' ? cfg.rrr : rrr}
                min={0} step={0.1} readOnly={cfg.rrrMode !== 'manual'}
                onChange={v => setField('rrr', v)} />
              <p className="hint" id="calc-rrr-info">
                {cfg.rrrMode === 'manual'
                  ? 'RRR manual: podés usar un preset o escribir el valor.'
                  : `Bonus en ${cityLabel(cfg.craftCity === 'auto' ? (item ? bestCityFor(item.ccat, item.refine) : 'Thetford') : cfg.craftCity)}: ${bonus.total.toFixed(2)} → RRR ${fmt2(rrr)} % (base ${bonus.base.toFixed(2)} + categoría ${bonus.modifier.toFixed(2)} + Focus ${bonus.focus.toFixed(2)} + diario ${bonus.daily.toFixed(2)})`}
              </p>
              <Toggle id="calc-focus" label="Usar Focus (+59 % bonus)" checked={cfg.focus}
                onChange={v => setField('focus', v)} />
              <NumberField id="calc-daily-bonus" label="Bonus diario (%)" value={cfg.dailyBonus}
                onChange={v => setField('dailyBonus', v)} />
              <hr />
              <NumberField id="calc-station-fee" label="Tasa de estación (plata / 100 nutrición)"
                value={cfg.stationFee} onChange={v => setField('stationFee', v)}
                hint="Valor que fija el dueño de la estación; se introduce a mano" />
              <NumberField id="calc-item-value" label="Valor del ítem" value={cfg.itemValue}
                onChange={v => setField('itemValue', v)}
                hint="Base de la nutrición: valor × 0,1125 × crafteos" />
              <p className="hint" id="calc-station-info">
                Nutrición por crafteo: {fmt2(result?.nutritionPerRun || 0)} · total: {fmt2(result?.nutritionTotal || 0)} · coste: {fmt(result?.stationFee || 0)} p
              </p>
            </section>

            <section className="card">
              <div className="card-head"><h2>3 · Mercado e impuestos</h2></div>
              <Select id="calc-buy-city" label="Dónde comprar los materiales" options={CITY_OPTIONS}
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
              {cfg.sellMode === 'order' && (
                <NumberField id="calc-relists" label="Republicaciones de la orden" value={cfg.relists}
                  onChange={v => setField('relists', v)} />
              )}
              <NumberField id="calc-other-costs" label="Otros costes (transporte, etc.)" value={cfg.otherCosts}
                onChange={v => setField('otherCosts', v)} />
              <div className="tax-box" id="calc-tax-summary">
                <div><span>Impuesto de transacción ({shared.premium ? 'Premium' : 'sin Premium'})</span><b>{taxRate} %</b></div>
                <div><span>Tarifa de orden de venta</span><b>{cfg.sellMode === 'order' ? `2,5 %${Number(cfg.relists) ? ` × ${1 + Number(cfg.relists)}` : ''}` : 'no aplica'}</b></div>
                <div><span>Deducción total</span><b>{fmt2(taxRate + orderFee)} %</b></div>
                <div><span>Tarifa de orden de compra</span><b>{cfg.buyMode === 'order' && cfg.buyOrderFee ? '2,5 %' : 'no aplica'}</b></div>
              </div>
              <button type="button" className="btn primary full" id="calc-load-prices" disabled={busy}
                onClick={() => loadPrices()}>↻ Cargar precios del mercado</button>
              <Toggle id="calc-overwrite" label="Sobrescribir precios manuales"
                checked={cfg.overwrite} onChange={v => setField('overwrite', v)} />
              <details className="advanced">
                <summary>Conexión / proxy CORS</summary>
                <Select id="calc-proxy" label="Proxy (opcional)"
                  options={[{ value: '', label: 'Directo a AODP' }, { value: 'custom', label: 'URL personalizada' }]}
                  value={cfg.proxy} onChange={v => setField('proxy', v)} />
                {cfg.proxy === 'custom' && (
                  <input id="calc-proxy-url" type="text" className="text-input"
                    placeholder="https://mi-proxy.example/api/v2" value={cfg.proxyUrl}
                    onChange={e => setField('proxyUrl', e.target.value)} />
                )}
              </details>
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
                    value={prices[`jrn:${item.journal.empty}`]?.value ?? 0}
                    onChange={v => setPrice(`jrn:${item.journal.empty}`, v)} />
                  <NumberField id="calc-journal-full" label="Diario lleno · precio unitario"
                    value={prices[`jrn:${item.journal.full}`]?.value ?? 0}
                    onChange={v => setPrice(`jrn:${item.journal.full}`, v)} />
                  <p className="hint" id="calc-journal-fame">
                    Vacíos: {result?.journal?.required ?? 0} · llenos: {result?.journal?.full ?? 0} · parcial: {fmt2(result?.journal?.partialPct ?? 0)} %
                  </p>
                </div>
              ) : null}
            </section>
          </div>

          <div className="results-col">
            <section className="card">
              <div className="card-head"><h2>Receta y precios</h2>
                <span className="card-tag" id="calc-recipe-meta">{item ? `${item.id} · ${item.res.length} materiales` : 'Sin ítem'}</span>
              </div>
              <div id="calc-materials">
                {item ? (
                  <DataTable columns={materialColumns} rows={item.res} className="materials-table"
                    empty="Sin materiales"
                    foot={<tr><td colSpan="7"><strong>Total de materiales (neto)</strong></td>
                      <td className="num" id="calc-materials-total">{fmt(result?.netMaterials || 0)}</td></tr>} />
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
                    className={cn(prices[`sell:${item?.id}`]?.manual && 'manual')}
                    value={item ? (prices[`sell:${item.id}`]?.value ?? 0) : 0}
                    onChange={e => item && setPrice(`sell:${item.id}`, e.target.value)} />
                  {item && <Age value={prices[`sell:${item.id}`]?.date} manual={prices[`sell:${item.id}`]?.manual} />}
                  <button type="button" className="btn ghost" id="calc-use-sell-price" disabled={!item}
                    onClick={() => item && loadPrices(targets().filter(t => t.key === `sell:${item.id}`))}>
                    Usar precio de {cfg.sellCity}
                  </button>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h2>Resultado</h2>
                <span className={cn('verdict', verdictTone)} id="calc-verdict">{verdict}</span>
              </div>
              <ResultGrid cards={[
                { id: 'calc-profit', label: 'Ganancia neta', value: fmt(result?.profit || 0),
                  tone: cn('hero', (result?.profit || 0) < 0 && 'negative') },
                { id: 'calc-roi', label: 'ROI', value: fmt2(result?.roi || 0) + ' %' },
                { id: 'calc-unit', label: 'Ganancia por ítem', value: fmt(result?.profitPerItem || 0) },
                { id: 'calc-breakeven', label: 'Precio de equilibrio',
                  value: result?.breakEven == null ? '—' : fmt(result.breakEven) },
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
                  <strong id="calc-premium-profit">{fmt(result?.premiumComparison.withPremium || 0)}</strong><small>ganancia neta</small></div>
                <div className="premium-col"><span className="pill">Sin Premium · 8 %</span>
                  <strong id="calc-nopremium-profit">{fmt(result?.premiumComparison.withoutPremium || 0)}</strong><small>ganancia neta</small></div>
                <div className="premium-col accent"><span className="pill gold">Diferencia</span>
                  <strong id="calc-premium-delta">{fmt(result?.premiumComparison.delta || 0)}</strong>
                  <small id="calc-premium-note">ahorro {fmt(result?.premiumComparison.taxSaved || 0)} p</small></div>
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
