/* Motor de cálculo puro (sin DOM): crafteo y flipping.
   Impuestos: 4 % Premium / 8 % sin Premium; 2,5 % de orden de venta/compra. */
import { TAX } from '../settings/index.js';

const round2 = v => Math.round((Number(v) || 0) * 100) / 100;
const ceil = v => Math.ceil(Number(v) || 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));

function compute(input, premium) {
  const item = input.item;
  const runs = Math.max(1, Math.floor(input.runs || 1));
  const amount = Math.max(1, item.amount || 1);
  const outputQty = runs * amount;
  const rrr = clamp(input.rrrPct, 0, 100) / 100;

  const resources = (input.resources || []).map(resource => {
    const qtyPerRun = Math.max(0, Number(resource.q) || 0);
    const price = Math.max(0, Number(resource.price) || 0);
    const grossQty = qtyPerRun * runs;
    let expected = 0;
    if (resource.ret !== false && grossQty > 0 && rrr > 0) {
      expected = grossQty * rrr;
      if (resource.max != null && Number(resource.max) > 0) {
        expected = Math.min(expected, Number(resource.max) * runs);
      }
    }
    const netQty = Math.max(0, grossQty - expected);
    return {
      id: resource.id, es: resource.es, qtyPerRun,
      grossQty: round2(grossQty), expected: round2(expected), netQty: round2(netQty),
      price, grossCost: round2(grossQty * price), netCost: round2(netQty * price),
      ret: resource.ret !== false,
    };
  });

  const grossMaterials = round2(resources.reduce((s, r) => s + r.grossCost, 0));
  const netMaterials = round2(resources.reduce((s, r) => s + r.netCost, 0));
  const returnedValue = round2(grossMaterials - netMaterials);
  const nonReturnable = round2(resources.filter(r => !r.ret).reduce((s, r) => s + r.netCost, 0));

  const station = input.station || {};
  const itemValue = Math.max(0, Number(input.itemValue) || 0);
  const nutritionPerRun = itemValue * TAX.nutritionPerItemValue;
  const nutritionTotal = nutritionPerRun * runs;
  const stationFee = station.mode === 'fixed'
    ? ceil(station.fixed)
    : ceil((Math.max(0, Number(station.feePer100) || 0) * nutritionTotal) / 100);

  const buyOrderFee = input.buyMode === 'order' && input.buyOrderFee ? ceil(netMaterials * TAX.setup) : 0;

  let journal = null;
  let journalCost = 0;
  let journalRevenue = 0;
  if (input.journal?.enabled) {
    const famePerRun = Math.max(0, Number(input.journal.fame) || 0);
    const maxFame = Math.max(1, Number(input.journal.max) || 1);
    const totalFame = famePerRun * runs;
    const required = Math.ceil(totalFame / maxFame);
    const full = Math.floor(totalFame / maxFame);
    const partialPct = (totalFame % maxFame) / maxFame * 100;
    journalCost = round2(required * Math.max(0, Number(input.journal.emptyPrice) || 0));
    journalRevenue = round2(full * Math.max(0, Number(input.journal.fullPrice) || 0));
    journal = { totalFame: round2(totalFame), required, full, partialPct: round2(partialPct), cost: journalCost, revenue: journalRevenue };
  }

  const otherCosts = Math.max(0, Number(input.otherCosts) || 0);
  const totalCosts = round2(netMaterials + stationFee + buyOrderFee + journalCost + otherCosts);

  const salesTaxRate = premium ? TAX.salesPremium : TAX.salesNoPremium;
  const sellPrice = Math.max(0, Number(input.sellPrice) || 0);
  const grossRevenue = round2(outputQty * sellPrice);
  const salesTax = ceil(grossRevenue * salesTaxRate);
  const relists = Math.max(0, Math.floor(input.relists || 0));
  const setupFee = input.sellMode === 'order' ? ceil(grossRevenue * TAX.setup) * (1 + relists) : 0;
  const salesRevenueNet = round2(grossRevenue - salesTax - setupFee);
  const profit = round2(salesRevenueNet + journalRevenue - totalCosts);
  const roi = totalCosts > 0 ? round2(profit / totalCosts * 100) : 0;
  const profitPerItem = outputQty > 0 ? round2(profit / outputQty) : 0;
  const taxMultiplier = 1 - salesTaxRate - (input.sellMode === 'order' ? TAX.setup * (1 + relists) : 0);
  const breakEven = outputQty > 0 && taxMultiplier > 0
    ? round2((totalCosts - journalRevenue) / outputQty / taxMultiplier) : null;

  return {
    premium, runs, amount, outputQty, rrrPct: rrr * 100, resources,
    grossMaterials, netMaterials, returnedValue, nonReturnable,
    itemValue, nutritionPerRun: round2(nutritionPerRun), nutritionTotal: round2(nutritionTotal),
    stationFee, buyOrderFee, journal, journalCost, journalRevenue, otherCosts, totalCosts,
    sellPrice, grossRevenue, salesTaxRate, salesTax, setupFee, relists, salesRevenueNet,
    profit, roi, profitPerItem, breakEven, taxMultiplier,
  };
}

export function calculate(input) {
  const result = compute(input, !!input.premium);
  const yes = compute(input, true);
  const no = compute(input, false);
  result.premiumComparison = {
    withPremium: yes.profit, withoutPremium: no.profit,
    delta: round2(yes.profit - no.profit), taxSaved: round2(no.salesTax - yes.salesTax),
  };
  return result;
}

function computeFlip(input, premium) {
  const qty = Math.max(1, Math.floor(input.qty || 1));
  const buyPrice = Math.max(0, Number(input.buyPrice) || 0);
  const sellPrice = Math.max(0, Number(input.sellPrice) || 0);
  const buyCost = round2(qty * buyPrice);
  const buyOrderFee = input.buyMode === 'order' ? ceil(buyCost * TAX.setup) : 0;
  const transport = Math.max(0, Number(input.transport) || 0);
  const totalCosts = round2(buyCost + buyOrderFee + transport);
  const salesTaxRate = premium ? TAX.salesPremium : TAX.salesNoPremium;
  const grossRevenue = round2(qty * sellPrice);
  const salesTax = ceil(grossRevenue * salesTaxRate);
  const relists = Math.max(0, Math.floor(input.relists || 0));
  const setupFee = input.sellMode === 'order' ? ceil(grossRevenue * TAX.setup) * (1 + relists) : 0;
  const salesRevenueNet = round2(grossRevenue - salesTax - setupFee);
  const profit = round2(salesRevenueNet - totalCosts);
  const roi = totalCosts > 0 ? round2(profit / totalCosts * 100) : 0;
  const margin = grossRevenue > 0 ? round2(profit / grossRevenue * 100) : 0;
  const taxMultiplier = 1 - salesTaxRate - (input.sellMode === 'order' ? TAX.setup * (1 + relists) : 0);
  const breakEven = qty > 0 && taxMultiplier > 0 ? round2(totalCosts / qty / taxMultiplier) : null;
  return { qty, buyPrice, sellPrice, buyCost, buyOrderFee, transport, totalCosts, grossRevenue,
    salesTaxRate, salesTax, setupFee, salesRevenueNet, profit, roi, margin, breakEven, premium };
}

export function calculateFlip(input) {
  const result = computeFlip(input, !!input.premium);
  const yes = computeFlip(input, true);
  const no = computeFlip(input, false);
  result.premiumComparison = { withPremium: yes.profit, withoutPremium: no.profit,
    delta: round2(yes.profit - no.profit), taxSaved: round2(no.salesTax - yes.salesTax) };
  return result;
}

export { TAX };
