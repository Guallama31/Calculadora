/* Respuestas simuladas de AODP para las pruebas. */
import { vi } from 'vitest';

export function installFetch({ mode = 'ok', discount = 420, missingCity = null, missingItem = null } = {}) {
  const now = new Date().toISOString();
  const spy = vi.fn(async (url, _options) => {
    if (mode === '429') {
      return { ok: false, status: 429,
        headers: { get: k => k === 'RateLimit-Reset' ? String(Math.floor(Date.now() / 1000) + 45) : null },
        json: async () => [] };
    }
    if (mode === 'cors') throw new TypeError('Failed to fetch');
    const u = new URL(String(url), 'http://localhost');
    const ids = (u.pathname.match(/\/stats\/prices\/(.+)\.json$/)?.[1] || '').split(',');
    const cities = (u.searchParams.get('locations') || '').split(',');
    const qualities = (u.searchParams.get('qualities') || '1').split(',');
    const rows = [];
    for (const id of ids) for (const city of cities) for (const q of qualities) {
      if (city === missingCity && (!missingItem || id === missingItem)) continue;
      let base = 1000 + id.length * 37 + city.length * 11 + Number(q) * 100;
      if (city === 'Thetford') base -= discount;
      const price = Math.max(1, Math.round(base));
      rows.push({ item_id: id, city, quality: Number(q), sell_price_min: price,
        sell_price_min_date: now, buy_price_max: Math.round(price * .86), buy_price_max_date: now });
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}
