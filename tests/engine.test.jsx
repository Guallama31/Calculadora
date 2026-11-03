import { describe, expect, it } from 'vitest';
import { calculate, calculateFlip } from '../src/services/engine.js';

const item = { id: 'T4_BAG', es: 'Bolsa', amount: 1, value: 100 };
const baseInput = {
  item,
  runs: 1,
  rrrPct: 0,
  itemValue: 100,
  station: { mode: 'fixed', fixed: 0 },
  resources: [
    { id: 'T4_CLOTH', es: 'Tela', q: 8, price: 100 },
    { id: 'T4_LEATHER', es: 'Cuero', q: 8, price: 100 },
  ],
  buyMode: 'instant',
  sellMode: 'instant',
  sellPrice: 0,
  premium: true,
};

describe('motor de crafteo', () => {
  it('devuelve el RRR esperado sobre los materiales retornables', () => {
    const result = calculate({ ...baseInput, rrrPct: 50 });
    expect(result.grossMaterials).toBe(1600);
    expect(result.returnedValue).toBe(800);
    expect(result.netMaterials).toBe(800);
    expect(result.resources[0]).toMatchObject({ qtyPerRun: 8, grossQty: 8, expected: 4, netQty: 4 });
  });

  it('no aplica retorno a materiales no retornables ni supera el máximo por receta', () => {
    const result = calculate({
      ...baseInput,
      rrrPct: 50,
      resources: [
        { id: 'A', q: 8, price: 100, ret: false },
        { id: 'B', q: 8, price: 100, max: 2 },
      ],
    });
    const [notReturnable, capped] = result.resources;
    expect(notReturnable.expected).toBe(0);
    expect(notReturnable.netQty).toBe(8);
    expect(capped.expected).toBe(2);
    expect(result.nonReturnable).toBe(800);
  });

  it('convierte la nutrición en tasa de estación y la redondea hacia arriba', () => {
    const result = calculate({
      ...baseInput,
      itemValue: 1000,
      station: { mode: 'nutrition', feePer100: 3 },
    });
    expect(result.nutritionPerRun).toBe(112.5);
    expect(result.stationFee).toBe(4);
  });

  it('calcula diarios completos e incompletos sin regalar plata', () => {
    const result = calculate({
      ...baseInput,
      runs: 20,
      resources: [{ id: 'T4_CLOTH', q: 1, price: 10 }],
      journal: { enabled: true, fame: 48, max: 900, emptyPrice: 100, fullPrice: 1000 },
      sellPrice: 0,
    });
    expect(result.journal.totalFame).toBe(960);
    expect(result.journal.required).toBe(2);
    expect(result.journal.full).toBe(1);
    expect(result.journalCost).toBe(200);
    expect(result.journalRevenue).toBe(1000);
  });

  it('cobra la tarifa de orden por cada republicación', () => {
    const result = calculate({
      ...baseInput,
      sellPrice: 100,
      sellMode: 'order',
      relists: 2,
    });
    expect(result.setupFee).toBe(3 * Math.ceil(100 * 0.025));
    expect(result.salesTax).toBe(Math.ceil(100 * 0.04));
    expect(result.salesRevenueNet).toBe(100 - 3 * Math.ceil(2.5) - 4);
  });

  it('calcula el precio de equilibrio descontando impuestos y diarios', () => {
    const result = calculate({ ...baseInput, sellPrice: 200, sellMode: 'order', relists: 0 });
    const expected = (result.totalCosts - result.journalRevenue) / result.outputQty / (1 - 0.04 - 0.025);
    expect(result.breakEven).toBe(Math.round(expected * 100) / 100);
  });

  it('compara Premium y sin Premium con el mismo insumo', () => {
    const result = calculate({ ...baseInput, sellPrice: 200 });
    expect(result.premiumComparison.withPremium).toBeGreaterThan(result.premiumComparison.withoutPremium);
    /* 200 de venta: 4 % = 8 con Premium, 8 % = 16 sin Premium. */
    expect(result.premiumComparison.delta).toBe(8);
    expect(result.premiumComparison.taxSaved).toBe(8);
  });

  it('no divide por cero cuando no hay costos ni ventas', () => {
    const result = calculate({
      ...baseInput,
      resources: [],
      station: { mode: 'fixed', fixed: 0 },
      sellPrice: 0,
    });
    expect(result.totalCosts).toBe(0);
    expect(result.roi).toBe(0);
    expect(result.breakEven).toBe(0);
    expect(Number.isFinite(result.profit)).toBe(true);
  });
});

describe('motor de flipping', () => {
  it('descuenta impuesto de venta y calcula ROI, margen y equilibrio', () => {
    const result = calculateFlip({
      qty: 10,
      buyPrice: 100,
      sellPrice: 150,
      buyMode: 'instant',
      sellMode: 'instant',
      premium: true,
    });
    expect(result.grossRevenue).toBe(1500);
    expect(result.salesTax).toBe(60);
    expect(result.profit).toBe(440);
    expect(result.roi).toBe(44);
    expect(result.margin).toBe(29.33);
    expect(result.breakEven).toBe(104.17);
  });

  it('suma la tarifa de orden de compra y el transporte', () => {
    const result = calculateFlip({
      qty: 10,
      buyPrice: 100,
      sellPrice: 150,
      buyMode: 'order',
      sellMode: 'order',
      premium: false,
      transport: 50,
    });
    expect(result.buyOrderFee).toBe(Math.ceil(1000 * 0.025));
    expect(result.totalCosts).toBe(1000 + 25 + 50);
    expect(result.salesTax).toBe(Math.ceil(1500 * 0.08));
  });
});
