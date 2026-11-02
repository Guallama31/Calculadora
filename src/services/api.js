/* Cliente del Albion Online Data Project (precios por ciudad). */
import { CITIES } from '../settings/index.js';
export { CITIES };
export const SERVER_LABELS = { west: 'Américas (West)', east: 'Asia (East)', europe: 'Europa' };

const HOSTS = {
  west: 'https://west.albion-online-data.com/api/v2',
  east: 'https://east.albion-online-data.com/api/v2',
  europe: 'https://europe.albion-online-data.com/api/v2',
};
const cache = new Map();
const TTL = 60_000;

function pathFor(ids, cities, quality) {
  const list = [...new Set(ids)].filter(Boolean).join(',');
  const locations = [...new Set(cities)].filter(Boolean).map(encodeURIComponent).join(',');
  return `/stats/prices/${list}.json?locations=${locations}&qualities=${quality}`;
}

function friendlyError(response) {
  if (response.status === 429) {
    const reset = response.headers.get('RateLimit-Reset');
    const seconds = reset ? Math.max(0, Math.ceil(Number(reset) - Date.now() / 1000)) : null;
    return new Error(`Límite de peticiones alcanzado (429).${seconds ? ` Reintentá en ${seconds} s.` : ' Esperá antes de reintentar.'}`);
  }
  return new Error(`La API respondió HTTP ${response.status}.`);
}

export async function fetchPrices({ server = 'west', ids = [], cities = [], quality = 1, proxy = '' }) {
  if (!ids.length || !cities.length) return [];
  const path = pathFor(ids, cities, quality);
  const key = `${server}|${quality}|${path}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < TTL) return hit.rows;
  const candidates = [HOSTS[server] + path];
  if (proxy) candidates.unshift(proxy.replace(/\/+$/, '') + path);
  let last;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw friendlyError(res);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('Respuesta inesperada de la API.');
      cache.set(key, { rows, time: Date.now() });
      return rows;
    } catch (error) { last = error; }
  }
  if (last && (last instanceof TypeError || last.name === 'TypeError')) {
    throw new Error('No se pudo contactar con la API (posible bloqueo CORS o sin conexión). Cargá los precios manualmente o configurá un proxy.');
  }
  throw last || new Error('No se pudieron obtener los precios.');
}

export function indexRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = [row.item_id, row.city, row.quality].join('|').toLowerCase();
    const prev = map.get(key);
    if (!prev || String(row.sell_price_min_date) > String(prev.sell_price_min_date)) map.set(key, row);
  }
  return map;
}
export const pick = (map, id, city, quality) => map.get([id, city, quality].join('|').toLowerCase()) || null;
export function priceFor(row, mode) {
  if (!row) return null;
  const price = mode === 'buy' ? row.buy_price_max : row.sell_price_min;
  const date = mode === 'buy' ? row.buy_price_max_date : row.sell_price_min_date;
  if (!(Number(price) > 0)) return null;
  return { price: Number(price), date: date || null, city: row.city, row };
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
