/* Escáner de oportunidades: cruza ítems × ciudades × estrategias con AODP. */
import { SAFE_CITIES, ROYAL_CITIES, BLACK_MARKET, CITIES } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import * as engine from '../../services/engine.js';
import { bonusFor, bestCityFor, cityLabel } from '../../services/bonus.js';

const CHUNK_SIZE = 30;
const MAX_URL = 3500;
const uniq = list => [...new Set(list.filter(Boolean))];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const STRATEGIES = [
  { id: 'flip', label: 'Flip', description: 'Comprar barato en una ciudad real y vender caro en otra.' },
  { id: 'royalbm', label: 'Royal → BM', description: 'Comprar en una ciudad real y vender al Mercado Negro.' },
  { id: 'craft', label: 'Craft Trades', description: 'Craftear con bonus en una ciudad y vender en otra.' },
  { id: 'refine', label: 'Refining Trades', description: 'Refinar con bonus de ciudad y vender el resultado.' },
];

function selectCandidates(options) {
  const tiers = options.tiers?.length ? options.tiers : [4, 5, 6, 7, 8];
  const enchants = options.enchants?.length ? options.enchants : [0];
  const category = options.category || '';
  let entries = catalog.entries.filter(entry => {
    if (!tiers.includes(entry.tier) || !enchants.includes(entry.lvl)) return false;
    if (category && entry.cat !== category) return false;
    if (options.strategy === 'refine') return entry.refine === true;
    if (options.strategy === 'craft') return entry.refine === false && entry.res.length > 0;
    return true;
  });
  if (options.query) {
    const ids = new Set(catalog.search(options.query, 300).map(e => e.id));
    entries = entries.filter(e => ids.has(e.id));
  }
  entries.sort((a, b) => b.tier - a.tier || a.id.length - b.id.length || a.lvl - b.lvl || a.id.localeCompare(b.id));
  const max = Math.max(5, Math.min(250, Number(options.maxItems) || 60));
  return entries.slice(0, max);
}

function neededIds(candidates, strategy) {
  const ids = candidates.map(e => e.id);
  if (strategy === 'craft' || strategy === 'refine') {
    candidates.forEach(e => e.res.forEach(r => ids.push(r.id)));
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

function chunkIds(ids, cities, server) {
  const chunks = [];
  let current = [];
  const prefix = (api.SERVER_LABELS[server] || '').length + cities.join(',').length + 160;
  ids.forEach(id => {
    const projected = prefix + (current.length + 1) * (id.length + 1);
    if ((current.length >= CHUNK_SIZE || projected > MAX_URL) && current.length) {
      chunks.push(current); current = [];
    }
    current.push(id);
  });
  if (current.length) chunks.push(current);
  return chunks;
}

async function fetchAll(options, ids, cities, onProgress) {
  const chunks = chunkIds(ids, cities, options.server);
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({ done: i, total: chunks.length, message: `Lote ${i + 1} de ${chunks.length}` });
    const batch = await api.fetchPrices({
      server: options.server, ids: chunks[i], cities, quality: options.quality, proxy: options.proxy,
    });
    rows.push(...batch);
    if (i < chunks.length - 1) await delay(120);
  }
  onProgress?.({ done: chunks.length, total: chunks.length, message: 'Datos recibidos' });
  return { map: api.indexRows(rows), rows: rows.length, requests: chunks.length };
}

function ageMinutes(date) {
  if (!date) return Infinity;
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 60000);
}
function maxAge(dates) {
  let worst = 0;
  dates.forEach(date => { if (!date) worst = Infinity; else worst = Math.max(worst, ageMinutes(date)); });
  return worst;
}

function evaluate(options, candidates, map, meta) {
  const quality = options.quality || 1;
  const sources = sourceCities(options);
  const destinations = sellCities(options);
  const buyMode = options.buyMode || 'instant';
  const sellMode = options.strategy === 'royalbm' ? 'instant' : (options.sellMode || 'order');
  const buyPriceMode = buyMode === 'instant' ? 'sell' : 'buy';
  const sellPriceMode = sellMode === 'instant' ? 'buy' : 'sell';
  const minProfit = Math.max(0, Number(options.minProfit) || 0);
  const minRoi = Number(options.minRoi) || 0;
  const maxAgeHours = Math.max(0, Number(options.maxAgeHours) || 0);
  const rows = [];

  candidates.forEach(entry => {
    const craftCity = options.craftCity === 'auto' ? bestCityFor(entry.ccat, entry.refine) : (options.craftCity || 'Thetford');
    const rrr = options.rrrMode === 'manual'
      ? Math.max(0, Number(options.manualRRR) || 0)
      : bonusFor({ city: craftCity, ccat: entry.ccat, isRefining: !!entry.refine,
          focus: !!options.focus, dailyBonusPct: options.dailyBonus || 0 }).rrrPct;
    const isCraft = options.strategy === 'craft' || options.strategy === 'refine';
    const materialPrices = [];
    let buyQuote = null;
    let complete = true;
    if (isCraft) {
      entry.res.forEach(resource => {
        const quote = options.buyCity === 'auto'
          ? api.bestPrice(map, resource.id, sources, quality, buyPriceMode)
          : api.priceAt(map, resource.id, options.buyCity, quality, buyPriceMode);
        if (!quote) { complete = false; return; }
        materialPrices.push({ id: resource.id, city: quote.city || options.buyCity, price: quote.price, date: quote.date });
      });
    } else {
      buyQuote = options.buyCity === 'auto'
        ? api.bestPrice(map, entry.id, sources, quality, buyPriceMode)
        : api.priceAt(map, entry.id, options.buyCity, quality, buyPriceMode);
      if (!buyQuote) complete = false;
    }
    if (!complete) return;

    destinations.forEach(sellCity => {
      const sale = api.priceAt(map, entry.id, sellCity, quality, sellPriceMode);
      if (!sale) return;
      const buyCityLabel = isCraft
        ? (options.buyCity === 'auto' ? 'Varias' : options.buyCity)
        : (buyQuote.city || options.buyCity);
      if (!options.sameCity && buyCityLabel === sellCity) return;
      const dates = [sale.date, ...materialPrices.map(p => p.date)];
      if (!isCraft && buyQuote) dates.push(buyQuote.date);
      const age = maxAge(dates);
      if (maxAgeHours && age > maxAgeHours * 60) return;

      let result, costPerUnit, revenuePerUnit, profit, roi, margin;
      if (isCraft) {
        const resources = entry.res.map((resource, index) => ({
          id: resource.id, es: resource.es, q: resource.q, ret: resource.ret,
          max: resource.max, price: materialPrices[index]?.price || 0,
        }));
        result = engine.calculate({
          item: entry, runs: 1, rrrPct: rrr, itemValue: entry.value,
          station: { mode: 'nutrition', feePer100: options.stationFee || 0 },
          resources, buyMode, buyOrderFee: !!options.buyOrderFee,
          sellMode, sellPrice: sale.price, relists: 0, otherCosts: 0,
          journal: null, premium: !!options.premium,
        });
        revenuePerUnit = result.grossRevenue / result.outputQty;
        costPerUnit = result.totalCosts / result.outputQty;
        profit = result.profit / result.outputQty;
        roi = result.roi;
        margin = result.grossRevenue > 0 ? result.profit / result.grossRevenue * 100 : 0;
      } else {
        result = engine.calculateFlip({
          qty: 1, buyPrice: buyQuote.price, sellPrice: sale.price,
          buyMode, sellMode, relists: 0, transport: 0, premium: !!options.premium,
        });
        revenuePerUnit = result.grossRevenue;
        costPerUnit = result.totalCosts;
        profit = result.profit;
        roi = result.roi;
        margin = result.margin;
      }
      if (profit < minProfit || roi < minRoi) return;
      rows.push({
        id: entry.id, item: entry, strategy: options.strategy,
        craftCity, buyCity: buyCityLabel, sellCity,
        buyPrice: isCraft ? null : buyQuote.price, sellPrice: sale.price,
        costPerUnit, revenuePerUnit, salesTax: result.salesTax, setupFee: result.setupFee,
        stationFee: result.stationFee || 0, buyOrderFee: result.buyOrderFee || 0,
        profit, roi, margin, rrr, age,
        buyDate: isCraft ? null : (buyQuote.date || null), sellDate: sale.date || null,
        materialPrices, quality, buyMode, sellMode,
        focus: !!options.focus, dailyBonus: options.dailyBonus || 0,
        stationFeePer100: options.stationFee || 0, rrrMode: options.rrrMode || 'auto',
        premium: !!options.premium, meta,
      });
    });
  });

  const sort = options.sort || 'profit';
  rows.sort((a, b) => sort === 'roi' ? b.roi - a.roi
    : sort === 'margin' ? b.margin - a.margin
      : sort === 'freshness' ? a.age - b.age : b.profit - a.profit);
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 30));
  return rows.slice(0, limit);
}

export async function scan(options, onProgress) {
  if (!catalog.total) throw new Error('El catálogo no está cargado.');
  const candidates = selectCandidates(options);
  if (!candidates.length) return { rows: [], candidates: 0, requests: 0, prices: 0 };
  const ids = neededIds(candidates, options.strategy);
  const cities = allCities(options);
  onProgress?.({ done: 0, total: null, message: `Consultando ${ids.length} IDs en ${cities.length} ciudades…` });
  const fetched = await fetchAll(options, ids, cities, onProgress);
  const meta = { candidates: candidates.length, requests: fetched.requests,
    prices: fetched.rows, ids: ids.length, cities: cities.length };
  const rows = evaluate(options, candidates, fetched.map, meta);
  return { rows, candidates: candidates.length, requests: fetched.requests, prices: fetched.rows };
}

export function describe(row) {
  const parts = [row.item.es];
  if (row.strategy === 'craft' || row.strategy === 'refine') {
    parts.push(`craftear en ${cityLabel(row.craftCity)}`, `comprar en ${cityLabel(row.buyCity)}`);
  } else parts.push(`comprar en ${cityLabel(row.buyCity)}`);
  parts.push(`vender en ${cityLabel(row.sellCity)}`);
  return parts.join(' · ');
}

/* Exportados también para pruebas unitarias. */
export { selectCandidates, neededIds, sourceCities, sellCities, evaluate };
