/* Módulo Flipping / TRADES con estrategias por pestañas horizontales. */
import * as React from 'react';
import { CITIES, CRAFT_CITIES, CATEGORIES, QUALITIES, ROYAL_CITIES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import { fmt, fmt1, fmt2, ageInfo, profitClass } from '../../services/format.js';
import { useApp } from '../../app/AppContext.jsx';
import { Select, NumberField, Toggle } from '../../components/common/Field.jsx';
import { Tabs } from '../../components/common/Tabs.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ResultGrid } from '../../components/common/ResultCard.jsx';
import { MODULE_ICONS } from '../../components/layout/sidebar-data.js';
import { scan, STRATEGIES, describe } from './scanner.js';
import { isAbortError } from '../../services/api.js';
import { cn } from '../../lib/utils.js';

const DEFAULTS = {
  category: '',
  query: '',
  tier: '',
  ench: '',
  maxItems: 60,
  globalScan: false,
  buyCity: 'auto',
  sellCities: ROYAL_CITIES.slice(),
  safeOnly: true,
  sameCity: false,
  includeBM: false,
  buyMode: 'instant',
  sellMode: 'order',
  craftCity: 'auto',
  rrrMode: 'auto',
  manualRRR: 36.7,
  focus: false,
  dailyBonus: 0,
  stationFee: 0,
  buyOrderFee: false,
};

export const AUTO_SCAN_INTERVAL_MS = 15 * 60 * 1000;

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
  const busyRef = React.useRef(false);
  const runRef = React.useRef(null);
  const scanAbort = React.useRef(null);
  const set = (key, value) => setOpts(current => ({ ...current, [key]: value }));
  const isCraft = strategy === 'craft' || strategy === 'refine';
  const current = STRATEGIES.find(s => s.id === strategy);

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setBusy(true);
    setRows([]);
    setSummary(null);
    setProgress(5);
    setStatus('Consultando precios…');
    try {
      const result = await scan(
        {
          ...opts,
          category: opts.globalScan ? '' : opts.category,
          buyCity: opts.globalScan ? 'auto' : opts.buyCity,
          sellCities: opts.globalScan ? CITIES.map(city => city.value) : opts.sellCities,
          safeOnly: opts.globalScan ? false : opts.safeOnly,
          includeBM: opts.globalScan ? true : opts.includeBM,
          strategy,
          server: shared.server,
          quality: shared.quality,
          premium: shared.premium,
          tiers: opts.tier ? [Number(opts.tier)] : [2, 3, 4, 5, 6, 7, 8],
          enchants: opts.ench ? [Number(opts.ench)] : [0, 1, 2, 3, 4],
          query: opts.query.trim(),
        },
        p => {
          setStatus(p.message);
          if (p.total) setProgress(Math.max(5, (p.done / p.total) * 100));
        },
        controller.signal,
      );
      setSummary({
        candidates: result.candidates,
        requests: result.requests,
        prices: result.prices,
        deduplicated: result.deduplicated,
        coverage: result.coverage,
        cacheNotice: result.cacheNotice,
      });
      setRows(result.rows);
      setProgress(100);
      setStatus(
        result.rows.length
          ? `✔ ${result.rows.length} mejores oportunidades por ganancia neta. Verificá los precios en el juego. ${result.cacheNotice}`
          : `✔ Búsqueda terminada sin resultados. ${result.cacheNotice}`,
      );
    } catch (error) {
      if (isAbortError(error)) setStatus('Consulta cancelada.');
      else setStatus('✖ ' + error.message);
    } finally {
      if (scanAbort.current === controller) scanAbort.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }

  function cancel() {
    scanAbort.current?.abort();
  }

  function changeStrategy(id) {
    if (id === 'upgrade' && Number(opts.ench) > 3) set('ench', '');
    setStrategy(id);
  }

  runRef.current = run;
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!busyRef.current) void runRef.current();
    }, AUTO_SCAN_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      scanAbort.current?.abort();
    };
  }, []);

  function setGlobalScan(enabled) {
    setOpts(currentOpts => ({
      ...currentOpts,
      globalScan: enabled,
      ...(enabled
        ? {
            category: '',
            buyCity: 'auto',
            sellCities: CITIES.map(city => city.value),
            safeOnly: false,
            includeBM: true,
            maxItems: 250,
          }
        : {}),
    }));
  }

  const cityChecks = (
    <div className="field">
      <span>Ciudades de venta</span>
      <div className="check-grid">
        {CITIES.map(c => (
          <label className="check" key={c.value}>
            <input
              type="checkbox"
              className="sell-city"
              value={c.value}
              checked={opts.sellCities.includes(c.value)}
              disabled={strategy === 'royalbm' || opts.globalScan}
              onChange={e =>
                set(
                  'sellCities',
                  e.target.checked
                    ? [...opts.sellCities, c.value]
                    : opts.sellCities.filter(x => x !== c.value),
                )
              }
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const columns = [
    {
      label: 'Ítem',
      render: r => (
        <div className="material-cell">
          <img className="opportunity-item-icon" src={catalog.icon(r.id, r.quality)} alt="" />
          <div>
            <strong>{r.item.es}</strong>
            <small>{r.id}</small>
            <small>
              T{r.item.tier}.{r.item.lvl} · {QUALITIES[r.quality - 1]?.label || `Calidad ${r.quality}`}
            </small>
          </div>
        </div>
      ),
    },
    {
      label: 'Ruta',
      render: r => (
        <div className="route">
          <div className="trade-cities">
            <span>Comprar en {r.buyCity}</span>
            <span>Vender en {r.sellCity}</span>
          </div>
          {r.strategy === 'craft' || r.strategy === 'refine' ? (
            <small>
              craftear en {r.craftCity} · RRR {fmt1(r.rrr)} %
            </small>
          ) : r.strategy === 'upgrade' ? (
            <>
              <small>
                mejorar .{Math.max(0, r.item.lvl - 1)} → .{r.item.lvl}
              </small>
              <small>
                {r.materialPrices.map(part => `${part.q}× ${part.es} (${fmt(part.price)})`).join(' + ')}
              </small>
            </>
          ) : (
            <small>
              buy {r.buyMode === 'instant' ? 'inmediata' : 'orden'} · sell{' '}
              {r.sellMode === 'instant' ? 'directa' : 'orden'}
            </small>
          )}
        </div>
      ),
    },
    { label: 'Coste / u', align: 'right', render: r => fmt(r.costPerUnit) },
    { label: 'Venta / u', align: 'right', render: r => fmt(r.revenuePerUnit) },
    {
      label: 'Impuestos',
      align: 'right',
      render: r => fmt(r.salesTax + r.setupFee + r.stationFee + r.buyOrderFee),
    },
    {
      label: 'Ganancia / u',
      align: 'right',
      render: r => <strong className={profitClass(r.profit)}>{fmt(r.profit)}</strong>,
    },
    {
      label: 'ROI',
      align: 'right',
      render: r => <span className={profitClass(r.roi)}>{fmt2(r.roi)} %</span>,
    },
    {
      label: 'Edad',
      align: 'right',
      render: r => {
        const a = ageInfo(r.age);
        return <span className={`age ${a.tone}`}>{a.label}</span>;
      },
    },
    {
      label: '',
      align: 'right',
      render: r => (
        <button
          type="button"
          className="btn tiny"
          data-open={r.id}
          onClick={() =>
            r.strategy === 'upgrade'
              ? navigate('enchanting', { itemId: r.id })
              : navigate('crafting', { opportunity: r })
          }
        >
          {r.strategy === 'upgrade' ? 'Abrir encantamiento' : 'Abrir en calculadora'}
        </button>
      ),
    },
  ];

  return (
    <div className="module-view" data-module="flipping">
      <div className="module-head">
        <div>
          <h1>
            <Icon className="size-5" />
            {meta?.label}
          </h1>
          <p>{meta?.description}</p>
        </div>
        <span className="module-badge">{meta?.group}</span>
      </div>
      <Tabs
        id="scan-tabs"
        tabs={STRATEGIES.map(s => ({ id: s.id, label: s.label }))}
        active={strategy}
        onChange={changeStrategy}
      />
      <p className="strategy-hint" id="scan-strategy-hint">
        {current.description}
      </p>
      <div className="work-grid">
        <div className="config-col">
          <section className="card">
            <div className="card-head">
              <h2>Filtros</h2>
              <span className="card-tag" id="scan-strategy-tag">
                {current.label}
              </span>
            </div>
            <Toggle
              id="scan-global"
              label="Rastrear todas las categorías y ciudades"
              checked={opts.globalScan}
              onChange={setGlobalScan}
            />
            {opts.globalScan && (
              <p className="hint">
                Analiza hasta 250 ítems repartidos entre categorías; compra en las 7 ciudades reales y compara
                ventas en esas ciudades y el Mercado Negro.
              </p>
            )}
            <Select
              id="scan-category"
              label="Categoría"
              options={CATEGORIES}
              value={opts.category}
              disabled={opts.globalScan}
              onChange={v => set('category', v)}
            />
            <label className="field">
              <span>Buscar nombre o ID (opcional)</span>
              <input
                id="scan-query"
                type="search"
                className="text-input"
                placeholder="Ej: arco, T4_BAG…"
                value={opts.query}
                onChange={e => set('query', e.target.value)}
              />
            </label>
            <div className="field-row">
              <Select
                id="scan-tier"
                label="Tier"
                value={opts.tier}
                onChange={v => set('tier', v)}
                options={[
                  { value: '', label: 'Todos' },
                  ...[2, 3, 4, 5, 6, 7, 8].map(t => ({ value: t, label: 'T' + t })),
                ]}
              />
              <Select
                id="scan-ench"
                label="Encantamiento"
                value={opts.ench}
                onChange={v => set('ench', v)}
                options={[
                  { value: '', label: 'Todos' },
                  ...(strategy === 'upgrade' ? [1, 2, 3] : [0, 1, 2, 3, 4]).map(e => ({
                    value: e,
                    label: '.' + e,
                  })),
                ]}
              />
            </div>
            <NumberField
              id="scan-max-items"
              label="Ítems a analizar"
              value={opts.maxItems}
              min={5}
              step={5}
              hint="Más ítems = más peticiones a la API"
              onChange={v => set('maxItems', v)}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Rutas y mercados</h2>
            </div>
            <Select
              id="scan-buy-city"
              label="Ciudad de compra"
              value={opts.buyCity}
              onChange={v => set('buyCity', v)}
              disabled={opts.globalScan}
              options={[
                { value: 'auto', label: 'Automática (mejor precio)' },
                ...CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label })),
              ]}
            />
            {cityChecks}
            <Toggle
              id="scan-safe-only"
              label="Solo rutas seguras (5 ciudades reales)"
              checked={opts.safeOnly}
              onChange={v => set('safeOnly', v)}
              disabled={opts.globalScan}
            />
            <Toggle
              id="scan-same-city"
              label="Permitir comprar y vender en la misma ciudad"
              checked={opts.sameCity}
              onChange={v => set('sameCity', v)}
            />
            {strategy !== 'royalbm' && (
              <Toggle
                id="scan-include-bm"
                label="Incluir Mercado Negro en la venta"
                checked={opts.includeBM}
                onChange={v => set('includeBM', v)}
                disabled={opts.globalScan}
              />
            )}
            <Select
              id="scan-buy-mode"
              label="Modo de compra"
              value={opts.buyMode}
              onChange={v => set('buyMode', v)}
              options={[
                { value: 'instant', label: 'Compra inmediata' },
                { value: 'order', label: 'Orden de compra' },
              ]}
            />
            {strategy !== 'royalbm' && (
              <Select
                id="scan-sell-mode"
                label="Modo de venta"
                value={opts.sellMode}
                onChange={v => set('sellMode', v)}
                options={[
                  { value: 'order', label: 'Orden de venta' },
                  { value: 'instant', label: 'Venta directa' },
                ]}
              />
            )}
          </section>

          {isCraft && (
            <section className="card" id="scan-craft-card">
              <div className="card-head">
                <h2>Producción</h2>
                <span className="card-tag">Craft / Refining</span>
              </div>
              <Select
                id="scan-craft-city"
                label="Dónde craftear / refinar"
                options={CRAFT_CITIES}
                value={opts.craftCity}
                onChange={v => set('craftCity', v)}
              />
              <Select
                id="scan-rrr-mode"
                label="Return Rate"
                value={opts.rrrMode}
                onChange={v => set('rrrMode', v)}
                options={[
                  { value: 'auto', label: 'Automático (bonus real)' },
                  { value: 'manual', label: 'Manual' },
                ]}
              />
              {opts.rrrMode === 'manual' && (
                <NumberField
                  id="scan-manual-rrr"
                  label="RRR manual (%)"
                  value={opts.manualRRR}
                  onChange={v => set('manualRRR', v)}
                />
              )}
              <Toggle
                id="scan-focus"
                label="Usar Focus"
                checked={opts.focus}
                onChange={v => set('focus', v)}
              />
              <NumberField
                id="scan-daily-bonus"
                label="Bonus diario (%)"
                value={opts.dailyBonus}
                onChange={v => set('dailyBonus', v)}
              />
              <NumberField
                id="scan-station-fee"
                label="Tasa de estación (plata / 100 nutrición)"
                value={opts.stationFee}
                onChange={v => set('stationFee', v)}
              />
              <Toggle
                id="scan-buy-order-fee"
                label="Tarifa de orden de compra (2,5 %)"
                checked={opts.buyOrderFee}
                onChange={v => set('buyOrderFee', v)}
              />
            </section>
          )}

          <section className="card" id="scan-run-card">
            <button type="button" className="btn primary full" id="scan-run" disabled={busy} onClick={run}>
              Buscar oportunidades
            </button>
            {busy && (
              <button type="button" className="btn ghost full" id="scan-cancel" onClick={cancel}>
                Cancelar búsqueda
              </button>
            )}
            <p
              className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')}
              id="scan-status"
            >
              {status}
            </p>
            <p className="hint">
              Actualización automática cada 15 minutos mientras Flipping esté abierto. Los resultados se
              ordenan por ganancia neta.
            </p>
          </section>
        </div>

        <div className="results-col">
          <section className="card" id="scan-summary">
            <div className="card-head">
              <h2>Resumen</h2>
              <span className="card-tag" id="scan-meta">
                {busy
                  ? 'Buscando…'
                  : summary
                    ? `${current.label} · ${summary.candidates} ítems`
                    : 'Sin búsqueda'}
              </span>
            </div>
            <ResultGrid
              cards={[
                { id: 'scan-candidates', label: 'Ítems analizados', value: fmt(summary?.candidates || 0) },
                { id: 'scan-requests', label: 'Peticiones AODP', value: fmt(summary?.requests || 0) },
                {
                  id: 'scan-deduplicated',
                  label: 'Solicitudes deduplicadas',
                  value: fmt(summary?.deduplicated || 0),
                },
                { id: 'scan-prices', label: 'Filas recibidas', value: fmt(summary?.prices || 0) },
                {
                  id: 'scan-coverage',
                  label: 'Cobertura AODP',
                  value: summary
                    ? summary.coverage.requested
                      ? `${fmt2(summary.coverage.percent)} % (${fmt(summary.coverage.quoted)}/${fmt(summary.coverage.requested)})`
                      : 'Sin consultas'
                    : '—',
                },
                {
                  id: 'scan-missing',
                  label: 'Cotizaciones ausentes',
                  value: fmt(summary?.coverage?.missing || 0),
                },
                { id: 'scan-rows', label: 'Oportunidades', value: fmt(rows.length) },
              ]}
            />
            {busy && (
              <div className="progress" id="scan-progress">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </section>
          <section className="card" id="scan-opportunities">
            <div className="card-head">
              <h2>Oportunidades</h2>
              <span className="card-tag">Top 30 por ganancia neta</span>
              <span className="hint" id="scan-description">
                {rows.length ? describe(rows[0]) : ''}
              </span>
            </div>
            <div id="scan-results">
              {busy ? (
                <p className="empty-note">Buscando oportunidades…</p>
              ) : rows.length ? (
                <DataTable columns={columns} rows={rows} />
              ) : (
                <p className="empty-note">Configurá los filtros y pulsá «Buscar oportunidades».</p>
              )}
            </div>
          </section>
          <details className="card notes">
            <summary>Antes de invertir</summary>
            <div className="notes-body">
              <p>
                Los precios vienen de la API comunitaria de Albion Online Data Project y pueden estar
                desactualizados. Verificá siempre en el juego.
              </p>
              <p>
                Las rutas por Caerleon, Brecilien o el Mercado Negro implican zonas de riesgo; activá «Solo
                rutas seguras» para excluirlas.
              </p>
              <p>
                Las ventas al Mercado Negro incluyen la tasa de publicación del 2,5 %. La estrategia «Mejora»
                suma el precio del ítem anterior y sus runas, almas o reliquias.
              </p>
              <p>
                El rastreo se actualiza automáticamente cada 15 minutos mientras Flipping esté abierto; el
                modo global analiza una muestra de hasta 250 ítems para respetar los límites de la API.
              </p>
              <p>
                «Abrir en calculadora» carga la oportunidad con sus precios para que agregues diarios,
                transporte y otros costes reales.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
