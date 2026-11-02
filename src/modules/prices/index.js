/* Módulo Precios: matriz de ciudades y comparativa por calidad. */
import { CITIES, MODULES, QUALITIES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import { esc, fmt, fmt2, ageFromDate, profitClass } from '../../services/format.js';
import { Select } from '../../components/common/Select.js';
import { Tabs, bindTabs } from '../../components/common/Tabs.js';
import { DataTable } from '../../components/common/DataTable.js';
import { ItemSelector, mountItemSelector } from '../../components/common/ItemSelector.js';
import { PriceBars } from '../../components/charts/PriceBars.js';

const meta = MODULES.find(m => m.id === 'prices');
const TABS = [{ id: 'cities', label: 'Ciudades' }, { id: 'quality', label: 'Por calidad' }];

export function render(ctx) {
  return `
    <div class="module-view" data-module="prices">
      <div class="module-head">
        <div><h1>${meta.icon} ${esc(meta.label)}</h1><p>${esc(meta.description)}</p></div>
        <span class="module-badge">${esc(meta.group)}</span>
      </div>
      ${Tabs({ id: 'prices-tabs', tabs: TABS, active: 'cities' })}
      <div class="work-grid">
        <div class="config-col">
          <section class="card">
            <div class="card-head"><h2>Ítem</h2><span class="card-tag">${fmt(catalog.total)} referencias</span></div>
            ${ItemSelector({ id: 'prices-item', placeholder: 'Buscar ítem por nombre o ID…' })}
          </section>
          <section class="card">
            <div class="card-head"><h2>Consulta</h2></div>
            ${Select({ id: 'prices-city', label: 'Ciudad para el detalle de calidad', options: CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label })), value: 'Lymhurst' })}
            <button type="button" class="btn primary full" id="prices-load">↻ Cargar precios</button>
            <p class="status" id="prices-status"></p>
          </section>
          <section class="card">
            <div class="card-head"><h2>Lectura de precios</h2></div>
            <div class="tax-box">
              <div><span><b>sell_price_min</b> · orden de venta</span><b>compra inmediata</b></div>
              <div><span><b>buy_price_max</b> · mejor oferta</span><b>venta directa</b></div>
              <div><span>Spread</span><b>diferencia entre ambos</b></div>
              <div><span>Antigüedad</span><b>frescura del dato</b></div>
            </div>
            <p class="hint">La app nunca recarga sola: respeta el límite de peticiones de AODP (100 / min, 300 / 5 min).</p>
          </section>
        </div>
        <div class="results-col">
          <section class="card" id="prices-panel-cities">
            <div class="card-head"><h2>Precios por ciudad</h2><span class="card-tag" id="prices-meta">Sin ítem</span></div>
            <div id="prices-cities"><p class="empty-note">Elegí un ítem y cargá los precios.</p></div>
          </section>
          <section class="card" id="prices-panel-quality" hidden>
            <div class="card-head"><h2>Precios por calidad</h2><span class="card-tag" id="prices-quality-meta">Sin datos</span></div>
            <div id="prices-quality"><p class="empty-note">Elegí un ítem y cargá los precios.</p></div>
          </section>
        </div>
      </div>
    </div>`;
}

export function mount(root, ctx) {
  const $ = id => root.querySelector(`#${id}`);
  const shared = ctx.shared;
  let item = null;
  let selector = null;
  let tab = 'cities';

  selector = mountItemSelector(root, { id: 'prices-item', quality: Number(shared.quality),
    onSelect: entry => { item = entry; }, });
  ctx.onDestroy?.(() => selector.destroy());

  function cityRows(map) {
    return CITIES.map(c => {
      const row = api.pick(map, item.id, c.value, Number(shared.quality));
      const sell = api.priceFor(row, 'sell');
      const buy = api.priceFor(row, 'buy');
      if (!sell && !buy) return null;
      const spread = sell && buy ? sell.price - buy.price : null;
      return {
        city: c.value, label: c.label, sell: sell?.price || 0, buy: buy?.price || 0,
        spread, roi: spread != null && buy?.price > 0 ? spread / buy.price * 100 : null,
        ageSell: ageFromDate(sell?.date), ageBuy: ageFromDate(buy?.date), price: sell?.price || buy?.price || 0,
      };
    }).filter(Boolean);
  }

  async function load() {
    if (!item) { $('prices-status').textContent = 'Elegí un ítem primero.'; return; }
    const button = $('prices-load');
    button.disabled = true;
    $('prices-status').textContent = 'Consultando AODP…';
    $('prices-status').className = 'status';
    try {
      const all = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: CITIES.map(c => c.value), quality: Number(shared.quality) });
      const rows = cityRows(api.indexRows(all));
      $('prices-meta').textContent = `${item.id} · ${rows.length} ciudades · calidad ${shared.quality}`;
      $('prices-cities').innerHTML = rows.length ? DataTable({
        columns: [
          { label: 'Ciudad', render: r => `<strong>${esc(r.label)}</strong>` },
          { label: 'Orden de venta', align: 'right', render: r => r.sell ? fmt(r.sell) : '—' },
          { label: 'Venta directa', align: 'right', render: r => r.buy ? fmt(r.buy) : '—' },
          { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : `<span class="${profitClass(r.spread)}">${fmt(r.spread)}</span>` },
          { label: 'ROI bruto', align: 'right', render: r => r.roi == null ? '—' : fmt2(r.roi) + ' %' },
          { label: 'Edad venta', align: 'right', render: r => `<span class="age ${r.ageSell.tone}">${esc(r.ageSell.label)}</span>` },
          { label: 'Edad compra', align: 'right', render: r => `<span class="age ${r.ageBuy.tone}">${esc(r.ageBuy.label)}</span>` },
        ], rows,
      }) + PriceBars(rows.filter(r => r.sell).map(r => ({ city: r.label, price: r.sell })))
        : '<p class="empty-note">La API no devolvió precios para este ítem.</p>';

      const qualities = await api.fetchPrices({ server: shared.server, ids: [item.id],
        cities: [$('prices-city').value], quality: '1,2,3,4,5' });
      const qrows = QUALITIES.map(q => {
        const row = api.pick(api.indexRows(qualities), item.id, $('prices-city').value, q.value);
        const sell = api.priceFor(row, 'sell');
        const buy = api.priceFor(row, 'buy');
        if (!sell && !buy) return null;
        return { quality: q.label, sell: sell?.price || 0, buy: buy?.price || 0,
          spread: sell && buy ? sell.price - buy.price : null, age: ageFromDate(sell?.date) };
      }).filter(Boolean);
      $('prices-quality-meta').textContent = `${item.id} · ${esc($('prices-city').value)}`;
      $('prices-quality').innerHTML = qrows.length ? DataTable({
        columns: [
          { label: 'Calidad', render: r => `<strong>${esc(r.quality)}</strong>` },
          { label: 'Orden de venta', align: 'right', render: r => r.sell ? fmt(r.sell) : '—' },
          { label: 'Venta directa', align: 'right', render: r => r.buy ? fmt(r.buy) : '—' },
          { label: 'Spread', align: 'right', render: r => r.spread == null ? '—' : fmt(r.spread) },
          { label: 'Edad', align: 'right', render: r => `<span class="age ${r.age.tone}">${esc(r.age.label)}</span>` },
        ], rows: qrows,
      }) : '<p class="empty-note">Sin precios por calidad para esta ciudad.</p>';
      $('prices-status').textContent = '✔ Precios actualizados.';
      $('prices-status').className = 'status ok';
    } catch (error) {
      $('prices-status').textContent = '✖ ' + error.message;
      $('prices-status').className = 'status err';
    } finally { button.disabled = false; }
  }

  bindTabs(root, 'prices-tabs', id => {
    tab = id;
    $('prices-panel-cities').hidden = id !== 'cities';
    $('prices-panel-quality').hidden = id !== 'quality';
  });
  $('prices-load').addEventListener('click', load);
  ctx.onSharedChange?.(s => selector.setQuality(Number(s.quality)));
}
