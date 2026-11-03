export const TAXONOMY_VERSION = 1;

export const ITEM_CATEGORIES = [
  { value: '', label: 'Todas las categorías' },
  { value: 'weapons', label: 'Armas' },
  { value: 'offhands', label: 'Mano secundaria' },
  { value: 'head-armor', label: 'Cascos y equipo de cabeza' },
  { value: 'chest-armor', label: 'Armaduras de pecho' },
  { value: 'foot-armor', label: 'Botas y equipo de pies' },
  { value: 'accessories', label: 'Accesorios' },
  { value: 'mounts', label: 'Monturas' },
  { value: 'consumables', label: 'Consumibles' },
  { value: 'raw-resources', label: 'Recursos en bruto' },
  { value: 'refined-materials', label: 'Materiales refinados' },
  { value: 'farming', label: 'Agricultura y productos animales' },
  { value: 'fishing', label: 'Pesca' },
  { value: 'gathering-gear-tools', label: 'Equipamiento y herramientas de recolección' },
  { value: 'crafting-alchemy-materials', label: 'Materiales de fabricación y alquimia' },
  { value: 'artifacts', label: 'Artefactos' },
  { value: 'journals-laborers', label: 'Diarios y trabajadores' },
  { value: 'furniture-housing', label: 'Mobiliario y vivienda' },
  { value: 'treasures-luxury-goods', label: 'Tesoros y bienes de lujo' },
  { value: 'vanity-cosmetics', label: 'Cosméticos y apariencia' },
  { value: 'loot-tokens-other', label: 'Botín, mapas, fichas y otros objetos especiales' },
  { value: 'unclassified', label: 'Sin clasificar' },
];

const SHOP_CATEGORY_RULES = {
  weapons: ['weapons', 'shop.weapons'],
  offhands: ['offhands', 'shop.offhands'],
  head: ['head-armor', 'shop.head'],
  armors: ['chest-armor', 'shop.armors'],
  shoes: ['foot-armor', 'shop.shoes'],
  capes: ['accessories', 'shop.capes'],
  bags: ['accessories', 'shop.bags'],
  mounts: ['mounts', 'shop.mounts'],
  consumables: ['consumables', 'shop.consumables'],
  gathering: ['gathering-gear-tools', 'shop.gathering'],
  artefacts: ['artifacts', 'shop.artefacts'],
  furniture: ['furniture-housing', 'shop.furniture'],
  treasures: ['treasures-luxury-goods', 'shop.treasures'],
  luxurygoods: ['treasures-luxury-goods', 'shop.luxury-goods'],
  vanity: ['vanity-cosmetics', 'shop.vanity'],
  cosmetics: ['vanity-cosmetics', 'shop.cosmetics'],
};

const REFINED_CRAFTING_CATEGORIES = new Set(['wood', 'ore', 'hide', 'fiber', 'rock']);
const COOKED_ITEM_PATTERN = /^T\d+_(?:BREAD|PIE|SALAD|SOUP|STEW|OMELETTE|SANDWICH|CAKE|COOKED)(?:_|$)/;
const EQUIPMENT_CATEGORIES = new Set([
  'weapons', 'offhands', 'head-armor', 'chest-armor', 'foot-armor', 'accessories',
]);

function classifySource({ id = '', cat = '', sub = '', ccat = '' } = {}) {
  const itemId = String(id).toUpperCase();
  const shopCategory = String(cat).toLowerCase();
  const shopSubcategory = String(sub).toLowerCase();
  const craftingCategory = String(ccat).toLowerCase();

  if (/^T\d+_(?:FISH_|BAIT)/.test(itemId)) return ['fishing', 'item.fish-or-bait'];
  if (shopCategory === 'farming' && COOKED_ITEM_PATTERN.test(itemId)) {
    return ['consumables', 'id.cooked-food'];
  }
  if (shopCategory === 'farming') return ['farming', 'shop.farming'];
  if (shopCategory === 'crafting') {
    if (shopSubcategory === 'refinedresources' || REFINED_CRAFTING_CATEGORIES.has(craftingCategory)) {
      return ['refined-materials', 'crafting.refined-resource'];
    }
    if (shopSubcategory === 'resources') return ['raw-resources', 'crafting.raw-resource'];
    if (shopSubcategory === 'alchemy' || craftingCategory === 'alchemy' || /_ALCHEMY_/.test(itemId)) {
      return ['crafting-alchemy-materials', 'crafting.alchemy'];
    }
  }
  if (shopCategory === 'other') {
    if (shopSubcategory === 'labourers') {
      return [/FURNITUREITEM_(?:BED|TABLE|TROPHY)(?:_|$)/.test(itemId)
        ? 'furniture-housing' : 'journals-laborers', 'other.labourers'];
    }
    if (shopSubcategory === 'maps') return ['loot-tokens-other', 'other.maps'];
    if (shopSubcategory === 'guilds') return ['loot-tokens-other', 'other.guild-activity'];
  }
  if (shopCategory === 'artefacts') return ['artifacts', 'shop.artefacts'];
  if (shopCategory === 'furniture') return ['furniture-housing', 'shop.furniture'];
  if (shopCategory === 'gathering') return ['gathering-gear-tools', 'shop.gathering'];
  if (shopCategory === 'consumables') return ['consumables', 'shop.consumables'];

  const rule = SHOP_CATEGORY_RULES[shopCategory];
  return rule || ['unclassified', 'fallback.unclassified'];
}

function categoryTags(categoryId, item, ruleId) {
  const tags = [];
  if (EQUIPMENT_CATEGORIES.has(categoryId)) tags.push('equipment');
  if (categoryId === 'weapons') tags.push('weapon');
  if (categoryId === 'offhands') tags.push('offhand');
  if (['head-armor', 'chest-armor', 'foot-armor'].includes(categoryId)) tags.push('armor');
  if (categoryId === 'accessories') tags.push('accessory');
  if (categoryId === 'mounts') tags.push('mount');
  if (categoryId === 'consumables') tags.push('consumable');
  if (categoryId === 'raw-resources') tags.push('raw-resource', 'gatherable');
  if (categoryId === 'refined-materials') tags.push('refined-material');
  if (categoryId === 'crafting-alchemy-materials') tags.push('crafting-material');
  if (categoryId === 'artifacts') tags.push('artifact', 'crafting-material');
  if (categoryId === 'fishing') tags.push('fish');
  if (categoryId === 'gathering-gear-tools') {
    tags.push(/_TOOL_/.test(item.id.toUpperCase()) ? 'gathering-tool' : 'gathering-gear');
  }
  if (categoryId === 'furniture-housing') tags.push('furniture');
  if (categoryId === 'treasures-luxury-goods') tags.push('treasure');
  if (categoryId === 'vanity-cosmetics') tags.push('cosmetic');
  if (categoryId === 'loot-tokens-other') tags.push('special-item');
  if (item.res?.length) tags.push('craftable');
  if (item.refine) tags.push('refinable');
  if (ruleId === 'other.maps') tags.push('map');
  if (ruleId === 'other.guild-activity') tags.push('guild-item');
  return tags;
}

export function classifyItem(item = {}) {
  const source = { ...item, id: String(item.id || '') };
  const [categoryId, classificationRule] = classifySource(source);
  const sourceSubcategory = String(item.sub || '').toLowerCase();
  const sourceFamily = String(item.sub2 || '').toLowerCase();
  const subcategoryId = categoryId === 'weapons'
    ? sourceSubcategory
    : categoryId === 'head-armor' || categoryId === 'chest-armor' || categoryId === 'foot-armor'
      ? sourceSubcategory.split('_')[0]
      : sourceSubcategory || String(item.ccat || '').toLowerCase();
  return {
    categoryId,
    subcategoryId,
    familyId: sourceFamily || null,
    classificationRule,
    classificationVersion: TAXONOMY_VERSION,
    tags: categoryTags(categoryId, source, classificationRule),
  };
}

export function categoryLabel(categoryId) {
  return ITEM_CATEGORIES.find(category => category.value === categoryId)?.label || 'Sin clasificar';
}

const SUBCATEGORY_LABELS = {
  bow: 'Arcos',
  firestaff: 'Bastones de fuego',
  sword: 'Espadas',
  crossbow: 'Ballestas',
  knuckles: 'Guanteletes',
  quarterstaff: 'Bastones de combate',
  shapeshifterstaff: 'Bastones cambiaformas',
  arcanestaff: 'Bastones arcanos',
  axe: 'Hachas',
  cursestaff: 'Bastones malditos',
  dagger: 'Dagas',
  froststaff: 'Bastones de hielo',
  hammer: 'Martillos',
  holystaff: 'Bastones sagrados',
  mace: 'Mazas',
  naturestaff: 'Bastones de naturaleza',
  spear: 'Lanzas',
  booktype: 'Libros',
  shieldtype: 'Escudos',
  torchtype: 'Antorchas',
  cloth: 'Tela',
  leather: 'Cuero',
  plate: 'Placas',
  other: 'Otros',
  basemounts: 'Monturas básicas',
  raremounts: 'Monturas raras',
  battle_mount: 'Monturas de batalla',
  food: 'Comida',
  potions: 'Pociones',
  tomes: 'Tomos',
  farmingproducts: 'Productos agrícolas',
  wood: 'Madera',
  rock: 'Piedra',
  hide: 'Pieles',
  ore: 'Mineral',
  fiber: 'Fibra',
  fish: 'Pesca',
  tracking: 'Rastreo',
  guilds: 'Gremio',
  maps: 'Mapas',
  weapons: 'Armas',
  armors: 'Armaduras',
  head: 'Cabeza',
  offhands: 'Mano secundaria',
  shoes: 'Pies',
  capes: 'Capas',
  bags: 'Bolsos',
  satchels: 'Bolsas de erudito',
  accessoires_capes_capes: 'Capas',
  accessoires_capes_avalon: 'Capas de Avalón',
  accessoires_capes_brecilien: 'Capas de Brecilien',
  labourers: 'Trabajadores',
  chest: 'Cofres',
  repairkit: 'Kits de reparación',
  fragments: 'Fragmentos',
};

export function subcategoryLabel(categoryId, subcategoryId) {
  if (!subcategoryId) return 'Sin subcategoría';
  if (SUBCATEGORY_LABELS[subcategoryId]) return SUBCATEGORY_LABELS[subcategoryId];
  return String(subcategoryId)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toLocaleUpperCase('es') + word.slice(1))
    .join(' ');
}
