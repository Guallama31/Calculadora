/* Cliente del Albion Online Data Project (precios por ciudad). */
import { CITIES } from '../settings/index.js';
import {
  clearPriceCache, getPriceCacheCount, prunePriceCache, readPriceRows, writePriceRows,
} from './price-cache.js';
export { CITIES };
export const SERVER_LABELS = { west: 'Américas (West)', east: 'Asia (East)', europe: 'Europa' };

const HOSTS = {
  west: 'https://west.albion-online-data.com/api/v2',
  east: 'https://east.albion-online-data.com/api/v2',
  europe: 'https://europe.albion-online-data.com/api/v2',
};
const inFlight = new Map();
const DEFAULT_MAX_IDS = 30;
const DEFAULT_MAX_URL_LENGTH = 3500;
const CACHE_PRUNE_INTERVAL = 24 * 60 * 60 * 1000;
let lastCachePrune = 0;
/* Sin timeout una petición colgada deja la vista en «Consultando precios…»
   para siempre y bloquea la entrada de `inFlight`. */
export const PRICE_REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal(ms) {
  if (!(Number(ms) > 0) || typeof AbortSignal === 'undefined') return null;
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(Number(ms));
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('timeout')), Number(ms));
  return controller.signal;
}

function mergeSignals(signals) {
  const list = signals.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const controller = new AbortController();
  list.forEach(signal => {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  });
  return controller.signal;
}

export function isAbortError(error) {
  return !!error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function cancelError() {
  const error = new Error('Consulta cancelada.');
  error.name = 'AbortError';
  return error;
}

function pathFor(ids, cities, quality) {
  const list = [...new Set(ids)].filter(Boolean).join(',');
  const locations = [...new Set(cities)].filter(Boolean).map(encodeURIComponent).join(',');
  return `/stats/prices/${list}.json?locations=${locations}&qualities=${quality}`;
}

function validQuote(row, mode) {
  const price = Number(mode === 'buy' ? row?.buy_price_max : row?.sell_price_min);
  const date = mode === 'buy' ? row?.buy_price_max_date : row?.sell_price_min_date;
  const timestamp = date ? Date.parse(date) : NaN;
  return Number.isFinite(price) && price > 0 && Number.isFinite(timestamp)
    ? { price, date }
    : null;
}

function quoteFields(mode) {
  return mode === 'buy'
    ? ['buy_price_max', 'buy_price_max_date']
    : ['sell_price_min', 'sell_price_min_date'];
}

export function chunkPriceIds({
  server = 'west', ids = [], cities = [], quality = 1,
  maxIds = DEFAULT_MAX_IDS, maxUrlLength = DEFAULT_MAX_URL_LENGTH,
} = {}) {
  const host = HOSTS[server];
  if (!host) throw new Error(`Servidor de precios no válido: ${server}.`);
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length || !cities.length) return [];
  const chunks = [];
  let current = [];
  uniqueIds.forEach(id => {
    const candidate = [...current, id];
    const urlLength = (host + pathFor(candidate, cities, quality)).length;
    if (current.length && (candidate.length > maxIds || urlLength > maxUrlLength)) {
      chunks.push(current);
      current = [id];
    } else {
      current = candidate;
    }
    if ((host + pathFor(current, cities, quality)).length > maxUrlLength) {
      throw new Error(`La consulta para ${id} supera el límite local de URL.`);
    }
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function friendlyError(response) {
  if (response.status === 429) {
    const reset = response.headers.get('RateLimit-Reset');
    const seconds = reset ? Math.max(0, Math.ceil(Number(reset) - Date.now() / 1000)) : null;
    return new Error(`Límite de peticiones alcanzado (429).${seconds ? ` Reintentá en ${seconds} s.` : ' Esperá antes de reintentar.'}`);
  }
  return new Error(`La API respondió HTTP ${response.status}.`);
}

export async function fetchPrices({
  server = 'west', ids = [], cities = [], quality = 1, onRequest,
  signal = null, timeoutMs = PRICE_REQUEST_TIMEOUT_MS,
}) {
  if (!ids.length || !cities.length) return [];
  if (!HOSTS[server]) throw new Error(`Servidor de precios no válido: ${server}.`);
  if (signal?.aborted) throw cancelError();
  const path = pathFor(ids, cities, quality);
  const key = `${server}|${path}`;
  if (inFlight.has(key)) {
    onRequest?.({ initiated: false, deduplicated: true });
    return inFlight.get(key);
  }
  onRequest?.({ initiated: true, deduplicated: false });
  const request = (async () => {
    try {
      const res = await fetch(HOSTS[server] + path, {
        headers: { Accept: 'application/json' }, cache: 'no-store',
        signal: mergeSignals([signal, timeoutSignal(timeoutMs)]),
      });
      if (!res.ok) throw friendlyError(res);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('Respuesta inesperada de la API.');
      try {
        if (Date.now() - lastCachePrune >= CACHE_PRUNE_INTERVAL) {
          await prunePriceCache();
          lastCachePrune = Date.now();
        }
        await writePriceRows(server, rows);
      } catch (cacheError) {
        rows.forEach(row => { row.__cacheWarning = cacheError.message; });
      }
      return rows;
    } catch (thrown) {
      /* Cancelación del usuario: no es un fallo, no se consulta la caché ni se
         pinta un error; la vista decide (normalmente ignora el rechazo). */
      if (signal?.aborted && thrown?.name !== 'TimeoutError') throw cancelError();
      let error = thrown;
      if (error?.name === 'TimeoutError') {
        error = new Error(`AODP no respondió en ${Math.max(1, Math.round(Number(timeoutMs) / 1000))} s. Se usará la caché local si hay datos.`);
      } else if (error instanceof TypeError || error?.name === 'TypeError') {
        error = new Error('No se pudo contactar con AODP. Revisá tu conexión e intentá nuevamente.');
      }
      try {
        const cachedRows = await readPriceRows({
          server,
          ids,
          cities,
          qualities: String(quality).split(',').map(value => Number(value.trim())).filter(Number.isFinite),
        });
        if (cachedRows.length) {
          cachedRows.forEach(row => { row.__cacheFallbackError = error.message; });
          return cachedRows;
        }
      } catch (cacheError) {
        throw new Error(`${error.message} No se pudo consultar la caché local: ${cacheError.message}`);
      }
      throw error;
    }
  })();
  inFlight.set(key, request);
  /* Si la vista que inició la petición la cancela, hay que soltar la entrada
     de inmediato: `abort()` es síncrono y la siguiente consulta (mismo ítem y
     ciudades) se encontraría con la promesa vieja a punto de rechazarse. */
  const forget = signal
    ? () => { if (inFlight.get(key) === request) inFlight.delete(key); }
    : null;
  if (forget) {
    if (signal.aborted) forget();
    else signal.addEventListener('abort', forget, { once: true });
  }
  try {
    return await request;
  } finally {
    if (forget) signal.removeEventListener('abort', forget);
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

export function indexRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.item_id || !row?.city || row.quality == null) continue;
    const key = [row.item_id, row.city, row.quality].join('|').toLowerCase();
    const prev = map.get(key);
    const merged = prev ? { ...prev } : { ...row };
    for (const mode of ['sell', 'buy']) {
      const incoming = validQuote(row, mode);
      const existing = validQuote(merged, mode);
      if (incoming && (!existing || Date.parse(incoming.date) > Date.parse(existing.date))) {
        const [priceField, dateField] = quoteFields(mode);
        merged[priceField] = incoming.price;
        merged[dateField] = incoming.date;
      }
    }
    map.set(key, merged);
  }
  return map;
}
export const pick = (map, id, city, quality) => map.get([id, city, quality].join('|').toLowerCase()) || null;
export function priceFor(row, mode) {
  if (!row) return null;
  const quote = validQuote(row, mode);
  if (!quote) return null;
  return {
    ...quote, city: row.city, source: row.__priceSource || 'aodp',
    fetchedAt: mode === 'buy' ? row.buy_fetched_at || row.cached_at : row.sell_fetched_at || row.cached_at,
    row,
  };
}
export function priceAt(map, id, city, quality, mode) {
  return priceFor(pick(map, id, city, quality), mode);
}
export function bestPrice(map, id, cities, quality, mode) {
  let best = null;
  for (const city of cities) {
    const quote = priceAt(map, id, city, quality, mode);
    if (quote && (!best || quote.price < best.price)) best = { ...quote, city };
  }
  return best;
}

export function quoteCoverage(map, ids, cities, quality) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const uniqueCities = [...new Set(cities)].filter(Boolean);
  const requested = uniqueIds.length * uniqueCities.length * 2;
  let quoted = 0;
  uniqueIds.forEach(id => uniqueCities.forEach(city => {
    const row = pick(map, id, city, quality);
    if (priceFor(row, 'buy')) quoted += 1;
    if (priceFor(row, 'sell')) quoted += 1;
  }));
  return {
    requested,
    quoted,
    missing: requested - quoted,
    percent: requested ? quoted / requested * 100 : null,
  };
}

export function cacheNotice(rows) {
  const list = rows || [];
  const cached = list.some(row => row.__priceSource === 'cache');
  const warning = list.find(row => row.__cacheWarning)?.__cacheWarning;
  const cacheError = list.find(row => row.__cacheFallbackError)?.__cacheFallbackError;
  return [
    cached ? 'Se usaron cotizaciones anteriores de la caché local; revisá sus fechas.' : '',
    cacheError ? `AODP no respondió (${cacheError}).` : '',
    warning ? `No se pudo actualizar la caché local: ${warning}` : '',
  ].filter(Boolean).join(' ');
}

export { clearPriceCache, getPriceCacheCount };
