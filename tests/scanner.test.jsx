import { describe, it, expect, beforeEach } from 'vitest';
import { CITIES } from '../src/settings/index.js';
import { installFetch } from './fixtures.js';
import { allCities, neededIds, scan, selectCandidates } from '../src/modules/flipping/scanner.js';

describe('Escáner de flipping', () => {
  beforeEach(() => installFetch());

  it('distribuye el rastreo global entre categorías y ciudades', () => {
    const candidates = selectCandidates({
      globalScan: true,
      strategy: 'flip',
      tiers: [2, 3, 4, 5, 6, 7, 8],
      enchants: [0, 1, 2, 3, 4],
      maxItems: 250,
    });
    expect(candidates).toHaveLength(250);
    expect(new Set(candidates.map(entry => entry.cat)).size).toBeGreaterThan(10);
    expect(new Set(candidates.map(entry => entry.tier)).size).toBeGreaterThan(4);
    expect(allCities({ globalScan: true, strategy: 'flip', buyCity: 'auto', safeOnly: true })).toEqual(
      CITIES.map(city => city.value),
    );
  });

  it('incluye el ítem previo y los materiales requeridos para mejorar', () => {
    const [target] = selectCandidates({
      strategy: 'upgrade',
      category: 'weapons',
      tiers: [4],
      enchants: [1],
      query: 'T4_MAIN_SWORD@1',
      maxItems: 5,
    });
    expect(target?.id).toBe('T4_MAIN_SWORD@1');
    expect(neededIds([target], 'upgrade')).toEqual(
      expect.arrayContaining(['T4_MAIN_SWORD@1', 'T4_MAIN_SWORD', 'T4_RUNE']),
    );
  });

  it('filtra oportunidades por la categoría normalizada del objeto', () => {
    const candidates = selectCandidates({
      strategy: 'flip',
      category: 'weapons',
      tiers: [4],
      enchants: [0, 1, 2, 3, 4],
      query: 'T4_MAIN_SWORD',
      maxItems: 20,
    });
    expect(candidates.map(entry => entry.id)).toEqual(
      expect.arrayContaining([
        'T4_MAIN_SWORD',
        'T4_MAIN_SWORD@1',
        'T4_MAIN_SWORD@2',
        'T4_MAIN_SWORD@3',
        'T4_MAIN_SWORD@4',
      ]),
    );
  });

  it('conserva todos los encantamientos al filtrar con una búsqueda amplia', () => {
    const candidates = selectCandidates({
      strategy: 'flip',
      category: 'weapons',
      tiers: [4],
      enchants: [0, 1, 2, 3, 4],
      query: 'T4',
      maxItems: 250,
    });
    expect(new Set(candidates.map(entry => entry.lvl))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(candidates.map(entry => entry.id)).toContain('T4_MAIN_SWORD@4');
  });

  it('incluye T2 y T3 cuando se consultan candidatos sin filtros de Tier ni Encantamiento', () => {
    const candidates = selectCandidates({
      strategy: 'flip',
      category: 'weapons',
      query: 'T2_2H_BOW',
      maxItems: 20,
    });
    expect(candidates.map(entry => entry.id)).toContain('T2_2H_BOW');
  });

  it('calcula la ganancia de una mejora y aplica la tasa de publicación del Mercado Negro', async () => {
    const result = await scan({
      strategy: 'upgrade',
      category: 'weapons',
      query: 'T4_MAIN_SWORD@1',
      tiers: [4],
      enchants: [1],
      maxItems: 5,
      buyCity: 'Martlock',
      sellCities: ['Black Market'],
      safeOnly: false,
      sameCity: false,
      buyMode: 'instant',
      sellMode: 'order',
      quality: '1',
      server: 'west',
      premium: true,
    });
    expect(result.candidates).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].strategy).toBe('upgrade');
    expect(result.rows[0].sellCity).toBe('Black Market');
    expect(result.rows[0].buyCity).toBe('Martlock');
    expect(result.rows[0].sellMode).toBe('order');
    expect(result.rows[0].materialPrices).toHaveLength(2);
    expect(result.rows[0].costPerUnit).toBeGreaterThan(0);
    expect(result.rows[0].profit).toEqual(expect.any(Number));
    expect(result.rows[0].setupFee).toBeGreaterThan(0);
    expect(result.coverage).toEqual({
      requested: 12,
      quoted: 12,
      missing: 0,
      percent: 100,
    });
  });
});
