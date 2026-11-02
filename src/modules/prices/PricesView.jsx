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

  React.useEffect(() => {
    if (pending?.itemId) setItemId(pending.itemId);
  }, [pending?.itemId]);

  async function load() {
    if (!item) { setStatus('Elegí un ítem primero.'); return; }
    setBusy(true);
    setStatus('Consultando AODP…');
    try {
      const all = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: CITIES.map(c => c.value), quality: shared.quality });
      const map = api.indexRows(all);
      const list = CITIES.map(c => {
        const row = api.pick(map, item.id, c.value, shared.quality);
        const sell = api.priceFor(row, 'sell');
        const buy = api.priceFor(row, 'buy');
        if (!sell && !buy) return null;
        const spread = sell && buy ? sell.price - buy.price : null;
        return { city: c.value, label: c.label, sell: sell?.price || 0, buy: buy?.price || 0,
          spread, roi: spread != null && buy?.price > 0 ? spread / buy.price * 100 : null,
          ageSell: ageFromDate(sell?.date), ageBuy: ageFromDate(buy?.date) };
      }).filter(Boolean);
      setCityRows(list);

      const qualities = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: [city], quality: '1,2,3,4,5' });
      const qmap = api.indexRows(qualities);
      setQualityRows(QUALITIES.map(q => {
        const row = api.pick(qmap, item.id, city, q.value);
        const sell = api.priceFor(row, 'sell');
        const buy = api.priceFor(row, 'buy');
        if (!sell && !buy) return null;
        return { quality: q.label, sell: sell?.price || 0, buy: buy?.price || 0,
          spread: sell && buy ? sell.price - buy.price : null, age: ageFromDate(sell?.date) };
      }).filter(Boolean));
      setStatus('✔ Precios actualizados.');
    } catch (error) {
      setStatus('✖ ' + error.message);
    } finally { setBusy(false); }
  }

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
              placeholder="Buscar ítem por nombre o ID…"
              onChange={entry => { setItem(entry); setItemId(entry.id); }} />
          </section>
          <section className="card">
            <div className="card-head"><h2>Consulta</h2></div>
            <Select id="prices-city" label="Ciudad para el detalle de calidad"
              options={CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label }))}
              value={city} onChange={setCity} />
            <button type="button" className="btn primary full" id="prices-load" disabled={busy} onClick={load}>
              ↻ Cargar precios
            </button>
            <p className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')} id="prices-status">{status}</p>
          </section>
          <section className="card">
            <div className="card-head"><h2>Lectura de precios</h2></div>
            <div className="tax-box">
              <div><span><b>sell_price_min</b> · orden de venta</span><b>compra inmediata</b></div>
              <div><span><b>buy_price_max</b> · mejor oferta</span><b>venta directa</b></div>
              <div><span>Spread</span><b>diferencia entre ambos</b></div>
              <div><span>Antigüedad</span><b>frescura del dato</b></div>
            </div>
            <p className="hint">La app nunca recarga sola: respeta el límite de peticiones de AODP (100 / min, 300 / 5 min).</p>
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
                      { label: 'Orden de venta', align: 'right', render: r => r.sell ? fmt(r.sell) : '—' },
                      { label: 'Venta directa', align: 'right', render: r => r.buy ? fmt(r.buy) : '—' },
                      { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : <span className={profitClass(r.spread)}>{fmt(r.spread)}</span> },
                      { label: 'ROI bruto', align: 'right', render: r => r.roi == null ? '—' : fmt2(r.roi) + ' %' },
                      { label: 'Edad venta', align: 'right', render: r => <span className={`age ${r.ageSell.tone}`}>{esc(r.ageSell.label)}</span> },
                      { label: 'Edad compra', align: 'right', render: r => <span className={`age ${r.ageBuy.tone}`}>{esc(r.ageBuy.label)}</span> },
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
                    { label: 'Orden de venta', align: 'right', render: r => r.sell ? fmt(r.sell) : '—' },
                    { label: 'Venta directa', align: 'right', render: r => r.buy ? fmt(r.buy) : '—' },
                    { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : fmt(r.spread) },
                    { label: 'Edad', align: 'right', render: r => <span className={`age ${r.age.tone}`}>{esc(r.age.label)}</span> },
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
