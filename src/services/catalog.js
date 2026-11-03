/* Catálogo de ítems: índice, búsqueda tolerante a acentos y resolución de variantes. */
import { CATALOG } from '../../data/catalog.js';
import { normalize } from './format.js';
import { categoryLabel, classifyItem, subcategoryLabel } from './item-taxonomy.js';

const RENDER = 'https://render.albiononline.com/v1/item/';
const byId = new Map();
const byBase = new Map();
const index = [];
const entries = CATALOG.map(entry => ({ ...entry, ...classifyItem(entry) }));

entries.forEach((entry, position) => {
  byId.set(entry.id, entry);
  if (!byBase.has(entry.base)) byBase.set(entry.base, []);
  byBase.get(entry.base).push(entry);
  index.push({
    position,
    id: normalize(entry.id),
    name: normalize(`${entry.es} ${entry.en}`),
    text: normalize([
      entry.es, entry.en, entry.id, entry.cat, entry.sub, entry.sub2,
      categoryLabel(entry.categoryId), entry.categoryId, entry.subcategoryId, entry.familyId, ...entry.tags,
    ].join(' ')),
  });
});

export { categoryLabel, entries, subcategoryLabel };
export const total = entries.length;

export function get(id) { return byId.get(id) || null; }
export function variants(base) {
  return (byBase.get(base) || []).slice().sort((a, b) => a.lvl - b.lvl);
}
export function enchantmentVariants(base) {
  return variants(base).filter(entry => entry.lvl > 0 && /_(RUNE|SOUL|RELIC)$/.test(entry.upgrade?.id || ''));
}
export function isEnchantableBase(entry) {
  return !!entry && entry.lvl === 0 && enchantmentVariants(entry.base).length > 0;
}
export function icon(id, quality = 1) { return `${RENDER}${id}.png?quality=${quality}`; }

export function search(query, limit = 50, filter = null) {
  const pool = filter ? entries.filter(filter) : entries;
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const scored = [];
  if (!tokens.length) {
    /* Sin búsqueda: sugerencias útiles para cualquier módulo (incluidos los que
       solo muestran variantes encantadas o recetas de refinado). */
    pool.forEach(entry => {
      const score = (entry.lvl === 0 ? 0 : 2) + (entry.tier >= 4 && entry.tier <= 6 ? 0 : 1);
      scored.push({ entry, score });
    });
    scored.sort((a, b) => a.score - b.score || b.entry.tier - a.entry.tier || a.entry.id.length - b.entry.id.length);
    return scored.slice(0, limit).map(x => x.entry);
  }
  index.forEach(row => {
    const entry = entries[row.position];
    if (filter && !filter(entry)) return;
    let score = 0;
    for (const token of tokens) {
      if (row.id === token) score -= 40;
      else if (row.id.startsWith(token)) score -= 12;
      else if (row.text.includes(token)) score += 1;
      else return;
    }
    const phrase = tokens.join(' ');
    if (row.name.startsWith(phrase)) score -= 25;
    else if (row.name.includes(phrase)) score -= 12;
    if (entry.lvl === 0) score -= 6;
    if (entry.tier >= 4 && entry.tier <= 8) score -= 1;
    score += entry.es.length / 1000;
    scored.push({ entry, score });
  });
  scored.sort((a, b) => a.score - b.score || a.entry.es.localeCompare(b.entry.es, 'es'));
  return scored.slice(0, limit).map(x => x.entry);
}

export function categoryOf(id) {
  const entry = get(id);
  return entry ? {
    cat: entry.cat, sub: entry.sub, sub2: entry.sub2, ccat: entry.ccat,
    categoryId: entry.categoryId, subcategoryId: entry.subcategoryId,
    familyId: entry.familyId, tags: entry.tags, classificationRule: entry.classificationRule,
    classificationVersion: entry.classificationVersion,
  } : null;
}
