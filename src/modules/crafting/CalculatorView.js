/* Vista de calculadora reutilizable por los módulos de producción. */
import { CITIES, CRAFT_CITIES, TAX, MODULES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import * as engine from '../../services/engine.js';
import { bonusFor, bestCityFor, cityLabel } from '../../services/bonus.js';
import { esc, fmt, fmt2, fmt1, ageFromDate, profitClass } from '../../services/format.js';
import { Select, NumberField, Toggle } from '../../components/common/Select.js';
import { Tabs, bindTabs } from '../../components/common/Tabs.js';
import { DataTable } from '../../components/common/DataTable.js';
import { ResultGrid, ResultCard } from '../../components/common/ResultCard.js';
import { ItemSelector, mountItemSelector } from '../../components/common/ItemSelector.js';
import { ProfitBars } from '../../components/charts/PriceBars.js';

const CITY_OPTIONS = CITIES.map(c => ({ value: c.value, label: c.label }));
const TABS = [{ id: 'calc', label: 'Calculadora' }, { id: 'cities', label: 'Comparar ciudades' }];

function configCards(cfg) {
  return `
    <section class="card">
      <div class="card-head"><h2>1 · Ítem</h2><span class="card-tag">${esc(cfg.scopeLabel || 'Catálogo completo')}</span></div>
      ${ItemSelector({ id: 'calc-item', placeholder: 'Buscar por nombre o ID del ítem…' })}
    </section>

    <section class="card">
      <div class="card-head"><h2>2 · Producción</h2></div>
      ${Select({ id: 'calc-craft-city', label: 'Dónde craftear', options: CRAFT_CITIES, value: 'Thetford', hint: 'Define el bonus de producción y el RRR' })}
      ${Toggle({ id: 'calc-sync-buy', label: 'Comprar materiales en esa ciudad', checked: true })}
      ${NumberField({ id: 'calc-runs', label: 'Crafteos (lotes)', value: 1, min: 1 })}
      ${Select({ id: 'calc-rrr-mode', label: 'Return Rate', options: [{ value: 'auto', label: 'Automático (ciudad + Focus)' }, { value: 'manual', label: 'Manual' }], value: 'auto' })}
      <div class="field-row">
        ${Select({ id: 'calc-rrr-preset', label: 'Preset', options: [{ value: '15.2', label: 'Sin bonus · 15,2 %' }, { value: '36.7', label: 'Ciudad · 36,7 %' }, { value: '43.5', label: 'Focus · 43,5 %' }, { value: '53.9', label: 'Ciudad + Focus · 53,9 %' }, { value: 'custom', label: 'Personalizado' }], value: '15.2', hidden: true })}
      </div>
      ${NumberField({ id: 'calc-rrr', label: 'RRR (%)', value: 15.2, min: 0, step: 0.1 })}
      <p class="hint" id="calc-rrr-info">Se calcula desde la ciudad elegida.</p>
      ${Toggle({ id: 'calc-focus', label: 'Usar Focus (+59 % bonus)' })}
      ${NumberField({ id: 'calc-daily-bonus', label: 'Bonus diario (%)', value: 0, min: 0 })}
      <hr>
      ${NumberField({ id: 'calc-station-fee', label: 'Tasa de estación (plata / 100 nutrición)', value: 0, hint: 'Valor que fija el dueño de la estación; se introduce a mano' })}
      ${NumberField({ id: 'calc-item-value', label: 'Valor del ítem', value: 0, hint: 'Base de la nutrición: valor × 0,1125 × crafteos' })}
      <p class="hint" id="calc-station-info">Nutrición por crafteo: 0</p>
    </section>

    <section class="card">
      <div class="card-head"><h2>3 · Mercado e impuestos</h2></div>
      ${Select({ id: 'calc-buy-city', label: 'Dónde comprar los materiales', options: CITY_OPTIONS, value: 'Martlock' })}
      ${Select({ id: 'calc-buy-mode', label: 'Modo de compra', options: [{ value: 'instant', label: 'Compra inmediata (sell_price_min)' }, { value: 'order', label: 'Orden de compra (buy_price_max)' }], value: 'instant' })}
      ${Toggle({ id: 'calc-buy-order-fee', label: 'Sumar tarifa de orden de compra (2,5 %)' })}
      <hr>
      ${Select({ id: 'calc-sell-city', label: 'Dónde vender', options: CITY_OPTIONS, value: 'Lymhurst' })}
      ${Select({ id: 'calc-sell-mode', label: 'Modo de venta', options: [{ value: 'order', label: 'Orden de venta (sell_price_min)' }, { value: 'instant', label: 'Venta directa (buy_price_max)' }], value: 'order' })}
      ${NumberField({ id: 'calc-relists', label: 'Republicaciones de la orden', value: 0, min: 0 })}
      ${NumberField({ id: 'calc-other-costs', label: 'Otros costes (transporte, etc.)', value: 0 })}
      <div class="tax-box" id="calc-tax-summary"></div>
      <button type="button" class="btn primary full" id="calc-load-prices">↻ Cargar precios del mercado</button>
      ${Toggle({ id: 'calc-overwrite', label: 'Sobrescribir precios manuales' })}
      <details class="advanced">
        <summary>Conexión / proxy CORS</summary>
        ${Select({ id: 'calc-proxy', label: 'Proxy (opcional)', options: [{ value: '', label: 'Directo a AODP' }, { value: 'custom', label: 'URL personalizada' }], value: '' })}
        <input type="text" id="calc-proxy-url" class="text-input" placeholder="https://mi-proxy.example/api/v2" hidden>
      </details>
      <p class="status" id="calc-status"></p>
    </section>

    <section class="card">
      <div class="card-head"><h2>4 · Diarios</h2></div>
      ${Toggle({ id: 'calc-journal', label: 'Usar diarios de crafteo' })}
      <div id="calc-journal-block" hidden>
        <p class="hint" id="calc-journal-name"></p>
        ${NumberField({ id: 'calc-journal-empty', label: 'Diario vacío · precio unitario', value: 0 })}
        ${NumberField({ id: 'calc-journal-full', label: 'Diario lleno · precio unitario', value: 0 })}
        <p class="hint" id="calc-journal-fame"></p>
      </div>
      <p class="hint" id="calc-journal-none" hidden>Este ítem no genera diarios.</p>
    </section>`;
}

function resultsCards() {
  return `
    <section class="card">
      <div class="card-head"><h2>Receta y precios</h2><span class="card-tag" id="calc-recipe-meta">Sin ítem</span></div>
      <div id="calc-materials"></div>
      <div class="sale-row">
        <div><strong>Precio de venta unitario</strong><small class="hint" id="calc-sale-hint">Referencia: ciudad de venta elegida.</small></div>
        <div class="sale-controls">
          <input type="number" id="calc-sale-price" value="0" min="0" step="1">
          <span class="age" id="calc-sale-age"></span>
          <button type="button" class="btn ghost" id="calc-use-sell-price">Usar precio de mercado</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Resultado</h2><span class="verdict" id="calc-verdict">—</span></div>
      ${ResultGrid([
        { id: 'calc-profit', label: 'Ganancia neta', value: '0', tone: 'hero' },
        { id: 'calc-roi', label: 'ROI', value: '0 %' },
        { id: 'calc-unit', label: 'Ganancia por ítem', value: '0' },
        { id: 'calc-breakeven', label: 'Precio de equilibrio', value: '—' },
      ])}
      <div class="breakdown" id="calc-breakdown"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Comparativa Premium</h2><span class="card-tag">Mismo escenario</span></div>
      <div class="premium-grid">
        <div class="premium-col"><span class="pill blue">Con Premium · 4 %</span><strong id="calc-premium-profit">0</strong><small>ganancia neta</small></div>
        <div class="premium-col"><span class="pill">Sin Premium · 8 %</span><strong id="calc-nopremium-profit">0</strong><small>ganancia neta</small></div>
        <div class="premium-col accent"><span class="pill gold">Diferencia</span><strong id="calc-premium-delta">0</strong><small id="calc-premium-note">a favor de Premium</small></div>
      </div>
      <p class="hint">La tarifa de orden (2,5 %) es igual con y sin Premium: cambia solo el impuesto de transacción.</p>
    </section>

    <details class="card notes">
      <summary>Cómo se calcula</summary>
      <div class="notes-body">
        <p><strong>Impuestos:</strong> 4 % con Premium / 8 % sin Premium sobre el ingreso bruto, más 2,5 % por orden de venta (y por republicación). Tarifa de orden de compra opcional.</p>
        <p><strong>Estación:</strong> <code>nutrición = valor del ítem × 0,1125 × crafteos</code>; <code>coste = tarifa × nutrición / 100</code>.</p>
        <p><strong>Materiales:</strong> devolución por material según RRR, con tope <code>maxreturnamount</code>; los artefactos no retornan.</p>
        <p><strong>Diarios:</strong> fama por crafteo → diarios vacíos <code>ceil</code> y llenos <code>floor</code>; sus precios entran en la ganancia.</p>
      </div>
    </details>`;
}

export function createCalculatorView(cfg = {}) {
  const meta = MODULES.find(m => m.id === cfg.moduleId) || MODULES[0];
  const config = {
    moduleId: 'crafting', scopeLabel: null, filter: null,
    defaultCraftCity: 'Thetford', ...cfg,
  };
  let local = null;

  function render(ctx) {
    return `
      <div class="module-view" data-module="${esc(config.moduleId)}">
        <div class="module-head">
          <div><h1>${meta.icon} ${esc(meta.label)}</h1><p>${esc(meta.description)}</p></div>
          <span class="module-badge">${esc(meta.group)}</span>
        </div>
        ${Tabs({ id: 'calc-tabs', tabs: TABS, active: 'calc' })}
        <div class="work-grid" id="calc-tab-calc">
          <div class="config-col">${configCards(config)}</div>
          <div class="results-col">${resultsCards()}</div>
        </div>
        <div class="work-grid" id="calc-tab-cities" hidden>
          <div class="config-col">
            <section class="card">
              <div class="card-head"><h2>Comparar ciudades</h2></div>
              <p class="hint">Calcula la ganancia del ítem actual en cada mercado con una sola petición de precios. Usa la configuración de la pestaña «Calculadora».</p>
              <button type="button" class="btn primary full" id="calc-compare-btn">Comparar en todas las ciudades</button>
              <p class="status" id="calc-compare-status"></p>
            </section>
          </div>
          <div class="results-col">
            <section class="card">
              <div class="card-head"><h2>Ganancia por ciudad</h2><span class="card-tag" id="calc-compare-meta">Sin datos</span></div>
              <div id="calc-compare-results"><p class="empty-note">Elegí un ítem y pulsá «Comparar en todas las ciudades».</p></div>
            </section>
          </div>
        </div>
      </div>`;
  }

  function mount(root, ctx) {
    const $ = id => root.querySelector(`#${id}`);
    const prefs = ctx.prefs;
    const shared = ctx.shared;
    local = {
      item: null, values: new Map(), rowCities: new Map(),
      selector: null, tab: 'calc',
    };
    const status = (msg, tone = '') => {
      const el = $('calc-status');
      el.textContent = msg || '';
      el.className = `status ${tone}`;
    };
    const val = key => {
      const v = local.values.get(key);
      return v ? Number(v.value) || 0 : 0;
    };
    const setVal = (key, value, date = null, manual = false, input = null, ageEl = null) => {
      local.values.set(key, { value: Number(value) || 0, date, manual });
      if (input) { input.value = Number(value) || 0; input.classList.toggle('manual', manual); }
      if (ageEl) renderAge(ageEl, date, manual);
    };
    const renderAge = (el, date, manual) => {
      if (!el) return;
      if (manual) { el.textContent = 'precio manual'; el.className = 'age none'; return; }
      const a = ageFromDate(date);
      el.textContent = a.label;
      el.className = `age ${a.tone}`;
    };

    local.selector = mountItemSelector(root, {
      id: 'calc-item', filter: config.filter, quality: shared.quality,
      onSelect: () => onItemChange(),
    });
    ctx.onDestroy?.(() => local.selector.destroy());

    /* Valores iniciales desde preferencias. */
    $('calc-craft-city').value = prefs.craftCity || 'Thetford';
    $('calc-sync-buy').checked = prefs.syncBuyCity !== false;
    $('calc-buy-city').value = $('calc-sync-buy').checked && $('calc-craft-city').value !== 'auto'
      ? $('calc-craft-city').value : (prefs.buyCity || 'Martlock');
    $('calc-sell-city').value = prefs.sellCity || 'Lymhurst';
    $('calc-buy-mode').value = prefs.buyMode || 'instant';
    $('calc-sell-mode').value = prefs.sellMode || 'order';
    $('calc-focus').checked = !!prefs.focus;
    $('calc-daily-bonus').value = prefs.dailyBonus || 0;
    $('calc-station-fee').value = prefs.stationFee || 0;
    $('calc-rrr-mode').value = prefs.rrrMode || 'auto';

    function readState() {
      const s = {
        craftCity: $('calc-craft-city').value,
        syncBuy: $('calc-sync-buy').checked,
        runs: Math.max(1, parseInt($('calc-runs').value, 10) || 1),
        rrrMode: $('calc-rrr-mode').value,
        rrrPreset: $('calc-rrr-preset').value,
        rrr: Math.min(100, Math.max(0, parseFloat($('calc-rrr').value) || 0)),
        focus: $('calc-focus').checked,
        dailyBonus: Math.max(0, parseFloat($('calc-daily-bonus').value) || 0),
        stationFee: Math.max(0, parseFloat($('calc-station-fee').value) || 0),
        itemValue: Math.max(0, parseFloat($('calc-item-value').value) || 0),
        buyCity: $('calc-buy-city').value,
        buyMode: $('calc-buy-mode').value,
        buyOrderFee: $('calc-buy-order-fee').checked,
        sellCity: $('calc-sell-city').value,
        sellMode: $('calc-sell-mode').value,
        relists: Math.max(0, parseInt($('calc-relists').value, 10) || 0),
        otherCosts: Math.max(0, parseFloat($('calc-other-costs').value) || 0),
        journal: $('calc-journal').checked,
        overwrite: $('calc-overwrite').checked,
        proxy: $('calc-proxy').value === 'custom' ? $('calc-proxy-url').value.trim() : '',
        premium: shared.premium,
        quality: Number(shared.quality),
        server: shared.server,
      };
      return s;
    }

    function resolveRRR(s) {
      const manual = s.rrrMode === 'manual';
      $('calc-rrr').readOnly = !manual;
      $('calc-rrr-preset').closest('.field').hidden = !manual;
      $('calc-rrr-preset').value = manual ? s.rrrPreset : '15.2';
      if (manual) {
        $('calc-rrr').value = s.rrr;
        $('calc-rrr-info').textContent = 'RRR manual: podés usar un preset o escribir el valor.';
        return s.rrr;
      }
      const item = local.item;
      let city = s.craftCity;
      if (city === 'auto') city = item ? bestCityFor(item.ccat, item.refine) : 'Thetford';
      const b = bonusFor({ city, ccat: item?.ccat || '', isRefining: !!item?.refine, focus: s.focus, dailyBonusPct: s.dailyBonus });
      const rrr = Math.round(b.rrrPct * 100) / 100;
      $('calc-rrr').value = rrr.toFixed(2);
      $('calc-rrr-info').textContent = `Bonus en ${cityLabel(city)}: ${b.total.toFixed(2)} → RRR ${fmt2(rrr)} % (base ${b.base.toFixed(2)} + categoría ${b.modifier.toFixed(2)} + Focus ${b.focus.toFixed(2)} + diario ${b.daily.toFixed(2)})`;
      return rrr;
    }

    function renderMaterials() {
      const item = local.item;
      const host = $('calc-materials');
      if (!item) { host.innerHTML = '<p class="empty-note">Elegí un ítem para ver su receta.</p>'; $('calc-recipe-meta').textContent = 'Sin ítem'; return; }
      $('calc-recipe-meta').textContent = `${item.id} · ${item.res.length} materiales`;
      const columns = [
        { label: 'Material', render: r => `<div class="material-cell"><img src="${esc(catalog.icon(r.id, Number(shared.quality)))}" alt=""><div><strong>${esc(r.es)}</strong><small>${esc(r.id)}</small>${r.ret === false ? '<span class="badge-no-return">no retorna</span>' : ''}</div></div>` },
        { label: 'Por crafteo', align: 'right', render: r => fmt(r.q) },
        { label: 'Bruto', align: 'right', render: r => `<span data-gross="${esc(r.id)}">0</span>` },
        { label: 'Devuelto', align: 'right', render: r => `<span data-returned="${esc(r.id)}">0</span>` },
        { label: 'Neto', align: 'right', render: r => `<span data-net="${esc(r.id)}">0</span>` },
        { label: 'Ciudad', render: r => `<select class="row-city" data-city="${esc(r.id)}"><option value="">Global</option>${CITY_OPTIONS.map(c => `<option value="${esc(c.value)}">${esc(c.label)}</option>`).join('')}</select>` },
        { label: 'Precio', align: 'right', render: r => `<div class="price-cell"><input type="number" class="row-price" data-price="${esc(r.id)}" min="0" step="1"><span class="age none" data-age="${esc(r.id)}"></span></div>` },
        { label: 'Coste neto', align: 'right', render: r => `<span data-cost="${esc(r.id)}">0</span>` },
      ];
      host.innerHTML = DataTable({ columns, rows: item.res, className: 'materials-table',
        foot: `<tr><td colspan="7"><strong>Total de materiales (neto)</strong></td><td class="num" id="calc-materials-total">0</td></tr>` });
      host.querySelectorAll('[data-price]').forEach(input => {
        const id = input.dataset.price;
        const key = `mat:${id}`;
        const stored = local.values.get(key);
        input.value = stored ? stored.value : 0;
        input.classList.toggle('manual', !!(stored && stored.manual));
        renderAge(host.querySelector(`[data-age="${id}"]`), stored?.date, !!(stored && stored.manual));
        input.addEventListener('input', () => {
          setVal(key, input.value, null, true, null, host.querySelector(`[data-age="${id}"]`));
          recompute();
        });
      });
      host.querySelectorAll('[data-city]').forEach(select => {
        select.value = local.rowCities.get(select.dataset.city) || '';
        select.addEventListener('change', () => {
          if (select.value) local.rowCities.set(select.dataset.city, select.value);
          else local.rowCities.delete(select.dataset.city);
        });
      });
      const saleKey = `sell:${item.id}`;
      const saleStored = local.values.get(saleKey);
      $('calc-sale-price').value = saleStored ? saleStored.value : 0;
      $('calc-sale-price').classList.toggle('manual', !!(saleStored && saleStored.manual));
      renderAge($('calc-sale-age'), saleStored?.date, !!(saleStored && saleStored.manual));
    }

    function renderJournal(s, result) {
      const item = local.item;
      const j = item?.journal;
      $('calc-journal-none').hidden = !!j;
      $('calc-journal').disabled = !j;
      $('calc-journal-block').hidden = !j || !s.journal;
      if (!j) return;
      $('calc-journal-name').textContent = `${j.type} · fama por crafteo ${fmt(j.fame)} · máxima ${fmt(j.max)}`;
      ['calc-journal-empty', 'calc-journal-full'].forEach((id, i) => {
        const key = `jrn:${i === 0 ? j.empty : j.full}`;
        const stored = local.values.get(key);
        $(id).value = stored ? stored.value : 0;
        $(id).classList.toggle('manual', !!(stored && stored.manual));
      });
      if (result?.journal) {
        $('calc-journal-fame').textContent = `Vacíos: ${result.journal.required} · llenos: ${result.journal.full} · parcial: ${fmt2(result.journal.partialPct)} %`;
      }
    }

    function renderTaxSummary(s) {
      const tax = s.premium ? 4 : 8;
      const order = s.sellMode === 'order';
      const total = tax + (order ? 2.5 * (1 + s.relists) : 0);
      $('calc-tax-summary').innerHTML = `
        <div><span>Impuesto de transacción (${s.premium ? 'Premium' : 'sin Premium'})</span><b>${tax} %</b></div>
        <div><span>Tarifa de orden de venta</span><b>${order ? `2,5 %${s.relists ? ` × ${1 + s.relists}` : ''}` : 'no aplica'}</b></div>
        <div><span>Deducción total</span><b>${fmt2(total)} %</b></div>
        <div><span>Tarifa de orden de compra</span><b>${s.buyMode === 'order' && s.buyOrderFee ? '2,5 %' : 'no aplica'}</b></div>`;
      $('calc-sale-hint').textContent = order
        ? `Referencia: sell_price_min de ${s.sellCity}.`
        : `Referencia: buy_price_max de ${s.sellCity}.`;
      $('calc-use-sell-price').textContent = `Usar precio de ${s.sellCity}`;
      $('calc-relists').closest('.field').hidden = !order;
    }

    function renderBreakdown(r) {
      const rows = [
        ['Unidades producidas', fmt(r.outputQty), ''],
        ['Ingreso bruto', fmt(r.grossRevenue), ''],
        ['Impuesto de venta', '−' + fmt(r.salesTax), 'negative'],
        ['Tarifa de orden de venta', '−' + fmt(r.setupFee), 'negative'],
        ['Ingreso por diarios llenos', '+' + fmt(r.journalRevenue), 'positive'],
        ['Materiales brutos', fmt(r.grossMaterials), ''],
        ['Devolución por RRR', '+' + fmt(r.returnedValue), 'positive'],
        ['Materiales netos', fmt(r.netMaterials), ''],
        ['Tarifa de orden de compra', '−' + fmt(r.buyOrderFee), 'negative'],
        ['Tasa de estación', '−' + fmt(r.stationFee), 'negative'],
        ['Diarios vacíos', '−' + fmt(r.journalCost), 'negative'],
        ['Otros costes', '−' + fmt(r.otherCosts), 'negative'],
        ['Coste total', fmt(r.totalCosts), 'total'],
      ];
      $('calc-breakdown').innerHTML = `<div class="breakdown-table">${rows.map(([label, value, tone]) =>
        `<div class="line ${tone}"><span>${esc(label)}</span><b>${value}</b></div>`).join('')}</div>`;
    }

    function renderResults(r, s) {
      $('calc-profit').textContent = fmt(r.profit);
      $('calc-profit').closest('.result-card').classList.toggle('negative', r.profit < 0);
      $('calc-roi').textContent = fmt2(r.roi) + ' %';
      $('calc-unit').textContent = fmt(r.profitPerItem);
      $('calc-breakeven').textContent = r.breakEven == null ? '—' : fmt(r.breakEven);
      const verdict = $('calc-verdict');
      verdict.textContent = r.profit > 0 ? 'Rentable' : r.profit < 0 ? 'Pérdida' : 'Punto muerto';
      verdict.className = 'verdict ' + (r.profit > 0 ? 'good' : r.profit < 0 ? 'bad' : 'even');
      $('calc-premium-profit').textContent = fmt(r.premiumComparison.withPremium);
      $('calc-nopremium-profit').textContent = fmt(r.premiumComparison.withoutPremium);
      $('calc-premium-delta').textContent = fmt(r.premiumComparison.delta);
      $('calc-premium-note').textContent = r.premiumComparison.delta >= 0
        ? `a favor de Premium (ahorro ${fmt(r.premiumComparison.taxSaved)} p)` : 'sin diferencia';
      $('calc-station-info').textContent = `Nutrición por crafteo: ${fmt2(r.nutritionPerRun)} · total: ${fmt2(r.nutritionTotal)} · coste: ${fmt(r.stationFee)} p`;
      renderBreakdown(r);
      renderTaxSummary(s);
      renderJournal(s, r);
      const host = $('calc-materials');
      if (local.item) {
        r.resources.forEach(res => {
          const set = (attr, value) => {
            const el = host.querySelector(`[data-${attr}="${res.id}"]`);
            if (el) el.textContent = value;
          };
          set('gross', fmt(res.grossQty));
          set('returned', '−' + fmt(res.expected));
          set('net', fmt(res.netQty));
          set('cost', fmt(res.netCost));
        });
        const total = $('calc-materials-total');
        if (total) total.textContent = fmt(r.netMaterials);
      }
    }

    function recompute() {
      const s = readState();
      const rrr = resolveRRR(s);
      if (!local.item) {
        $('calc-profit').textContent = '0';
        renderTaxSummary(s);
        return;
      }
      const resources = local.item.res.map(r => ({
        id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: val(`mat:${r.id}`),
      }));
      const j = local.item.journal;
      const result = engine.calculate({
        item: local.item, runs: s.runs, rrrPct: rrr, itemValue: s.itemValue,
        station: { mode: 'nutrition', feePer100: s.stationFee },
        resources, buyMode: s.buyMode, buyOrderFee: s.buyOrderFee,
        sellMode: s.sellMode, sellPrice: val(`sell:${local.item.id}`), relists: s.relists,
        otherCosts: s.otherCosts,
        journal: s.journal && j ? { enabled: true, fame: j.fame, max: j.max,
          emptyPrice: val(`jrn:${j.empty}`), fullPrice: val(`jrn:${j.full}`) } : null,
        premium: s.premium,
      });
      renderResults(result, s);
    }

    function onItemChange() {
      local.item = local.selector.getItem();
      if (local.item) $('calc-item-value').value = local.item.value;
      renderMaterials();
      recompute();
      ctx.setPref?.('lastItem', local.item?.id || '');
    }

    function targets(s) {
      if (!local.item) return [];
      const out = local.item.res.map(r => ({
        key: `mat:${r.id}`, id: r.id,
        city: local.rowCities.get(r.id) || s.buyCity,
        mode: s.buyMode === 'instant' ? 'sell' : 'buy',
        input: $('calc-materials')?.querySelector(`[data-price="${r.id}"]`),
        ageEl: $('calc-materials')?.querySelector(`[data-age="${r.id}"]`),
      }));
      out.push({
        key: `sell:${local.item.id}`, id: local.item.id, city: s.sellCity,
        mode: s.sellMode === 'instant' ? 'buy' : 'sell',
        input: $('calc-sale-price'), ageEl: $('calc-sale-age'),
      });
      const j = local.item.journal;
      if (s.journal && j) {
        out.push({ key: `jrn:${j.empty}`, id: j.empty, city: s.buyCity, mode: 'sell', input: $('calc-journal-empty') });
        out.push({ key: `jrn:${j.full}`, id: j.full, city: s.sellCity,
          mode: s.sellMode === 'instant' ? 'buy' : 'sell', input: $('calc-journal-full') });
      }
      return out;
    }

    async function loadPrices(list = null, button = null) {
      const s = readState();
      const items = list || targets(s);
      if (!items.length) { status('Elegí primero un ítem.', 'err'); return; }
      if (button) button.disabled = true;
      status('Consultando precios…');
      try {
        const rows = await api.fetchPrices({
          server: s.server, quality: s.quality,
          ids: items.map(t => t.id), cities: items.map(t => t.city), proxy: s.proxy,
        });
        const map = api.indexRows(rows);
        let applied = 0, skipped = 0;
        items.forEach(t => {
          const stored = local.values.get(t.key);
          if (!s.overwrite && stored?.manual) { skipped++; return; }
          const quote = api.priceFor(api.pick(map, t.id, t.city, s.quality), t.mode);
          if (!quote) return;
          setVal(t.key, quote.price, quote.date, false, t.input, t.ageEl);
          applied++;
        });
        status(`✔ ${applied} precios actualizados${skipped ? ` · ${skipped} manuales respetados` : ''}.`, 'ok');
      } catch (error) {
        status('✖ ' + error.message, 'err');
      } finally {
        if (button) button.disabled = false;
        recompute();
      }
    }

    async function compareCities() {
      const s = readState();
      if (!local.item) { $('calc-compare-status').textContent = 'Elegí un ítem primero.'; return; }
      const ids = [local.item.id, ...local.item.res.map(r => r.id)];
      const cities = CITIES.map(c => c.value);
      $('calc-compare-status').textContent = 'Consultando todas las ciudades…';
      const btn = $('calc-compare-btn'); btn.disabled = true;
      try {
        const rows = await api.fetchPrices({ server: s.server, quality: s.quality, ids, cities, proxy: s.proxy });
        const map = api.indexRows(rows);
        const rrr = resolveRRR(s);
        const buyModePrice = s.buyMode === 'instant' ? 'sell' : 'buy';
        const results = [];
        cities.forEach(city => {
          const sale = api.priceFor(api.pick(map, local.item.id, city, s.quality), s.sellMode === 'instant' ? 'buy' : 'sell');
          if (!sale) return;
          let materialsOk = true;
          const resources = local.item.res.map(r => {
            let quote = api.priceFor(api.pick(map, r.id, local.rowCities.get(r.id) || s.buyCity, s.quality), buyModePrice);
            if (!quote) {
              quote = api.bestPrice(map, r.id, cities.slice(0, 7), s.quality, buyModePrice);
            }
            if (!quote) materialsOk = false;
            return { id: r.id, es: r.es, q: r.q, ret: r.ret, max: r.max, price: quote?.price || 0 };
          });
          if (!materialsOk) return;
          const r = engine.calculate({
            item: local.item, runs: s.runs, rrrPct: rrr, itemValue: s.itemValue,
            station: { mode: 'nutrition', feePer100: s.stationFee }, resources,
            buyMode: s.buyMode, buyOrderFee: s.buyOrderFee, sellMode: s.sellMode,
            sellPrice: sale.price, relists: s.relists, otherCosts: s.otherCosts,
            journal: null, premium: s.premium,
          });
          results.push({ city, price: sale.price, profit: r.profit / r.outputQty, roi: r.roi, age: ageFromDate(sale.date).label });
        });
        results.sort((a, b) => b.profit - a.profit);
        $('calc-compare-meta').textContent = `${results.length} ciudades · ${local.item.id}`;
        $('calc-compare-results').innerHTML = results.length
          ? DataTable({ columns: [
              { label: 'Ciudad', render: r => `<strong>${esc(r.city)}</strong>` },
              { label: 'Precio', align: 'right', render: r => fmt(r.price) },
              { label: 'Ganancia / u', align: 'right', render: r => `<span class="${profitClass(r.profit)}">${fmt(r.profit)}</span>` },
              { label: 'ROI', align: 'right', render: r => fmt2(r.roi) + ' %' },
              { label: 'Edad', align: 'right', render: r => esc(r.age) },
            ], rows: results }) + ProfitBars(results)
          : '<p class="empty-note">No hay precios suficientes en esas ciudades.</p>';
        $('calc-compare-status').textContent = '✔ Listo.';
      } catch (error) {
        $('calc-compare-status').textContent = '✖ ' + error.message;
      } finally { btn.disabled = false; }
    }

    /* Eventos */
    const controlIds = ['calc-craft-city', 'calc-sync-buy', 'calc-runs', 'calc-rrr-mode', 'calc-rrr-preset',
      'calc-rrr', 'calc-focus', 'calc-daily-bonus', 'calc-station-fee', 'calc-item-value',
      'calc-buy-city', 'calc-buy-mode', 'calc-buy-order-fee', 'calc-sell-city', 'calc-sell-mode',
      'calc-relists', 'calc-other-costs', 'calc-journal', 'calc-overwrite', 'calc-proxy', 'calc-proxy-url'];
    controlIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      const handler = event => {
        const target = event.target.id;
        if (target === 'calc-rrr-preset' && $('calc-rrr-mode').value === 'manual') {
          const value = el.value;
          if (value !== 'custom') $('calc-rrr').value = value;
        } else if (target === 'calc-rrr' && $('calc-rrr-mode').value === 'manual') {
          $('calc-rrr-preset').value = 'custom';
        }
        if (target === 'calc-proxy') $('calc-proxy-url').hidden = el.value !== 'custom';
        if ((target === 'calc-craft-city' || target === 'calc-sync-buy') && $('calc-sync-buy').checked &&
            $('calc-craft-city').value !== 'auto') {
          $('calc-buy-city').value = $('calc-craft-city').value;
        }
        if (target === 'calc-craft-city' || target === 'calc-focus' || target === 'calc-daily-bonus' ||
            target === 'calc-buy-city' || target === 'calc-sell-city') {
          ctx.setPref?.({
            craftCity: $('calc-craft-city').value, syncBuyCity: $('calc-sync-buy').checked,
            focus: $('calc-focus').checked, dailyBonus: Number($('calc-daily-bonus').value) || 0,
            buyCity: $('calc-buy-city').value, sellCity: $('calc-sell-city').value,
          });
        }
        recompute();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    $('calc-sale-price').addEventListener('input', event => {
      if (!local.item) return;
      setVal(`sell:${local.item.id}`, event.target.value, null, true, null, $('calc-sale-age'));
      recompute();
    });
    ['calc-journal-empty', 'calc-journal-full'].forEach(id => {
      $(id).addEventListener('input', event => {
        const j = local.item?.journal;
        if (!j) return;
        const key = `jrn:${id === 'calc-journal-empty' ? j.empty : j.full}`;
        setVal(key, event.target.value, null, true);
        recompute();
      });
    });
    $('calc-load-prices').addEventListener('click', event => loadPrices(null, event.currentTarget));
    $('calc-use-sell-price').addEventListener('click', () => {
      const s = readState();
      const target = targets(s).filter(t => t.key === `sell:${local.item?.id}`);
      loadPrices(target);
    });
    $('calc-compare-btn').addEventListener('click', compareCities);

    bindTabs(root, 'calc-tabs', tab => {
      local.tab = tab;
      $('calc-tab-calc').hidden = tab !== 'calc';
      $('calc-tab-cities').hidden = tab !== 'cities';
    });

    ctx.onSharedChange?.(s => {
      local.selector.setQuality(Number(s.quality));
      recompute();
    });

    /* Abrir una oportunidad del escáner. */
    const hadOpportunity = !!ctx.opportunity;
    if (ctx.opportunity) {
      const row = ctx.opportunity;
      const entry = catalog.get(row.id);
      if (entry) {
        local.selector.setItem(entry);
        local.item = entry;
        $('calc-item-value').value = entry.value;
        if (row.craftCity && root.querySelector(`#calc-craft-city option[value="${row.craftCity}"]`)) {
          $('calc-craft-city').value = row.craftCity;
        }
        $('calc-sync-buy').checked = false;
        const buyCity = row.materialPrices?.[0]?.city || row.buyCity;
        if (buyCity && root.querySelector(`#calc-buy-city option[value="${buyCity}"]`)) {
          $('calc-buy-city').value = buyCity;
        }
        if (root.querySelector(`#calc-sell-city option[value="${row.sellCity}"]`)) {
          $('calc-sell-city').value = row.sellCity;
        }
        $('calc-buy-mode').value = row.buyMode || 'instant';
        $('calc-sell-mode').value = row.sellMode || 'order';
        $('calc-focus').checked = !!row.focus;
        $('calc-daily-bonus').value = row.dailyBonus || 0;
        $('calc-station-fee').value = row.stationFeePer100 || 0;
        $('calc-rrr-mode').value = 'manual';
        $('calc-rrr').value = row.rrr;
        setVal(`sell:${entry.id}`, row.sellPrice, row.sellDate, false);
        (row.materialPrices || []).forEach(p => setVal(`mat:${p.id}`, p.price, p.date, false));
        renderMaterials();
        status('Oportunidad cargada desde Flipping: ajustá diarios, transporte y precios.', 'ok');
      }
    }

    renderMaterials();
    recompute();
    if (!hadOpportunity && ctx.prefs.lastItem) {
      const entry = catalog.get(ctx.prefs.lastItem);
      if (entry && (!config.filter || config.filter(entry))) local.selector.setItem(entry), local.item = entry, $('calc-item-value').value = entry.value, renderMaterials(), recompute();
    }
  }

  return { meta, render, mount };
}
