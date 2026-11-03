import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPriceCache, fetchPrices, getPriceCacheCount, indexRows, priceAt, priceFor,
  chunkPriceIds, quoteCoverage,
} from '../src/services/api.js';
import {
  PRICE_CACHE_RETENTION_MS, prunePriceCache, readPriceRows, writePriceRows,
} from '../src/services/price-cache.js';
import { installFetch } from './fixtures.js';

const row = (sellPrice, sellDate, buyPrice, buyDate, extra = {}) => ({
  item_id: 'T4_BAG', city: 'Fort Sterling', quality: 1,
  sell_price_min: sellPrice, sell_price_min_date: sellDate,
  buy_price_max: buyPrice, buy_price_max_date: buyDate,
  ...extra,
});

describe('servicio de precios AODP', () => {
  beforeEach(async () => {
    installFetch();
    await clearPriceCache();
  });

  it('selecciona la observación más reciente de cada lado independientemente', () => {
    const indexed = indexRows([
      row(120, '2026-11-02T10:00:00Z', 80, '2026-11-02T12:00:00Z'),
      row(130, '2026-11-02T11:00:00Z', 70, '2026-11-02T09:00:00Z'),
    ]);
    const result = indexed.get('t4_bag|fort sterling|1');
    expect(priceFor(result, 'sell')).toMatchObject({ price: 130, date: '2026-11-02T11:00:00Z' });
    expect(priceFor(result, 'buy')).toMatchObject({ price: 80, date: '2026-11-02T12:00:00Z' });
  });

  it('rechaza precios no positivos, fechas inválidas y filas incompletas', () => {
    const indexed = indexRows([
      row(0, '2026-11-02T10:00:00Z', 80, 'fecha-invalida'),
      row(120, '', -1, '2026-11-02T11:00:00Z'),
      { item_id: 'sin-ciudad', quality: 1 },
    ]);
    const quote = priceAt(indexed, 'T4_BAG', 'Fort Sterling', 1, 'sell');
    expect(quote).toBeNull();
    expect(priceAt(indexed, 'T4_BAG', 'Fort Sterling', 1, 'buy')).toBeNull();
    expect(indexed.size).toBe(1);
  });

  it('cuenta cobertura por ítem, ciudad y lado, sin contar datos ausentes', () => {
    const indexed = indexRows([
      row(120, '2026-11-02T10:00:00Z', 0, '2026-11-02T10:00:00Z'),
    ]);
    expect(quoteCoverage(indexed, ['T4_BAG'], ['Fort Sterling'], 1))
      .toEqual({ requested: 2, quoted: 1, missing: 1, percent: 50 });
  });

  it('divide IDs según longitud real de la URL codificada y conserva todos los IDs una vez', () => {
    const ids = ['T4_BAG', 'T4_CAPE', 'T4_MAIN_SWORD@1', 'T4_ARMOR_CLOTH_SET1'];
    const chunks = chunkPriceIds({
      server: 'west', ids, cities: ['Fort Sterling', 'Black Market'], quality: 1,
      maxIds: 30, maxUrlLength: 170,
    });
    expect(chunks.flat()).toEqual(ids);
    expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
    expect(chunks.every(chunk => new URL(
      `https://west.albion-online-data.com/api/v2/stats/prices/${chunk.join(',')}.json?locations=Fort%20Sterling,Black%20Market&qualities=1`,
    ).toString().length <= 170)).toBe(true);
  });

  it('reporta IDs con URL individual demasiado larga y servidor desconocido', () => {
    expect(() => chunkPriceIds({
      server: 'west', ids: ['T4_BAG'], cities: ['Black Market'], maxUrlLength: 20,
    })).toThrow(/supera el límite local/);
    expect(() => chunkPriceIds({ server: 'unknown', ids: ['T4_BAG'], cities: ['Lymhurst'] }))
      .toThrow(/Servidor de precios no válido/);
  });

  it('valida la forma de respuesta HTTP antes de devolver filas', async () => {
    const fetch = installFetch();
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ prices: [] }) });
    await expect(fetchPrices({ ids: ['T4_BAG'], cities: ['Lymhurst'] }))
      .rejects.toThrow('Respuesta inesperada de la API.');
  });

  it('distingue solicitudes iniciadas de solicitudes deduplicadas en curso', async () => {
    const fetch = installFetch();
    const requests = [];
    await Promise.all([1, 2].map(() => fetchPrices({
      ids: ['T4_BAG'], cities: ['Lymhurst'],
      onRequest: request => requests.push(request),
    })));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(requests).toEqual([
      { initiated: true, deduplicated: false },
      { initiated: false, deduplicated: true },
    ]);
  });

  it('guarda precios locales y solo recurre a ellos si falla AODP, marcándolos como anteriores', async () => {
    const liveRows = await fetchPrices({ ids: ['T4_BAG'], cities: ['Lymhurst'], quality: 1 });
    expect(liveRows[0].__cacheWarning).toBeUndefined();
    installFetch({ mode: 'cors' });
    const cachedRows = await fetchPrices({ ids: ['T4_BAG'], cities: ['Lymhurst'], quality: 1 });
    const quote = priceAt(indexRows(cachedRows), 'T4_BAG', 'Lymhurst', 1, 'sell');

    expect(quote).toMatchObject({ source: 'cache', price: expect.any(Number) });
    expect(cachedRows[0].__cacheFallbackError).toContain('No se pudo contactar con AODP');
  });

  it('no mezcla la caché entre servidores, ciudades ni calidades', async () => {
    await fetchPrices({ server: 'west', ids: ['T4_BAG'], cities: ['Lymhurst'], quality: 1 });
    installFetch({ mode: 'cors' });

    await expect(fetchPrices({
      server: 'east', ids: ['T4_BAG'], cities: ['Lymhurst'], quality: 1,
    })).rejects.toThrow('No se pudo contactar con AODP');
    await expect(fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Martlock'], quality: 1,
    })).rejects.toThrow('No se pudo contactar con AODP');
    await expect(fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Lymhurst'], quality: 2,
    })).rejects.toThrow('No se pudo contactar con AODP');
  });

  it('descarta observaciones vencidas y permite borrar la caché local', async () => {
    await writePriceRows('west', [
      row(120, '2026-11-02T10:00:00Z', 80, '2026-11-02T10:00:00Z'),
    ], Date.now() - PRICE_CACHE_RETENTION_MS - 1);
    installFetch({ mode: 'cors' });
    await expect(fetchPrices({ ids: ['T4_BAG'], cities: ['Fort Sterling'] }))
      .rejects.toThrow('No se pudo contactar con AODP');

    installFetch();
    await fetchPrices({ ids: ['T4_BAG'], cities: ['Lymhurst'] });
    await clearPriceCache();
    installFetch({ mode: 'cors' });
    await expect(fetchPrices({ ids: ['T4_BAG'], cities: ['Lymhurst'] }))
      .rejects.toThrow('No se pudo contactar con AODP');
  });
});

function hangingFetch() {
  const spy = vi.fn((_url, options) => new Promise((_resolve, reject) => {
    const signal = options?.signal;
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('tiempo de espera y cancelación de consultas', () => {
  beforeEach(async () => {
    await clearPriceCache();
  });

  it('aborta a petición del usuario sin usar la caché como respuesta', async () => {
    await writePriceRows('west', [row(120, new Date().toISOString(), 90, new Date().toISOString())]);
    hangingFetch();
    const controller = new AbortController();
    const promise = fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'],
      signal: controller.signal, timeoutMs: 0,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('corta la espera con un error legible cuando AODP no responde', async () => {
    hangingFetch();
    await expect(fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'], timeoutMs: 40,
    })).rejects.toThrow(/no respondió en 1 s/);
  });

  it('al vencer el tiempo de espera devuelve la caché local si existe', async () => {
    await writePriceRows('west', [row(120, new Date().toISOString(), 90, new Date().toISOString())]);
    hangingFetch();
    const rows = await fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'], timeoutMs: 40,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].__priceSource).toBe('cache');
    expect(rows[0].__cacheFallbackError).toMatch(/no respondió/);
  });

  it('rechaza de inmediato si la señal llega ya cancelada', async () => {
    const spy = installFetch();
    const controller = new AbortController();
    controller.abort();
    await expect(fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'], signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('libera la petición en vuelo al cancelar, para que la siguiente no herede el rechazo', async () => {
    hangingFetch();
    const first = new AbortController();
    const promise = fetchPrices({
      server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'], signal: first.signal, timeoutMs: 0,
    });
    first.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    installFetch();
    const rows = await fetchPrices({ server: 'west', ids: ['T4_BAG'], cities: ['Fort Sterling'] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].__cacheFallbackError).toBeUndefined();
  });
});

describe('caché local de cotizaciones', () => {
  beforeEach(async () => {
    await clearPriceCache();
  });

  it('ignora filas inválidas y guarda las válidas del mismo lote', async () => {
    const written = await writePriceRows('west', [
      row(120, new Date().toISOString(), 90, new Date().toISOString()),
      row(0, '', 0, ''),
    ]);
    expect(written).toBe(1);
    expect(await getPriceCacheCount()).toBe(1);
  });

  it('descarta lo que supera la retención al leer y al depurar', async () => {
    const now = new Date().toISOString();
    await writePriceRows('west', [
      row(120, now, 90, now, { item_id: 'T4_AGED' }),
      row(130, now, 95, now, { item_id: 'T4_FRESH' }),
    ]);
    /* Se envejece una fila reescribiéndola con una fecha de recepción antigua. */
    await writePriceRows('west', [
      row(120, now, 90, now, { item_id: 'T4_STALE' }),
    ], Date.now() - PRICE_CACHE_RETENTION_MS - 60_000);

    const read = await readPriceRows({
      server: 'west', ids: ['T4_AGED', 'T4_STALE'], cities: ['Fort Sterling'], qualities: [1],
    });
    expect(read.map(row => row.item_id)).toEqual(['T4_AGED']);

    expect(await getPriceCacheCount()).toBe(3);
    await prunePriceCache();
    expect(await getPriceCacheCount()).toBe(2);
  });
});
