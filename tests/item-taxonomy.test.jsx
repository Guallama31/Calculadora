import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../src/settings/index.js';
import { categoryOf, get, search, variants } from '../src/services/catalog.js';
import { classifyItem } from '../src/services/item-taxonomy.js';

describe('Taxonomía del catálogo', () => {
  it('ofrece las 20 categorías de navegación y la categoría técnica de excepciones', () => {
    expect(CATEGORIES.filter(category => category.value).map(category => category.value)).toEqual([
      'weapons',
      'offhands',
      'head-armor',
      'chest-armor',
      'foot-armor',
      'accessories',
      'mounts',
      'consumables',
      'raw-resources',
      'refined-materials',
      'farming',
      'fishing',
      'gathering-gear-tools',
      'crafting-alchemy-materials',
      'artifacts',
      'journals-laborers',
      'furniture-housing',
      'treasures-luxury-goods',
      'vanity-cosmetics',
      'loot-tokens-other',
      'unclassified',
    ]);
  });

  it.each([
    [{ id: 'T4_MAIN_SWORD', cat: 'weapons', sub: 'sword', sub2: 'sword_main_sword' }, 'weapons'],
    [{ id: 'T4_OFF_BOOK', cat: 'offhands', sub: 'booktype' }, 'offhands'],
    [{ id: 'T4_HEAD_CLOTH_SET1', cat: 'head', sub: 'cloth_helmet' }, 'head-armor'],
    [{ id: 'T4_ARMOR_LEATHER_SET1', cat: 'armors', sub: 'leather_armor' }, 'chest-armor'],
    [{ id: 'T4_SHOES_PLATE_SET1', cat: 'shoes', sub: 'plate_shoes' }, 'foot-armor'],
    [{ id: 'T4_BAG', cat: 'bags', sub: 'bags' }, 'accessories'],
    [{ id: 'T4_MOUNT_HORSE', cat: 'mounts', sub: 'basemounts' }, 'mounts'],
    [{ id: 'T4_MEAL_SALAD', cat: 'consumables', sub: 'food' }, 'consumables'],
    [{ id: 'T4_ORE', cat: 'crafting', sub: 'resources' }, 'raw-resources'],
    [{ id: 'T4_METALBAR', cat: 'crafting', sub: 'refinedresources', ccat: 'ore' }, 'refined-materials'],
    [{ id: 'T3_FLOUR', cat: 'farming', sub: 'farmingproducts' }, 'farming'],
    [{ id: 'T4_FISH_FRESHWATER_FOREST_RARE', cat: 'farming' }, 'fishing'],
    [{ id: 'T4_2H_TOOL_PICK', cat: 'gathering', sub: 'ore', ccat: 'tools' }, 'gathering-gear-tools'],
    [{ id: 'T4_ALCHEMY_RARE_DIREBEAR', cat: 'crafting', sub: 'alchemy' }, 'crafting-alchemy-materials'],
    [{ id: 'T4_ARTEFACT_2H_BOW_AVALON', cat: 'artefacts', sub: 'weapons' }, 'artifacts'],
    [{ id: 'T4_JOURNAL_TROPHY_FISHING_FULL', cat: 'other', sub: 'labourers' }, 'journals-laborers'],
    [{ id: 'T4_FURNITUREITEM_BED', cat: 'other', sub: 'labourers' }, 'furniture-housing'],
    [{ id: 'T4_LUXURY_GOOD', cat: 'treasures' }, 'treasures-luxury-goods'],
    [{ id: 'UNIQUE_AVATAR', cat: 'vanity' }, 'vanity-cosmetics'],
    [{ id: 'T4_RANDOM_DUNGEON_TOKEN_1', cat: 'other', sub: 'maps' }, 'loot-tokens-other'],
  ])('clasifica %s', (source, expected) => {
    expect(classifyItem(source).categoryId).toBe(expected);
  });

  it('conserva los datos de tienda y marca explícitamente los casos desconocidos', () => {
    expect(classifyItem({ id: 'UNIQUE_UNKNOWN', cat: 'unmapped' })).toMatchObject({
      categoryId: 'unclassified',
      classificationRule: 'fallback.unclassified',
    });
    expect(categoryOf('T4_BAG')).toMatchObject({
      cat: 'bags',
      categoryId: 'accessories',
      classificationRule: 'shop.bags',
      classificationVersion: 1,
    });
    expect(get('T4_BAG').cat).toBe('bags');
    expect(get('T2_2H_BOW').familyId).toBe('bow_bow');
    expect(search('bow_bow', 10).some(item => item.familyId === 'bow_bow')).toBe(true);
  });

  it('incluye refinados encantados con IDs de mercado y recetas de materiales del mismo encantamiento', () => {
    expect(get('T4_PLANKS_LEVEL1@1')).toMatchObject({
      base: 'T4_PLANKS',
      lvl: 1,
      tier: 4,
      refine: true,
      ccat: 'wood',
    });
    expect(get('T4_PLANKS_LEVEL1@1').res).toEqual([
      expect.objectContaining({ id: 'T4_WOOD_LEVEL1@1', q: 2 }),
      expect.objectContaining({ id: 'T3_PLANKS', q: 1 }),
    ]);
    expect(get('T5_METALBAR_LEVEL2@2')).toMatchObject({
      base: 'T5_METALBAR',
      lvl: 2,
      refine: true,
      ccat: 'ore',
    });
    expect(variants('T4_PLANKS').map(entry => entry.lvl)).toEqual([0, 1, 2, 3, 4]);
    expect(variants('T4_STONEBLOCK').map(entry => entry.lvl)).toEqual([0]);
  });
});
