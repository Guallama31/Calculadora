const DATABASE_NAME = 'calculadora-market-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'quotes';
export const PRICE_CACHE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error leyendo la caché local.'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB no está disponible en este navegador.'));
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('No se pudo abrir la caché local.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('La caché local está bloqueada por otra pestaña.'));
    };
  });
  return databasePromise;
}

export function priceCacheKey({ server, itemId, city, quality }) {
  return [server, itemId, city, quality].map(value => encodeURIComponent(String(value))).join('|');
}

function validQuote(row, side) {
  const price = Number(side === 'buy' ? row?.buy_price_max : row?.sell_price_min);
  const date = side === 'buy' ? row?.buy_price_max_date : row?.sell_price_min_date;
  return Number.isFinite(price) && price > 0 && date && Number.isFinite(Date.parse(date))
    ? { price, date }
    : null;
}

function mergeObservation(previous, incoming, receivedAt) {
  const merged = previous ? { ...previous } : { ...incoming };
  for (const side of ['buy', 'sell']) {
    const quote = validQuote(incoming, side);
    const existing = validQuote(merged, side);
    if (quote && (!previous || !existing || Date.parse(quote.date) > Date.parse(existing.date))) {
      if (side === 'buy') {
        merged.buy_price_max = quote.price;
        merged.buy_price_max_date = quote.date;
        merged.buy_fetched_at = receivedAt;
      } else {
        merged.sell_price_min = quote.price;
        merged.sell_price_min_date = quote.date;
        merged.sell_fetched_at = receivedAt;
      }
    }
  }
  merged.key = priceCacheKey({
    server: incoming.server, itemId: incoming.item_id,
    city: incoming.city, quality: incoming.quality,
  });
  merged.server = incoming.server;
  merged.cached_at = Math.max(merged.buy_fetched_at || 0, merged.sell_fetched_at || 0);
  return merged;
}

export async function writePriceRows(server, rows, receivedAt = Date.now()) {
  const validRows = (rows || []).filter(row => row?.item_id && row?.city && row.quality != null
    && (validQuote(row, 'buy') || validQuote(row, 'sell')));
  if (!validRows.length) return 0;
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    validRows.forEach(row => {
      const incoming = { ...row, server };
      const key = priceCacheKey({
        server, itemId: incoming.item_id, city: incoming.city, quality: incoming.quality,
      });
      const request = store.get(key);
      request.onsuccess = () => store.put(mergeObservation(request.result, incoming, receivedAt));
      request.onerror = () => transaction.abort();
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la caché local.'));
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar la caché local.'));
  });
  return validRows.length;
}

export async function readPriceRows({ server, ids, cities, qualities }) {
  const database = await openDatabase();
  const keys = [];
  [...new Set(ids)].forEach(itemId => [...new Set(cities)].forEach(city => [...new Set(qualities)].forEach(quality => {
    keys.push(priceCacheKey({ server, itemId, city, quality }));
  })));
  if (!keys.length) return [];
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const rows = [];
    keys.forEach(key => {
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result;
        if (row && Date.now() - row.cached_at <= PRICE_CACHE_RETENTION_MS) {
          rows.push({ ...row, __priceSource: 'cache' });
        }
      };
      request.onerror = () => transaction.abort();
    });
    transaction.oncomplete = () => resolve(rows);
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo leer la caché local.'));
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo leer la caché local.'));
  });
}

export async function clearPriceCache() {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo borrar la caché local.'));
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo borrar la caché local.'));
  });
}

export async function getPriceCacheCount() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  return requestResult(transaction.objectStore(STORE_NAME).count());
}

export async function prunePriceCache(now = Date.now()) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (now - cursor.value.cached_at > PRICE_CACHE_RETENTION_MS) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo depurar la caché local.'));
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo depurar la caché local.'));
  });
}
