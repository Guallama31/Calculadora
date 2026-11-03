import { TAX } from '../settings/index.js';

export const RESOURCE_TYPES = {
  wood: { label: 'Madera', suffix: 'WOOD' },
  ore: { label: 'Mineral', suffix: 'ORE' },
  hide: { label: 'Pieles', suffix: 'HIDE' },
  fiber: { label: 'Fibra', suffix: 'FIBER' },
  rock: { label: 'Piedra', suffix: 'ROCK' },
};

// Cost in silver for one single-step transmutation.
export const ENCHANTMENT_FEES = Object.freeze({
  4: [1500, 3000, 6000, 24012],
  5: [2000, 4000, 8000, 32014],
  6: [3000, 6000, 19800, 79234],
  7: [4800, 15126, 49916, 199673],
  8: [14401, 45378, 149748, 748755],
});

export const TIER_FEES = Object.freeze({
  5: [781, 1563, 3125, 6252, 25011],
  6: [1250, 2500, 5000, 16500, 66050],
  7: [2500, 5000, 15755, 51997, 208002],
  8: [5000, 15000, 47270, 155980, 779948],
});

export function transmutationFee(kind, tier, targetLevel) {
  const table = kind === 'enchantment' ? ENCHANTMENT_FEES : TIER_FEES;
  return table[tier]?.[targetLevel] ?? null;
}

export function buildTransmutationCandidates(refiningEntries) {
  const resources = new Map();
  for (const entry of refiningEntries) {
    const type = RESOURCE_TYPES[entry.ccat];
    if (!entry.refine || !type) continue;
    const prefix = `T${entry.tier}_${type.suffix}`;
    const id = entry.lvl === 0 ? prefix : `${prefix}_LEVEL${entry.lvl}@${entry.lvl}`;
    const material = entry.res?.find(resource => resource.id === id);
    if (!material) continue;
    resources.set(`${entry.ccat}|${entry.tier}|${entry.lvl}`, {
      id,
      es: material.es,
      type: entry.ccat,
      tier: entry.tier,
      level: entry.lvl,
    });
  }

  const candidates = [];
  for (const source of resources.values()) {
    if (source.tier < 4) continue;
    const enchantTarget = resources.get(`${source.type}|${source.tier}|${source.level + 1}`);
    const enchantFee = transmutationFee('enchantment', source.tier, source.level);
    if (enchantTarget && enchantFee != null) {
      candidates.push({
        id: `${source.id}->${enchantTarget.id}`,
        kind: 'enchantment',
        type: source.type,
        source,
        target: enchantTarget,
        fee: enchantFee,
      });
    }

    const tierTarget = resources.get(`${source.type}|${source.tier + 1}|${source.level}`);
    const tierFee = transmutationFee('tier', source.tier + 1, source.level);
    if (tierTarget && tierFee != null) {
      candidates.push({
        id: `${source.id}->${tierTarget.id}`,
        kind: 'tier',
        type: source.type,
        source,
        target: tierTarget,
        fee: tierFee,
      });
    }
  }

  return candidates.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      a.source.tier - b.source.tier ||
      a.source.level - b.source.level ||
      a.kind.localeCompare(b.kind),
  );
}

const ceil = value => Math.ceil(Number(value) || 0);
const round2 = value => Math.round((Number(value) || 0) * 100) / 100;

export function calculateTransmutation({
  quantity = 1,
  inputPrice,
  outputPrice,
  transmutationFee: fee,
  stationFee = 0,
  buyMode = 'instant',
  sellMode = 'order',
  premium = true,
}) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const buy = Number(inputPrice);
  const sell = Number(outputPrice);
  if (!(buy > 0) || !(sell > 0)) return null;

  const inputCost = qty * buy;
  const buyOrderFee = buyMode === 'order' ? ceil(inputCost * TAX.setup) : 0;
  const transmutationCost = qty * Math.max(0, Number(fee) || 0);
  const stationCost = qty * Math.max(0, Number(stationFee) || 0);
  const grossRevenue = qty * sell;
  const salesTax = ceil(grossRevenue * (premium ? TAX.salesPremium : TAX.salesNoPremium));
  const sellOrderFee = sellMode === 'order' ? ceil(grossRevenue * TAX.setup) : 0;
  const totalCosts = inputCost + buyOrderFee + transmutationCost + stationCost;
  const netRevenue = grossRevenue - salesTax - sellOrderFee;
  const profit = round2(netRevenue - totalCosts);

  return {
    quantity: qty,
    inputCost,
    buyOrderFee,
    transmutationCost,
    stationCost,
    grossRevenue,
    salesTax,
    sellOrderFee,
    netRevenue,
    totalCosts,
    profit,
    profitPerUnit: round2(profit / qty),
    roi: totalCosts > 0 ? round2((profit / totalCosts) * 100) : 0,
  };
}
