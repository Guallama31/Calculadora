import { TAX } from '../settings/index.js';

const ceil = value => Math.ceil(Number(value) || 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const round2 = value => Math.round((Number(value) || 0) * 100) / 100;

export function foodPlan(animal, food) {
  const growTime = Math.max(0, Number(animal?.growTime) || 0);
  const secondsPerNutrition = Math.max(0, Number(animal?.secondsPerNutrition) || 0);
  const nutrition = Math.max(0, Number(food?.nutrition) || 0);
  if (!growTime || !secondsPerNutrition || !nutrition) {
    return { nutritionRequired: 0, unitsPerAnimal: 0 };
  }
  const nutritionRequired = Math.ceil(growTime / secondsPerNutrition);
  return {
    nutritionRequired,
    unitsPerAnimal: Math.ceil(nutritionRequired / nutrition),
  };
}

export function calculateBreeding({
  animal,
  food,
  quantity = 1,
  foodUnitsPerAnimal,
  babyPrice = 0,
  foodPrice = 0,
  grownPrice = 0,
  offspringPrice = 0,
  buyMode = 'instant',
  sellMode = 'order',
  offspringMode = 'sell',
  premium = true,
}) {
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  const plan = foodPlan(animal, food);
  const feedUnits = Math.max(0, Math.floor(Number(foodUnitsPerAnimal ?? plan.unitsPerAnimal) || 0));
  const offspringChance = clamp(animal?.offspringChance, 0, 1);
  const offspringPerAnimal = offspringChance * Math.max(0, Number(animal?.offspringAmount) || 0);
  const expectedOffspring = round2(offspringPerAnimal * count);
  const unitBabyCost = Math.max(0, Number(babyPrice) || 0);
  const unitFoodCost = Math.max(0, Number(foodPrice) || 0);
  const unitGrownPrice = Math.max(0, Number(grownPrice) || 0);
  const unitOffspringPrice = Math.max(0, Number(offspringPrice) || 0);
  const babyCost = round2(unitBabyCost * count);
  const foodCost = round2(unitFoodCost * feedUnits * count);
  const silverCost = round2(Math.max(0, Number(animal?.silverCost) || 0) * count);
  const inputCosts = round2(babyCost + foodCost);
  const buyOrderFee = buyMode === 'order' ? ceil(inputCosts * TAX.setup) : 0;
  const totalCosts = round2(inputCosts + silverCost + buyOrderFee);

  const grownRevenue = round2(unitGrownPrice * count);
  const offspringGross = round2(unitOffspringPrice * expectedOffspring);
  const offspringSold = offspringMode === 'sell';
  const salesTaxRate = premium ? TAX.salesPremium : TAX.salesNoPremium;
  const grownTax = ceil(grownRevenue * salesTaxRate);
  const offspringTax = offspringSold ? ceil(offspringGross * salesTaxRate) : 0;
  const grownSetupFee = sellMode === 'order' ? ceil(grownRevenue * TAX.setup) : 0;
  const offspringSetupFee = offspringSold && sellMode === 'order' ? ceil(offspringGross * TAX.setup) : 0;
  const salesTax = grownTax + offspringTax;
  const setupFee = grownSetupFee + offspringSetupFee;
  const grownNetRevenue = round2(grownRevenue - grownTax - grownSetupFee);
  const offspringNetRevenue = offspringSold ? round2(offspringGross - offspringTax - offspringSetupFee) : 0;
  const retainedOffspringValue = offspringSold ? 0 : offspringGross;
  const revenue = round2(grownNetRevenue + offspringNetRevenue);
  const profit = round2(revenue - totalCosts);
  const roi = totalCosts > 0 ? round2((profit / totalCosts) * 100) : 0;
  const growthDays = Number(animal?.growTime) > 0 ? Number(animal.growTime) / 86400 : 0;

  return {
    count,
    foodUnitsPerAnimal: feedUnits,
    totalFoodUnits: feedUnits * count,
    nutritionRequiredPerAnimal: plan.nutritionRequired,
    offspringChance,
    expectedOffspring,
    offspringMode,
    grownRevenue,
    grownNetRevenue,
    offspringGross,
    offspringNetRevenue,
    retainedOffspringValue,
    salesTax,
    setupFee,
    babyCost,
    foodCost,
    silverCost,
    buyOrderFee,
    totalCosts,
    revenue,
    profit,
    roi,
    growthDays: round2(growthDays),
    profitPerDay: growthDays > 0 ? round2(profit / growthDays) : 0,
  };
}
