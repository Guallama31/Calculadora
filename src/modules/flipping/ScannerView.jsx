/* Módulo Flipping / TRADES: 4 estrategias en pestañas horizontales. */
import * as React from 'react';
import { CITIES, CRAFT_CITIES, CATEGORIES, ROYAL_CITIES, BLACK_MARKET } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import { esc, fmt, fmt1, fmt2, ageInfo, profitClass } from '../../services/format.js';
import { useApp } from '../../app/AppContext.jsx';
import { Select, NumberField, Toggle } from '../../components/common/Field.jsx';
import { Tabs } from '../../components/common/Tabs.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ResultGrid } from '../../components/common/ResultCard.jsx';
import { MODULE_ICONS } from '../../components/layout/sidebar-data.js';
import { scan, STRATEGIES, describe } from './scanner.js';
import { cn } from '../../lib/utils.js';

const DEFAULTS = {
  category: '', query: '', tier: '', ench: '', maxItems: 60,
  buyCity: 'auto', sellCities: ROYAL_CITIES.slice(),
  safeOnly: true, sameCity: false, includeBM: false,
  buyMode: 'instant', sellMode: 'order',
  craftCity: 'auto', rrrMode: 'auto', manualRRR: 36.7,
  focus: false, dailyBonus: 0, stationFee: 0, buyOrderFee: false,
  minProfit: 0, minRoi: 0, maxAgeHours: 8, sort: 'profit', limit: 30,
};

export default function ScannerView({ meta }) {
  const { shared, pending, navigate } = useApp();
  const Icon = MODULE_ICONS.flipping;
  const [strategy, setStrategy] = React.useState(() => pending?.strategy || 'flip');
  const [opts, setOpts] = React.useState(DEFAULTS);
  const [rows, setRows] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const set = (key, value) => setOpts(current => ({ ...current, [key]: value }));
  const isCraft = strategy === 'craft' || strategy === 'refine';
  const current = STRATEGIES.find(s => s.id === strategy);

  async function run() {
    if (busy) return;
    setBusy(true); setRows([]); setSummary(null); setProgress(5);
    setStatus('Consultando precios…');
    try {
      const result = await scan({
        ...opts, strategy, server: shared.server, quality: shared.quality,
        premium: shared.premium,
        tiers: opts.tier ? [Number(opts.tier)] : [4, 5, 6, 7, 8],
        enchants: opts.ench ? [Number(opts.ench)] : [0],
        query: opts.query.trim(), proxy: '',
      }, p => {
        setStatus(p.message);
        if (p.total) setProgress(Math.max(5, p.done / p.total * 100));
      });
      setSummary({ candidates: result.candidates, requests: result.requests, prices: result.prices });
      setRows(result.rows);
      setProgress(100);
      setStatus(result.rows.length
        ? `✔ ${result.rows.length} oportunidades. Verificá los precios en el juego.`
        : '✔ Búsqueda terminada sin resultados.');
    } catch (error) {
      setStatus('✖ ' + error.message);
    } finally { setBusy(false); }
  }

  const cityChecks = (
    <div className="field"><span>Ciudades de venta</span>
      <div className="check-grid">
        {CITIES.map(c => (
          <label className="check" key={c.value}>
            <input type="checkbox" className="sell-city" value={c.value}
              checked={opts.sellCities.includes(c.value)} disabled={strategy === 'royalbm'}
              onChange={e => set('sellCities', e.target.checked
                ? [...opts.sellCities, c.value] : opts.sellCities.filter(x => x !== c.value))} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const columns = [
    { label: 'Ítem', render: r => (
      <div className="material-cell">
        <img src={catalog.icon(r.id, r.quality)} alt="" />
        <div><strong>{r.item.es}</strong><small>{r.id}</small></div>
      </div>
    ) },
    { label: 'Ruta', render: r => (
      <div className="route">
        <span>{r.buyCity} → {r.sellCity}</span>
        {isCraft
          ? <small>craftear en {r.craftCity} · RRR {fmt1(r.rrr)} %</small>
          : <small>buy {r.buyMode === 'instant' ? 'inmediata' : 'orden'} · sell {r.sellMode === 'instant' ? 'directa' : 'orden'}</small>}
      </div>
    ) },
    { label: 'Coste / u', align: 'right', render: r => fmt(r.costPerUnit) },
    { label: 'Venta / u', align: 'right', render: r => fmt(r.revenuePerUnit) },
    { label: 'Impuestos', align: 'right', render: r => fmt(r.salesTax + r.setupFee + r.stationFee + r.buyOrderFee) },
    { label: 'Ganancia / u', align: 'right', render: r => <strong className={profitClass(r.profit)}>{fmt(r.profit)}</strong> },
    { label: 'ROI', align: 'right', render: r => <span className={profitClass(r.roi)}>{fmt2(r.roi)} %</span> },
    { label: 'Edad', align: 'right', render: r => {
      const a = ageInfo(r.age);
      return <span className={`age ${a.tone}`}>{a.label}</span>;
    } },
    { label: '', align: 'right', render: r => (
      <button type="button" className="btn tiny" data-open={r.id}
        onClick={() => navigate('crafting', { opportunity: r })}>Abrir en calculadora</button>
    ) },
  ];

  return (
    <div className="module-view" data-module="flipping">
      <div className="module-head">
        <div><h1><Icon className="size-5" />{meta?.label}</h1><p>{meta?.description}</p></div>
        <span className="module-badge">{meta?.group}</span>
      </div>
      <Tabs id="scan-tabs" tabs={STRATEGIES.map(s => ({ id: s.id, label: s.label }))}
        active={strategy} onChange={setStrategy} />
      <p className="strategy-hint" id="scan-strategy-hint">{current.description}</p>
      <div className="work-grid">
        <div className="config-col">
          <section className="card">
            <div className="card-head"><h2>Filtros</h2><span className="card-tag" id="scan-strategy-tag">{current.label}</span></div>
            <Select id="scan-category" label="Categoría" options={CATEGORIES} value={opts.category}
              onChange={v => set('category', v)} />
            <label className="field"><span>Buscar nombre o ID (opcional)</span>
              <input id="scan-query" type="search" className="text-input" placeholder="Ej: arco, T4_BAG…"
                value={opts.query} onChange={e => set('query', e.target.value)} />
            </label>
            <div className="field-row">
              <Select id="scan-tier" label="Tier" value={opts.tier} onChange={v => set('tier', v)}
                options={[{ value: '', label: 'Todos' }, ...[2, 3, 4, 5, 6, 7, 8].map(t => ({ value: t, label: 'T' + t }))]} />
              <Select id="scan-ench" label="Encantamiento" value={opts.ench} onChange={v => set('ench', v)}
                options={[{ value: '', label: 'Todos' }, ...[0, 1, 2, 3, 4].map(e => ({ value: e, label: '.' + e }))]} />
            </div>
            <NumberField id="scan-max-items" label="Ítems a analizar" value={opts.maxItems} min={5} step={5}
              hint="Más ítems = más peticiones a la API" onChange={v => set('maxItems', v)} />
          </section>

          <section className="card">
            <div className="card-head"><h2>Rutas y mercados</h2></div>
            <Select id="scan-buy-city" label="Ciudad de compra" value={opts.buyCity}
              onChange={v => set('buyCity', v)}
              options={[{ value: 'auto', label: 'Automática (mejor precio)' },
                ...CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label }))]} />
            {cityChecks}
            <Toggle id="scan-safe-only" label="Solo rutas seguras (5 ciudades reales)"
              checked={opts.safeOnly} onChange={v => set('safeOnly', v)} />
            <Toggle id="scan-same-city" label="Permitir comprar y vender en la misma ciudad"
              checked={opts.sameCity} onChange={v => set('sameCity', v)} />
            {strategy !== 'royalbm' && (
              <Toggle id="scan-include-bm" label="Incluir Mercado Negro en la venta"
                checked={opts.includeBM} onChange={v => set('includeBM', v)} />
            )}
            <Select id="scan-buy-mode" label="Modo de compra" value={opts.buyMode}
              onChange={v => set('buyMode', v)}
              options={[{ value: 'instant', label: 'Compra inmediata' }, { value: 'order', label: 'Orden de compra' }]} />
            {strategy !== 'royalbm' && (
              <Select id="scan-sell-mode" label="Modo de venta" value={opts.sellMode}
                onChange={v => set('sellMode', v)}
                options={[{ value: 'order', label: 'Orden de venta' }, { value: 'instant', label: 'Venta directa' }]} />
            )}
          </section>

          {isCraft && (
            <section className="card" id="scan-craft-card">
              <div className="card-head"><h2>Producción</h2><span className="card-tag">Craft / Refining</span></div>
              <Select id="scan-craft-city" label="Dónde craftear / refinar" options={CRAFT_CITIES}
                value={opts.craftCity} onChange={v => set('craftCity', v)} />
              <Select id="scan-rrr-mode" label="Return Rate" value={opts.rrrMode}
                onChange={v => set('rrrMode', v)}
                options={[{ value: 'auto', label: 'Automático (bonus real)' }, { value: 'manual', label: 'Manual' }]} />
              {opts.rrrMode === 'manual' && (
                <NumberField id="scan-manual-rrr" label="RRR manual (%)" value={opts.manualRRR}
                  onChange={v => set('manualRRR', v)} />
              )}
              <Toggle id="scan-focus" label="Usar Focus" checked={opts.focus} onChange={v => set('focus', v)} />
              <NumberField id="scan-daily-bonus" label="Bonus diario (%)" value={opts.dailyBonus}
                onChange={v => set('dailyBonus', v)} />
              <NumberField id="scan-station-fee" label="Tasa de estación (plata / 100 nutrición)"
                value={opts.stationFee} onChange={v => set('stationFee', v)} />
              <Toggle id="scan-buy-order-fee" label="Tarifa de orden de compra (2,5 %)"
                checked={opts.buyOrderFee} onChange={v => set('buyOrderFee', v)} />
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Filtros de resultado</h2></div>
            <NumberField id="scan-min-profit" label="Ganancia mínima por unidad" value={opts.minProfit}
              onChange={v => set('minProfit', v)} />
            <NumberField id="scan-min-roi" label="ROI mínimo (%)" value={opts.minRoi}
              onChange={v => set('minRoi', v)} />
            <NumberField id="scan-max-age" label="Antigüedad máxima (h, 0 = sin límite)" value={opts.maxAgeHours}
              onChange={v => set('maxAgeHours', v)} />
            <Select id="scan-sort" label="Ordenar por" value={opts.sort} onChange={v => set('sort', v)}
              options={[{ value: 'profit', label: 'Ganancia' }, { value: 'roi', label: 'ROI' },
                { value: 'margin', label: 'Margen' }, { value: 'freshness', label: 'Frescura' }]} />
            <NumberField id="scan-limit" label="Filas a mostrar" value={opts.limit} min={1}
              onChange={v => set('limit', v)} />
            <button type="button" className="btn primary full" id="scan-run" disabled={busy} onClick={run}>
              Buscar oportunidades
            </button>
            <p className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')} id="scan-status">{status}</p>
            <p className="hint">Sin recarga automática: cada búsqueda hace solo las peticiones necesarias para respetar el límite de AODP.</p>
          </section>
        </div>

        <div className="results-col">
          <section className="card">
            <div className="card-head"><h2>Resumen</h2>
              <span className="card-tag" id="scan-meta">{busy ? 'Buscando…' : summary ? `${current.label} · ${summary.candidates} ítems` : 'Sin búsqueda'}</span>
            </div>
            <ResultGrid cards={[
              { id: 'scan-candidates', label: 'Ítems analizados', value: fmt(summary?.candidates || 0) },
              { id: 'scan-requests', label: 'Peticiones', value: fmt(summary?.requests || 0) },
              { id: 'scan-prices', label: 'Precios recibidos', value: fmt(summary?.prices || 0) },
              { id: 'scan-rows', label: 'Oportunidades', value: fmt(rows.length) },
            ]} />
            {busy && <div className="progress" id="scan-progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>}
          </section>
          <section className="card">
            <div className="card-head"><h2>Oportunidades</h2>
              <span className="hint" id="scan-description">{rows.length ? describe(rows[0]) : ''}</span>
            </div>
            <div id="scan-results">
              {busy ? <p className="empty-note">Buscando oportunidades…</p>
                : rows.length ? <DataTable columns={columns} rows={rows} />
                  : <p className="empty-note">Configurá los filtros y pulsá «Buscar oportunidades».</p>}
            </div>
          </section>
          <details className="card notes">
            <summary>Antes de invertir</summary>
            <div className="notes-body">
              <p>Los precios vienen de la API comunitaria de Albion Online Data Project y pueden estar desactualizados. Verificá siempre en el juego.</p>
              <p>Las rutas por Caerleon, Brecilien o el Mercado Negro implican zonas de riesgo; activá «Solo rutas seguras» para excluirlas.</p>
              <p>«Abrir en calculadora» carga la oportunidad con sus precios para que agregues diarios, transporte y otros costes reales.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
