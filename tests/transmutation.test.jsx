import { describe, expect, it } from 'vitest';
import {
  buildTransmutationCandidates, calculateTransmutation, transmutationFee,
} from '../src/services/transmutation.js';

describe('transmutación de recursos', () => {
  it('usa la tasa incremental correcta para subir encantamiento o tier', () => {
    expect(transmutationFee('enchantment', 6, 2)).toBe(19800);
    expect(transmutationFee('tier', 5, 2)).toBe(3125);
    expect(transmutationFee('tier', 4, 0)).toBeNull();
  });

  it('genera conversiones solo cuando ambos recursos existen en las recetas', () => {
    const entries = [
      { refine: true, ccat: 'wood', tier: 4, lvl: 0, res: [{ id: 'T4_WOOD', es: 'Tronco T4' }] },
      { refine: true, ccat: 'wood', tier: 4, lvl: 1, res: [{ id: 'T4_WOOD_LEVEL1@1', es: 'Tronco T4.1' }] },
      { refine: true, ccat: 'wood', tier: 5, lvl: 0, res: [{ id: 'T5_WOOD', es: 'Tronco T5' }] },
    ];
    const candidates = buildTransmutationCandidates(entries);
    expect(candidates.map(candidate => [candidate.source.id, candidate.target.id, candidate.fee]))
      .toEqual([
        ['T4_WOOD', 'T4_WOOD_LEVEL1@1', 1500],
        ['T4_WOOD', 'T5_WOOD', 781],
      ]);
  });

  it('descuenta tasa de transmutación, cargo del puesto e impuestos según la forma de mercado', () => {
    const result = calculateTransmutation({
      quantity: 2, inputPrice: 1000, outputPrice: 2000, transmutationFee: 100,
      stationFee: 50, buyMode: 'instant', sellMode: 'order', premium: true,
    });
    expect(result).toMatchObject({
      inputCost: 2000, transmutationCost: 200, stationCost: 100,
      salesTax: 160, sellOrderFee: 100, profit: 1440, profitPerUnit: 720,
    });
    expect(calculateTransmutation({
      inputPrice: 0, outputPrice: 2000, transmutationFee: 100,
    })).toBeNull();
    expect(calculateTransmutation({
      quantity: 1, inputPrice: 1000, outputPrice: 2000, transmutationFee: 100,
      buyMode: 'order', sellMode: 'instant', premium: false,
    })).toMatchObject({ buyOrderFee: 25, salesTax: 160, sellOrderFee: 0, profit: 715 });
  });
});
