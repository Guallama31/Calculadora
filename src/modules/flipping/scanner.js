/* Escáner de oportunidades: cruza ítems × ciudades × estrategias con AODP. */
import { SAFE_CITIES, ROYAL_CITIES, BLACK_MARKET, CITIES, CATEGORIES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import * as engine from '../../services/engine.js';
import { bonusFor, bestCityFor, cityLabel } from '../../services/bonus.js';

const MAX_RESULTS = 30;
const uniq = list => [...new Set(list.filter(Boolean))];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const STRATEGIES = [
  { id: 'flip', label: 'Flip', description: 'Comprar barato en una ciudad real y vender caro en otra.' },
  {
    id: 'royalbm',
    label: 'Royal → BM',
    description: 'Comprar en una ciudad real y vender al Mercado Negro.',
  },
  {
    id: 'upgrade',
    label: 'Mejora',
    description: 'Comprar un ítem y los materiales para mejorar su encantamiento, y vender el resultado.',
  },
  { id: 'craft', label: 'Craft Trades', description: 'Craftear con bonus en una ciudad y vender en otra.' },
  {
    id: 'refine',
    label: 'Refining Trades',
    description: 'Refinar con bonus de ciudad y vender el resultado.',
  },
];

function selectCandidates(options) {
  const tiers = options.tiers?.length ? options.tiers : [2, 3, 4, 5, 6, 7, 8];
  const enchants = options.enchants?.length ? options.enchants : [0, 1, 2, 3, 4];
  const category = options.category || '';
  let entries = catalog.entries.filter(entry => {
    if (!tiers.includes(entry.tier) || !enchants.includes(entry.lvl)) return false;
    if (category && entry.categoryId !== category) return false;
    if (options.strategy === 'refine') return entry.refine === true;
    if (options.strategy === 'craft') return entry.refine === false && entry.res.length > 0;
    if (options.strategy === 'upgrade') return !!entry.upgrade && entry.lvl > 0;
    return true;
  });
  if (options.query) {
    const ids = new Set(catalog.search(options.query, catalog.total).map(e => e.id));
    entries = entries.filter(e => ids.has(e.id));
  }
  entries.sort(
    (a, b) => b.tier - a.tier || a.id.length - b.id.length || a.lvl - b.lvl || a.id.localeCompare(b.id),
  );
  const max = Math.max(5, Math.min(250, Number(options.maxItems) || 60));
  if (options.globalScan) {
    const groups = new Map();
    entries.forEach(entry => {
      const key = `${entry.tier}|${entry.categoryId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    const categories = [...new Set(entries.map(entry => entry.categoryId))];
    const categoryOrder = [
      ...CATEGORIES.map(item => item.value).filter(value => value && categories.includes(value)),
      ...categories.filter(value => !CATEGORIES.some(item => item.value === value)),
    ];
    const tierOrder = [...new Set(entries.map(entry => entry.tier))].sort((a, b) => a - b);
    const selected = [];
    while (selected.length < max) {
      let added = false;
      tierOrder.forEach(tier =>
        categoryOrder.forEach(category => {
          const group = groups.get(`${tier}|${category}`);
          if (group?.length && selected.length < max) {
            selected.push(group.shift());
            added = true;
          }
        }),
      );
      if (!added) break;
    }
    return selected;
  }
  return entries.slice(0, max);
}

function neededIds(candidates, strategy) {
  const ids = candidates.map(e => e.id);
  if (strategy === 'craft' || strategy === 'refine') {
    candidates.forEach(e => e.res.forEach(r => ids.push(r.id)));
  }
  if (strategy === 'upgrade') {
    candidates.forEach(entry => {
      ids.push(entry.lvl === 1 ? entry.base : `${entry.base}@${entry.lvl - 1}`);
      ids.push(entry.upgrade.id);
    });
  }
  return uniq(ids);
}

function sourceCities(options) {
  let cities = options.buyCity === 'auto' ? ROYAL_CITIES.slice() : [options.buyCity];
  if (options.safeOnly) {
    const safe = cities.filter(c => SAFE_CITIES.includes(c));
    cities = safe.length ? safe : SAFE_CITIES.slice();
  }
  return uniq(cities);
}

function sellCities(options) {
  if (options.strategy === 'royalbm') return [BLACK_MARKET];
  if (options.globalScan) return CITIES.map(city => city.value);
  let cities = (options.sellCities || []).slice();
  if (options.includeBM && !cities.includes(BLACK_MARKET)) cities.push(BLACK_MARKET);
  if (!cities.length) cities = ROYAL_CITIES.slice();
  if (options.safeOnly) {
    const safe = cities.filter(c => SAFE_CITIES.includes(c));
    cities = safe.length ? safe : SAFE_CITIES.slice();
  }
  return uniq(cities);
}

export function allCities(options) {
  return uniq(sourceCities(options).concat(sellCities(options)));
}

async function fetchAll(options, ids, cities, { onProgress, quality = options.quality, signal } = {}) {
  const chunks = api.chunkPriceIds({
    server: options.server,
    ids,
    cities,
    quality,
  });
  const rows = [];
  let requests = 0;
  let deduplicated = 0;
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({ done: i, total: chunks.length, message: `Lote ${i + 1} de ${chunks.length}` });
    const batch = await api.fetchPrices({
      server: options.server,
      ids: chunks[i],
      cities,
      quality,
      signal,
      onRequest: request => {
        if (request.initiated) requests += 1;
        if (request.deduplicated) deduplicated += 1;
      },
    });
    rows.push(...batch);
    if (i < chunks.length - 1) await delay(120);
  }
  onProgress?.({ done: chunks.length, total: chunks.length, message: 'Datos recibidos' });
  const map = api.indexRows(rows);
  return {
    map,
    rows: rows.length,
    requests,
    deduplicated,
    batches: chunks.length,
    cacheNotice: api.cacheNotice(rows),
    coverage: api.quoteCoverage(map, ids, cities, quality),
  };
}

function bestPurchasePrice(map, id, cities, quality, mode) {
  let best = null;
  for (const city of cities) {
    const quote = api.priceAt(map, id, city, quality, mode);
    if (quote && (!best || (mode === 'buy' ? quote.price > best.price : quote.price < best.price))) {
      best = { ...quote, city };
    }
  }
  return best;
}

function ageMinutes(date) {
  if (!date) return Infinity;
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 60000);
}
function maxAge(dates) {
  let worst = 0;
  dates.forEach(date => {
    if (!date) worst = Infinity;
    else worst = Math.max(worst, ageMinutes(date));
  });
  return worst;
}

function evaluate(options, candidates, map, meta) {
  const quality = options.quality || 1;
  const sources = sourceCities(options);
  const destinations = sellCities(options);
  const buyMode = options.buyMode || 'instant';
  const sellMode = options.strategy === 'royalbm' ? 'instant' : options.sellMode || 'order';
  const buyPriceMode = buyMode === 'instant' ? 'sell' : 'buy';
  const rows = [];

  candidates.forEach(entry => {
    const craftCity =
      options.craftCity === 'auto' ? bestCityFor(entry.ccat, entry.refine) : options.craftCity || 'Thetford';
    const rrr =
      options.rrrMode === 'manual'
        ? Math.max(0, Number(options.manualRRR) || 0)
        : bonusFor({
            city: craftCity,
            ccat: entry.ccat,
            isRefining: !!entry.refine,
            focus: !!options.focus,
            dailyBonusPct: options.dailyBonus || 0,
          }).rrrPct;
    const isCraft = options.strategy === 'craft' || options.strategy === 'refine';
    const isUpgrade = options.strategy === 'upgrade';
    const materialPrices = [];
    let buyQuote = null;
    let complete = true;
    if (isCraft) {
      entry.res.forEach(resource => {
        const quote =
          options.buyCity === 'auto'
            ? bestPurchasePrice(map, resource.id, sources, quality, buyPriceMode)
            : api.priceAt(map, resource.id, options.buyCity, quality, buyPriceMode);
        if (!quote) {
          complete = false;
          return;
        }
        materialPrices.push({
          id: resource.id,
          city: quote.city || options.buyCity,
          price: quote.price,
          date: quote.date,
        });
      });
    } else if (isUpgrade) {
      const previousId = entry.lvl === 1 ? entry.base : `${entry.base}@${entry.lvl - 1}`;
      const previous = catalog.get(previousId);
      const baseQuote =
        options.buyCity === 'auto'
          ? bestPurchasePrice(map, previousId, sources, quality, buyPriceMode)
          : api.priceAt(map, previousId, options.buyCity, quality, buyPriceMode);
      const resourceQuote =
        options.buyCity === 'auto'
          ? bestPurchasePrice(map, entry.upgrade.id, sources, 1, buyPriceMode)
          : api.priceAt(map, entry.upgrade.id, options.buyCity, 1, buyPriceMode);
      if (!previous || !baseQuote || !resourceQuote) {
        complete = false;
      } else {
        buyQuote = baseQuote;
        materialPrices.push(
          {
            id: previous.id,
            es: previous.es,
            q: 1,
            price: baseQuote.price,
            date: baseQuote.date,
            city: baseQuote.city,
          },
          {
            ...entry.upgrade,
            price: resourceQuote.price,
            date: resourceQuote.date,
            city: resourceQuote.city,
          },
        );
      }
    } else {
      buyQuote =
        options.buyCity === 'auto'
          ? bestPurchasePrice(map, entry.id, sources, quality, buyPriceMode)
          : api.priceAt(map, entry.id, options.buyCity, quality, buyPriceMode);
      if (!buyQuote) complete = false;
    }
    if (!complete) return;

    destinations.forEach(sellCity => {
      const citySellMode = sellCity === BLACK_MARKET ? 'order' : sellMode;
      const sellPriceMode = citySellMode === 'instant' ? 'buy' : 'sell';
      const sale = api.priceAt(map, entry.id, sellCity, quality, sellPriceMode);
      if (!sale) return;
      const buyCityLabel = isCraft
        ? options.buyCity === 'auto'
          ? 'Varias'
          : options.buyCity
        : buyQuote.city || options.buyCity;
      if (!options.sameCity && buyCityLabel !== 'Varias' && buyCityLabel === sellCity) return;
      const dates = [sale.date, ...materialPrices.map(p => p.date)];
      if (!isCraft && buyQuote) dates.push(buyQuote.date);
      const age = maxAge(dates);

      let result, costPerUnit, revenuePerUnit, profit, roi, margin;
      if (isCraft) {
        const resources = entry.res.map((resource, index) => ({
          id: resource.id,
          es: resource.es,
          q: resource.q,
          ret: resource.ret,
          max: resource.max,
          price: materialPrices[index]?.price || 0,
        }));
        result = engine.calculate({
          item: entry,
          runs: 1,
          rrrPct: rrr,
          itemValue: entry.value,
          station: { mode: 'nutrition', feePer100: options.stationFee || 0 },
          resources,
          buyMode,
          buyOrderFee: !!options.buyOrderFee,
          sellMode: citySellMode,
          sellPrice: sale.price,
          relists: 0,
          otherCosts: 0,
          journal: null,
          premium: !!options.premium,
        });
        revenuePerUnit = result.grossRevenue / result.outputQty;
        costPerUnit = result.totalCosts / result.outputQty;
        profit = result.profit / result.outputQty;
        roi = result.roi;
        margin = result.grossRevenue > 0 ? (result.profit / result.grossRevenue) * 100 : 0;
      } else if (isUpgrade) {
        const totalBuyPrice = materialPrices.reduce((sum, resource) => sum + resource.q * resource.price, 0);
        result = engine.calculateFlip({
          qty: 1,
          buyPrice: totalBuyPrice,
          sellPrice: sale.price,
          buyMode,
          sellMode: citySellMode,
          relists: 0,
          transport: 0,
          premium: !!options.premium,
        });
        revenuePerUnit = result.grossRevenue;
        costPerUnit = result.totalCosts;
        profit = result.profit;
        roi = result.roi;
        margin = result.margin;
      } else {
        result = engine.calculateFlip({
          qty: 1,
          buyPrice: buyQuote.price,
          sellPrice: sale.price,
          buyMode,
          sellMode: citySellMode,
          relists: 0,
          transport: 0,
          premium: !!options.premium,
        });
        revenuePerUnit = result.grossRevenue;
        costPerUnit = result.totalCosts;
        profit = result.profit;
        roi = result.roi;
        margin = result.margin;
      }
      /* Las columnas de coste, venta y ganancia son por unidad; los impuestos
         también se normalizan por unidad para que la fila sea homogénea. */
      const units = isCraft ? Math.max(1, result.outputQty) : 1;
      const perUnit = value => (Number(value) || 0) / units;
      rows.push({
        id: entry.id,
        item: entry,
        strategy: options.strategy,
        craftCity,
        buyCity: buyCityLabel,
        sellCity,
        buyPrice: isCraft ? null : isUpgrade ? materialPrices[0].price : buyQuote.price,
        sellPrice: sale.price,
        costPerUnit,
        revenuePerUnit,
        salesTax: perUnit(result.salesTax),
        setupFee: perUnit(result.setupFee),
        stationFee: perUnit(result.stationFee || 0),
        buyOrderFee: perUnit(result.buyOrderFee || 0),
        profit,
        roi,
        margin,
        rrr,
        age,
        buyDate: isCraft ? null : buyQuote.date || null,
        sellDate: sale.date || null,
        materialPrices,
        quality,
        buyMode,
        sellMode: citySellMode,
        focus: !!options.focus,
        dailyBonus: options.dailyBonus || 0,
        stationFeePer100: options.stationFee || 0,
        rrrMode: options.rrrMode || 'auto',
        premium: !!options.premium,
        meta,
      });
    });
  });

  rows.sort((a, b) => b.profit - a.profit);
  return rows.slice(0, MAX_RESULTS);
}

export async function scan(options, onProgress, signal = null) {
  if (!catalog.total) throw new Error('El catálogo no está cargado.');
  const candidates = selectCandidates(options);
  if (!candidates.length) {
    return {
      rows: [],
      candidates: 0,
      requests: 0,
      deduplicated: 0,
      prices: 0,
      cacheNotice: '',
      coverage: { requested: 0, quoted: 0, missing: 0, percent: null },
    };
  }
  const ids = neededIds(candidates, options.strategy);
  const cities = allCities(options);
  onProgress?.({
    done: 0,
    total: null,
    message: `Consultando ${ids.length} IDs en ${cities.length} ciudades…`,
  });
  let fetched = await fetchAll(options, ids, cities, { onProgress, signal });
  if (options.strategy === 'upgrade' && Number(options.quality || 1) !== 1) {
    const resourceIds = uniq(candidates.map(entry => entry.upgrade.id));
    const resources = await fetchAll(options, resourceIds, cities, { onProgress, signal, quality: 1 });
    fetched = {
      map: new Map([...fetched.map, ...resources.map]),
      rows: fetched.rows + resources.rows,
      requests: fetched.requests + resources.requests,
      deduplicated: fetched.deduplicated + resources.deduplicated,
      batches: fetched.batches + resources.batches,
      cacheNotice: [fetched.cacheNotice, resources.cacheNotice].filter(Boolean).join(' '),
      coverage: {
        requested: fetched.coverage.requested + resources.coverage.requested,
        quoted: fetched.coverage.quoted + resources.coverage.quoted,
        missing: fetched.coverage.missing + resources.coverage.missing,
      },
    };
    fetched.coverage.percent = fetched.coverage.requested
      ? (fetched.coverage.quoted / fetched.coverage.requested) * 100
      : null;
  }
  const meta = {
    candidates: candidates.length,
    requests: fetched.requests,
    deduplicated: fetched.deduplicated,
    batches: fetched.batches,
    prices: fetched.rows,
    ids: ids.length,
    cities: cities.length,
    coverage: fetched.coverage,
    cacheNotice: fetched.cacheNotice,
  };
  const rows = evaluate(options, candidates, fetched.map, meta);
  return {
    rows,
    candidates: candidates.length,
    requests: fetched.requests,
    deduplicated: fetched.deduplicated,
    batches: fetched.batches,
    prices: fetched.rows,
    coverage: fetched.coverage,
    cacheNotice: fetched.cacheNotice,
  };
}

export function describe(row) {
  const parts = [row.item.es];
  if (row.strategy === 'craft' || row.strategy === 'refine') {
    parts.push(`craftear en ${cityLabel(row.craftCity)}`, `comprar en ${cityLabel(row.buyCity)}`);
  } else if (row.strategy === 'upgrade') {
    parts.push(`mejorar a .${row.item.lvl}`, `comprar en ${cityLabel(row.buyCity)}`);
  } else parts.push(`comprar en ${cityLabel(row.buyCity)}`);
  parts.push(`vender en ${cityLabel(row.sellCity)}`);
  return parts.join(' · ');
}

/* Exportados también para pruebas unitarias. */
export { selectCandidates, neededIds, sourceCities, sellCities, evaluate };
