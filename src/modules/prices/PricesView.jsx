/* Módulo Precios: matriz de ciudades y comparativa por calidad. */
import * as React from 'react';
import { CITIES, QUALITIES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import { esc, fmt, fmt2, ageFromDate, profitClass } from '../../services/format.js';
import { useApp } from '../../app/AppContext.jsx';
import { Select } from '../../components/common/Field.jsx';
import { Tabs } from '../../components/common/Tabs.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ItemSelector } from '../../components/common/ItemSelector.jsx';
import { PriceBars } from '../../components/charts/PriceBars.jsx';
import { MODULE_ICONS } from '../../components/layout/sidebar-data.js';
import { cn } from '../../lib/utils.js';

const TABS = [{ id: 'cities', label: 'Ciudades' }, { id: 'quality', label: 'Por calidad' }];

export default function PricesView({ meta }) {
  const { shared, pending } = useApp();
  const Icon = MODULE_ICONS.prices;
  const [item, setItem] = React.useState(null);
  const [itemId, setItemId] = React.useState(null);
  const [city, setCity] = React.useState('Lymhurst');
  const [tab, setTab] = React.useState(pending?.tab === 'quality' ? 'quality' : 'cities');
  const [cityRows, setCityRows] = React.useState([]);
  const [qualityRows, setQualityRows] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [cacheCount, setCacheCount] = React.useState(null);
  const [cacheBusy, setCacheBusy] = React.useState(false);
  const [cacheStatus, setCacheStatus] = React.useState('');
  const requestId = React.useRef(0);

  const refreshCacheInfo = React.useCallback(async () => {
    try {
      setCacheCount(await api.getPriceCacheCount());
    } catch (error) {
      setCacheStatus(`No se pudo acceder a la caché local: ${error.message}`);
    }
  }, []);

  React.useEffect(() => { void refreshCacheInfo(); }, [refreshCacheInfo]);

  React.useEffect(() => {
    if (!pending?.itemId) return;
    const entry = catalog.get(pending.itemId);
    if (entry) {
      setItem(entry);
      setItemId(entry.id);
    }
  }, [pending?.itemId]);

  const load = React.useCallback(async () => {
    if (!item) { setStatus('Elegí un ítem primero.'); return; }
    const currentRequest = ++requestId.current;
    setBusy(true);
    setStatus('Consultando AODP…');
    try {
      const all = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: CITIES.map(c => c.value), quality: shared.quality });
      if (currentRequest !== requestId.current) return;
      const map = api.indexRows(all);
      const list = CITIES.map(c => {
        const row = api.pick(map, item.id, c.value, shared.quality);
        const sell = api.priceFor(row, 'sell');
        const buy = api.priceFor(row, 'buy');
        const spread = sell && buy ? sell.price - buy.price : null;
        return {
          city: c.value, label: c.label, sell: sell?.price ?? null, buy: buy?.price ?? null,
          sourceSell: sell?.source, sourceBuy: buy?.source,
          spread, roi: spread != null && buy?.price > 0 ? spread / buy.price * 100 : null,
          ageSell: sell ? ageFromDate(sell.date) : null, ageBuy: buy ? ageFromDate(buy.date) : null };
      });
      setCityRows(list);

      const qualities = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: [city], quality: '1,2,3,4,5' });
      if (currentRequest !== requestId.current) return;
      const qmap = api.indexRows(qualities);
      setQualityRows(QUALITIES.map(q => {
        const row = api.pick(qmap, item.id, city, q.value);
        const sell = api.priceFor(row, 'sell');
        const buy = api.priceFor(row, 'buy');
        return { quality: q.label, sell: sell?.price ?? null, buy: buy?.price ?? null,
          sourceSell: sell?.source, sourceBuy: buy?.source,
          spread: sell && buy ? sell.price - buy.price : null, age: sell ? ageFromDate(sell.date) : null };
      }));
      setStatus(`✔ Consulta completada. Las celdas sin cotización indican «No se registra precio». ${api.cacheNotice([...all, ...qualities])}`);
      await refreshCacheInfo();
    } catch (error) {
      if (currentRequest === requestId.current) setStatus('✖ ' + error.message);
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }, [item, city, shared.server, shared.quality, refreshCacheInfo]);

  async function clearCache() {
    setCacheBusy(true);
    setCacheStatus('');
    try {
      await api.clearPriceCache();
      setCacheCount(0);
      setCacheStatus('Caché local borrada.');
    } catch (error) {
      setCacheStatus(`No se pudo borrar la caché local: ${error.message}`);
    } finally {
      setCacheBusy(false);
    }
  }

  React.useEffect(() => {
    if (!item) return undefined;
    requestId.current++;
    const timer = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(timer);
  }, [item, load]);

  return (
    <div className="module-view" data-module="prices">
      <div className="module-head">
        <div><h1><Icon className="size-5" />{meta?.label}</h1><p>{meta?.description}</p></div>
        <span className="module-badge">{meta?.group}</span>
      </div>
      <Tabs id="prices-tabs" tabs={TABS} active={tab} onChange={setTab} />
      <div className="work-grid">
        <div className="config-col">
          <section className="card">
            <div className="card-head"><h2>Ítem</h2><span className="card-tag">{fmt(catalog.total)} referencias</span></div>
            <ItemSelector id="prices-item" quality={shared.quality} value={itemId}
              showCategory
              placeholder="Buscar ítem por nombre o ID…"
              onChange={entry => {
                if (!entry) {
                  setItem(null); setItemId(null); setCityRows([]); setQualityRows([]);
                  return;
                }
                setItem(entry); setItemId(entry.id); setCityRows([]); setQualityRows([]);
              }} />
          </section>
          <section className="card">
            <div className="card-head"><h2>Consulta</h2></div>
            <Select id="prices-city" label="Ciudad para el detalle de calidad"
              options={CITIES.map(c => ({ value: c.value, label: c.label }))}
              value={city} onChange={setCity} />
            <button type="button" className="btn primary full" id="prices-load" disabled={busy} onClick={load}>
              ↻ Cargar precios
            </button>
            <p className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')} id="prices-status">{status}</p>
            <div className="tax-box">
              <div><span>Cotizaciones guardadas en este dispositivo</span><b id="prices-cache-count">{cacheCount == null ? '—' : fmt(cacheCount)}</b></div>
              <button type="button" id="prices-clear-cache" className="btn ghost" disabled={cacheBusy || !cacheCount}
                onClick={clearCache}>Borrar caché local</button>
              <p className="status" id="prices-cache-status" role="status">{cacheStatus}</p>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2>Lectura de precios</h2></div>
            <div className="tax-box">
              <div><span><b>sell_price_min</b> · orden de venta</span><b>compra inmediata</b></div>
              <div><span><b>buy_price_max</b> · mejor oferta</span><b>venta directa</b></div>
              <div><span>Spread</span><b>diferencia entre ambos</b></div>
              <div><span>Antigüedad</span><b>frescura del dato</b></div>
            </div>
            <p className="hint">Se consulta automáticamente al elegir un ítem o cambiar sus filtros. AODP solo recibe datos cuando alguien inspecciona el mercado con su cliente activo. Para ayudar a actualizar precios, <a href="https://github.com/ao-data/albiondata-client/releases" target="_blank" rel="noreferrer">descargá Albion Data Client</a>, recorré las ciudades y volvé a cargar. No se estiman cotizaciones faltantes.</p>
          </section>
        </div>
        <div className="results-col">
          {tab === 'cities' ? (
            <section className="card" id="prices-panel-cities">
              <div className="card-head"><h2>Precios por ciudad</h2>
                <span className="card-tag" id="prices-meta">{item ? `${item.id} · ${cityRows.length} ciudades · calidad ${shared.quality}` : 'Sin ítem'}</span>
              </div>
              <div id="prices-cities">
                {cityRows.length ? (
                  <>
                    <DataTable columns={[
                      { label: 'Ciudad', render: r => <strong>{r.label}</strong> },
                      { label: 'Orden de venta', align: 'right', render: r => r.sell
                        ? <>{fmt(r.sell)}{r.sourceSell === 'cache' && <small className="age none">cotización anterior</small>}</>
                        : 'No se registra precio' },
                      { label: 'Venta directa', align: 'right', render: r => r.buy
                        ? <>{fmt(r.buy)}{r.sourceBuy === 'cache' && <small className="age none">cotización anterior</small>}</>
                        : 'No se registra precio' },
                      { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : <span className={profitClass(r.spread)}>{fmt(r.spread)}</span> },
                      { label: 'ROI bruto', align: 'right', render: r => r.roi == null ? '—' : fmt2(r.roi) + ' %' },
                      { label: 'Edad venta', align: 'right', render: r => r.ageSell
                        ? <span className={`age ${r.ageSell.tone}`}>{esc(r.ageSell.label)}</span>
                        : <span className="age none">No se registra precio</span> },
                      { label: 'Edad compra', align: 'right', render: r => r.ageBuy
                        ? <span className={`age ${r.ageBuy.tone}`}>{esc(r.ageBuy.label)}</span>
                        : <span className="age none">No se registra precio</span> },
                    ]} rows={cityRows} />
                    <PriceBars rows={cityRows.filter(r => r.sell).map(r => ({ city: r.label, price: r.sell }))} />
                  </>
                ) : <p className="empty-note">Elegí un ítem y cargá los precios.</p>}
              </div>
            </section>
          ) : (
            <section className="card" id="prices-panel-quality">
              <div className="card-head"><h2>Precios por calidad</h2>
                <span className="card-tag" id="prices-quality-meta">{item ? `${item.id} · ${city}` : 'Sin datos'}</span>
              </div>
              <div id="prices-quality">
                {qualityRows.length ? (
                  <DataTable columns={[
                    { label: 'Calidad', render: r => <strong>{r.quality}</strong> },
                    { label: 'Orden de venta', align: 'right', render: r => r.sell
                      ? <>{fmt(r.sell)}{r.sourceSell === 'cache' && <small className="age none">cotización anterior</small>}</>
                      : 'No se registra precio' },
                    { label: 'Venta directa', align: 'right', render: r => r.buy
                      ? <>{fmt(r.buy)}{r.sourceBuy === 'cache' && <small className="age none">cotización anterior</small>}</>
                      : 'No se registra precio' },
                    { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : fmt(r.spread) },
                    { label: 'Edad', align: 'right', render: r => r.age
                      ? <span className={`age ${r.age.tone}`}>{esc(r.age.label)}</span>
                      : <span className="age none">No se registra precio</span> },
                  ]} rows={qualityRows} />
                ) : <p className="empty-note">Elegí un ítem y cargá los precios.</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
