/* Catálogo de ítems: índice, búsqueda tolerante a acentos y resolución de variantes.

   El catálogo pesa ~5 MB, así que `data/catalog.js` se carga con `import()`
   dinámico desde `main.jsx` y se registra aquí mediante `initializeCatalog()`.
   Las vistas consumen este servicio y no el módulo de datos, para que el
   arranque pueda mostrar un estado de carga y el catálogo quede en un chunk
   independiente (cacheable entre despliegues). */
import { normalize } from './format.js';
import { categoryLabel, classifyItem, subcategoryLabel } from './item-taxonomy.js';

const RENDER = 'https://render.albiononline.com/v1/item/';
const byId = new Map();
const byBase = new Map();
let index = [];
const entries = [];
let total = 0;
let mountBreeds = [];
let mountFoodList = [];
let ready = false;

export { entries, total };
export const isReady = () => ready;
export const mountBreeding = () => mountBreeds;
export const mountFoods = () => mountFoodList;

export function initializeCatalog({ CATALOG = [], MOUNT_BREEDING = [], MOUNT_FOODS = [] } = {}) {
  entries.length = 0;
  index = [];
  byId.clear();
  byBase.clear();

  CATALOG.forEach((entry, position) => {
    const classified = { ...entry, ...classifyItem(entry) };
    entries.push(classified);
    byId.set(classified.id, classified);
    if (!byBase.has(classified.base)) byBase.set(classified.base, []);
    byBase.get(classified.base).push(classified);
    index.push({
      position,
      id: normalize(classified.id),
      name: normalize(`${classified.es} ${classified.en}`),
      text: normalize([
        classified.es, classified.en, classified.id, classified.cat, classified.sub, classified.sub2,
        categoryLabel(classified.categoryId), classified.categoryId, classified.subcategoryId,
        classified.familyId, ...classified.tags,
      ].join(' ')),
    });
  });

  total = entries.length;
  mountBreeds = MOUNT_BREEDING;
  mountFoodList = MOUNT_FOODS;
  ready = true;
  return { total, breeding: mountBreeds.length, foods: mountFoodList.length };
}

export { categoryLabel, subcategoryLabel };

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
