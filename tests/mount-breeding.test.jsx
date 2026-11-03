import { describe, expect, it } from 'vitest';
import { MOUNT_BREEDING, MOUNT_FOODS } from '../data/catalog.js';
import { calculateBreeding, foodPlan } from '../src/services/mount-breeding.js';

describe('monturas: crianza', () => {
  it('genera alimento estimado editable con la duración y nutrición del juego', () => {
    const horse = MOUNT_BREEDING.find(animal => animal.id === 'T4_FARM_HORSE_BABY');
    const carrot = MOUNT_FOODS.find(food => food.id === 'T1_CARROT');

    expect(horse).toBeTruthy();
    expect(carrot).toBeTruthy();
    expect(foodPlan(horse, carrot)).toEqual({ nutritionRequired: 1440, unitsPerAnimal: 30 });
  });

  it('no inventa favoritos para animales de montura cuando el dump solo declara categorías aceptadas', () => {
    expect(MOUNT_BREEDING.length).toBeGreaterThan(0);
    expect(MOUNT_BREEDING.every(animal => animal.favoriteFoodId === null)).toBe(true);
    expect(MOUNT_BREEDING.every(animal => animal.foodCategories.length > 0)).toBe(true);
  });

  it('calcula costos, promedio esperado, impuestos y órdenes sin aplicar Focus no validado', () => {
    const animal = {
      growTime: 86400,
      secondsPerNutrition: 60,
      offspringChance: 0.5,
      offspringAmount: 1,
      silverCost: 100,
      focusBonus: 0.5,
    };
    const food = { nutrition: 60 };
    const result = calculateBreeding({
      animal,
      food,
      quantity: 2,
      foodUnitsPerAnimal: 3,
      babyPrice: 100,
      foodPrice: 10,
      grownPrice: 1000,
      offspringPrice: 200,
      buyMode: 'order',
      sellMode: 'order',
      premium: true,
    });

    expect(result.expectedOffspring).toBe(1);
    expect(result.foodUnitsPerAnimal).toBe(3);
    expect(result.totalCosts).toBe(467);
    expect(result.salesTax).toBe(88);
    expect(result.setupFee).toBe(55);
    expect(result.profit).toBe(1590);
    expect(result.profitPerDay).toBe(1590);
  });

  it('no cuenta las crías retenidas como ganancia realizada', () => {
    const result = calculateBreeding({
      animal: {
        growTime: 86400,
        secondsPerNutrition: 60,
        offspringChance: 0.5,
        offspringAmount: 1,
        silverCost: 100,
      },
      food: { nutrition: 60 },
      quantity: 2,
      foodUnitsPerAnimal: 3,
      babyPrice: 100,
      foodPrice: 10,
      grownPrice: 1000,
      offspringPrice: 200,
      buyMode: 'order',
      sellMode: 'order',
      offspringMode: 'keep',
      premium: true,
    });

    expect(result.retainedOffspringValue).toBe(200);
    expect(result.offspringNetRevenue).toBe(0);
    expect(result.profit).toBe(1403);
  });
});
