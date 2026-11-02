/* Módulo Flipping / TRADES: pestañas horizontales por estrategia. */
import { CITIES, CRAFT_CITIES, CATEGORIES, MODULES, ROYAL_CITIES, BLACK_MARKET } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import { esc, fmt, fmt1, fmt2, ageInfo, profitClass } from '../../services/format.js';
import { Select, NumberField, Toggle } from '../../components/common/Select.js';
import { Tabs, bindTabs } from '../../components/common/Tabs.js';
import { DataTable } from '../../components/common/DataTable.js';
import { ResultGrid } from '../../components/common/ResultCard.js';
import { scan, STRATEGIES, describe } from './scanner.js';

const meta = MODULES.find(m => m.id === 'flipping');

function configCards() {
  const cityChecks = CITIES.map(c => `
    <label class="check"><input type="checkbox" class="sell-city" value="${esc(c.value)}" ${c.value !== BLACK_MARKET ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>Filtros</h2><span class="card-tag" id="scan-strategy-tag">Flip</span></div>
      ${Select({ id: 'scan-category', label: 'Categoría', options: CATEGORIES, value: '' })}
      <label class="field"><span>Buscar nombre o ID (opcional)</span><input type="search" id="scan-query" class="text-input" placeholder="Ej: arco, T4_BAG…"></label>
      <div class="field-row">
        ${Select({ id: 'scan-tier', label: 'Tier', options: [{ value: '', label: 'Todos' }, ...[2,3,4,5,6,7,8].map(t => ({ value: t, label: 'T' + t }))], value: '' })}
        ${Select({ id: 'scan-ench', label: 'Encantamiento', options: [{ value: '', label: 'Todos' }, ...[0,1,2,3,4].map(e => ({ value: e, label: '.' + e }))], value: '' })}
      </div>
      ${NumberField({ id: 'scan-max-items', label: 'Ítems a analizar', value: 60, min: 5, step: 5, hint: 'Más ítems = más peticiones a la API' })}
    </section>

    <section class="card">
      <div class="card-head"><h2>Rutas y mercados</h2></div>
      ${Select({ id: 'scan-buy-city', label: 'Ciudad de compra', options: [{ value: 'auto', label: 'Automática (mejor precio)' }, ...CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label }))], value: 'auto' })}
      <div class="field"><span>Ciudades de venta</span><div class="check-grid">${cityChecks}</div></div>
      ${Toggle({ id: 'scan-safe-only', label: 'Solo rutas seguras (5 ciudades reales)', checked: true })}
      ${Toggle({ id: 'scan-same-city', label: 'Permitir comprar y vender en la misma ciudad' })}
      ${Toggle({ id: 'scan-include-bm', label: 'Incluir Mercado Negro en la venta' })}
      ${Select({ id: 'scan-buy-mode', label: 'Modo de compra', options: [{ value: 'instant', label: 'Compra inmediata' }, { value: 'order', label: 'Orden de compra' }], value: 'instant' })}
      ${Select({ id: 'scan-sell-mode', label: 'Modo de venta', options: [{ value: 'order', label: 'Orden de venta' }, { value: 'instant', label: 'Venta directa' }], value: 'order' })}
    </section>

    <section class="card" id="scan-craft-card">
      <div class="card-head"><h2>Producción</h2><span class="card-tag">Craft / Refining</span></div>
      ${Select({ id: 'scan-craft-city', label: 'Dónde craftear / refinar', options: CRAFT_CITIES, value: 'auto' })}
      ${Select({ id: 'scan-rrr-mode', label: 'Return Rate', options: [{ value: 'auto', label: 'Automático (bonus real)' }, { value: 'manual', label: 'Manual' }], value: 'auto' })}
      ${NumberField({ id: 'scan-manual-rrr', label: 'RRR manual (%)', value: 36.7, min: 0, step: 0.1 })}
      ${Toggle({ id: 'scan-focus', label: 'Usar Focus' })}
      ${NumberField({ id: 'scan-daily-bonus', label: 'Bonus diario (%)', value: 0, min: 0 })}
      ${NumberField({ id: 'scan-station-fee', label: 'Tasa de estación (plata / 100 nutrición)', value: 0 })}
      ${Toggle({ id: 'scan-buy-order-fee', label: 'Tarifa de orden de compra (2,5 %)' })}
    </section>

    <section class="card">
      <div class="card-head"><h2>Filtros de resultado</h2></div>
      ${NumberField({ id: 'scan-min-profit', label: 'Ganancia mínima por unidad', value: 0 })}
      ${NumberField({ id: 'scan-min-roi', label: 'ROI mínimo (%)', value: 0 })}
      ${NumberField({ id: 'scan-max-age', label: 'Antigüedad máxima (h, 0 = sin límite)', value: 8, min: 0 })}
      ${Select({ id: 'scan-sort', label: 'Ordenar por', options: [{ value: 'profit', label: 'Ganancia' }, { value: 'roi', label: 'ROI' }, { value: 'margin', label: 'Margen' }, { value: 'freshness', label: 'Frescura' }], value: 'profit' })}
      ${NumberField({ id: 'scan-limit', label: 'Filas a mostrar', value: 30, min: 1 })}
      <button type="button" class="btn primary full" id="scan-run">Buscar oportunidades</button>
      <p class="status" id="scan-status"></p>
      <p class="hint">Sin recarga automática: cada búsqueda hace solo las peticiones necesarias para respetar el límite de AODP.</p>
    </section>`;
}

function resultsCards() {
  return `
    <section class="card">
      <div class="card-head"><h2>Resumen</h2><span class="card-tag" id="scan-meta">Sin búsqueda</span></div>
      ${ResultGrid([
        { id: 'scan-candidates', label: 'Ítems analizados', value: '0' },
        { id: 'scan-requests', label: 'Peticiones', value: '0' },
        { id: 'scan-prices', label: 'Precios recibidos', value: '0' },
        { id: 'scan-rows', label: 'Oportunidades', value: '0' },
      ])}
      <div class="progress" id="scan-progress" hidden><div class="progress-fill" id="scan-progress-fill"></div></div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Oportunidades</h2><span class="hint" id="scan-description"></span></div>
      <div id="scan-results"><p class="empty-note">Configurá los filtros y pulsá «Buscar oportunidades».</p></div>
    </section>
    <details class="card notes">
      <summary>Antes de invertir</summary>
      <div class="notes-body">
        <p>Los precios vienen de la API comunitaria de Albion Online Data Project y pueden estar desactualizados. Verificá siempre en el juego.</p>
        <p>Las rutas por Caerleon, Brecilien o el Mercado Negro implican zonas de riesgo; activá «Solo rutas seguras» para excluirlas.</p>
        <p>«Abrir en calculadora» carga la oportunidad con sus precios para que agregues diarios, transporte y otros costes reales.</p>
      </div>
    </details>`;
}

export function render(ctx) {
  return `
    <div class="module-view" data-module="flipping">
      <div class="module-head">
        <div><h1>${meta.icon} ${esc(meta.label)}</h1><p>${esc(meta.description)}</p></div>
        <span class="module-badge">${esc(meta.group)}</span>
      </div>
      ${Tabs({ id: 'scan-tabs', tabs: STRATEGIES.map(t => ({ id: t.id, label: t.label })), active: 'flip' })}
      <p class="strategy-hint" id="scan-strategy-hint">${esc(STRATEGIES[0].description)}</p>
      <div class="work-grid">
        <div class="config-col">${configCards()}</div>
        <div class="results-col">${resultsCards()}</div>
      </div>
    </div>`;
}

export function mount(root, ctx) {
  const $ = id => root.querySelector(`#${id}`);
  const shared = ctx.shared;
  let strategy = 'flip';
  let busy = false;

  function setStrategy(id) {
    strategy = id;
    const strategyData = STRATEGIES.find(s => s.id === id);
    $('scan-strategy-tag').textContent = strategyData.label;
    $('scan-strategy-hint').textContent = strategyData.description;
    const craft = id === 'craft' || id === 'refine';
    $('scan-craft-card').hidden = !craft;
    $('scan-sell-mode').closest('.field').hidden = id === 'royalbm';
    $('scan-include-bm').closest('.toggle').hidden = id === 'royalbm';
    root.querySelectorAll('.sell-city').forEach(cb => { cb.disabled = id === 'royalbm'; });
  }

  function readOptions() {
    const sellCities = [...root.querySelectorAll('.sell-city')].filter(c => c.checked).map(c => c.value);
    const tier = $('scan-tier').value;
    const ench = $('scan-ench').value;
    return {
      strategy,
      server: shared.server, quality: Number(shared.quality), premium: shared.premium,
      category: $('scan-category').value, query: $('scan-query').value.trim(),
      tiers: tier ? [Number(tier)] : [4, 5, 6, 7, 8],
      enchants: ench ? [Number(ench)] : [0],
      maxItems: Number($('scan-max-items').value) || 60,
      buyCity: $('scan-buy-city').value,
      sellCities, includeBM: $('scan-include-bm').checked,
      safeOnly: $('scan-safe-only').checked, sameCity: $('scan-same-city').checked,
      buyMode: $('scan-buy-mode').value, sellMode: $('scan-sell-mode').value,
      craftCity: $('scan-craft-city').value,
      rrrMode: $('scan-rrr-mode').value, manualRRR: Number($('scan-manual-rrr').value) || 0,
      focus: $('scan-focus').checked, dailyBonus: Number($('scan-daily-bonus').value) || 0,
      stationFee: Number($('scan-station-fee').value) || 0,
      buyOrderFee: $('scan-buy-order-fee').checked,
      minProfit: Number($('scan-min-profit').value) || 0,
      minRoi: Number($('scan-min-roi').value) || 0,
      maxAgeHours: Number($('scan-max-age').value) || 0,
      sort: $('scan-sort').value, limit: Number($('scan-limit').value) || 30,
      proxy: '',
    };
  }

  function renderRows(rows) {
    const columns = [
      { label: 'Ítem', render: r => `<div class="material-cell"><img src="${esc(catalog.icon(r.id, r.quality))}" alt=""><div><strong>${esc(r.item.es)}</strong><small>${esc(r.id)}</small></div></div>` },
      { label: 'Ruta', render: r => `<div class="route"><span>${esc(r.buyCity)} → ${esc(r.sellCity)}</span>${r.strategy === 'craft' || r.strategy === 'refine' ? `<small>craftear en ${esc(r.craftCity)} · RRR ${fmt1(r.rrr)} %</small>` : `<small>buy ${esc(r.buyMode === 'instant' ? 'inmediata' : 'orden')} · sell ${esc(r.sellMode === 'instant' ? 'directa' : 'orden')}</small>`}</div>` },
      { label: 'Coste / u', align: 'right', render: r => fmt(r.costPerUnit) },
      { label: 'Venta / u', align: 'right', render: r => fmt(r.revenuePerUnit) },
      { label: 'Impuestos', align: 'right', render: r => fmt(r.salesTax + r.setupFee + r.stationFee + r.buyOrderFee) },
      { label: 'Ganancia / u', align: 'right', render: r => `<strong class="${profitClass(r.profit)}">${fmt(r.profit)}</strong>` },
      { label: 'ROI', align: 'right', render: r => `<span class="${profitClass(r.roi)}">${fmt2(r.roi)} %</span>` },
      { label: 'Edad', align: 'right', render: r => `<span class="age ${ageInfo(r.age).tone}">${esc(ageInfo(r.age).label)}</span>` },
      { label: '', align: 'right', render: r => `<button type="button" class="btn tiny" data-open="${esc(r.id)}">Abrir en calculadora</button>` },
    ];
    $('scan-results').innerHTML = rows.length ? DataTable({ columns, rows, empty: 'No hay oportunidades con esos filtros.' })
      : '<p class="empty-note">No hay oportunidades con esos filtros. Probá con menos restricciones o más ítems.</p>';
    $('scan-rows').textContent = String(rows.length);
    $('scan-results').querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.open);
        if (row) ctx.navigate('crafting', { opportunity: row });
      });
    });
  }

  async function run() {
    if (busy) return;
    busy = true;
    const button = $('scan-run');
    button.disabled = true;
    $('scan-results').innerHTML = '<p class="empty-note">Buscando oportunidades…</p>';
    $('scan-rows').textContent = '0';
    $('scan-meta').textContent = 'Buscando…';
    $('scan-status').textContent = 'Consultando precios…';
    $('scan-status').className = 'status';
    $('scan-progress').hidden = false;
    $('scan-progress-fill').style.width = '5%';
    try {
      const result = await scan(readOptions(), p => {
        $('scan-status').textContent = p.message;
        if (p.total) $('scan-progress-fill').style.width = `${Math.max(5, p.done / p.total * 100)}%`;
      });
      $('scan-candidates').textContent = String(result.candidates);
      $('scan-requests').textContent = String(result.requests);
      $('scan-prices').textContent = String(result.prices);
      $('scan-meta').textContent = `${STRATEGIES.find(s => s.id === strategy).label} · ${result.candidates} ítems`;
      $('scan-description').textContent = result.rows.length ? describe(result.rows[0]) : '';
      $('scan-progress-fill').style.width = '100%';
      $('scan-status').textContent = result.rows.length
        ? `✔ ${result.rows.length} oportunidades. Verificá los precios en el juego.` : '✔ Búsqueda terminada sin resultados.';
      $('scan-status').className = 'status ok';
      renderRows(result.rows);
    } catch (error) {
      $('scan-status').textContent = '✖ ' + error.message;
      $('scan-status').className = 'status err';
    } finally {
      busy = false;
      button.disabled = false;
      setTimeout(() => { $('scan-progress').hidden = true; }, 900);
    }
  }

  bindTabs(root, 'scan-tabs', setStrategy);
  $('scan-run').addEventListener('click', run);
  ctx.onSharedChange?.(() => { /* los datos compartidos se leen al buscar */ });
  setStrategy('flip');
}
