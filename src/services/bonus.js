/* Bonus de producción por ciudad → RRR (ao-bin-dumps/craftingmodifiers.json). */
import { TAX } from '../settings/index.js';

const CITY_BONUS = {
  Thetford: {
    refining: 0.18,
    crafting: 0.18,
    mods: {
      ore: 0.4,
      meat_pig: 0.1,
      mace: 0.15,
      naturestaff: 0.15,
      firestaff: 0.15,
      leather_armor: 0.15,
      cloth_helmet: 0.15,
    },
  },
  Lymhurst: {
    refining: 0.18,
    crafting: 0.18,
    mods: {
      fiber: 0.4,
      meat_goose: 0.1,
      sword: 0.15,
      bow: 0.15,
      arcanestaff: 0.15,
      leather_helmet: 0.15,
      leather_shoes: 0.15,
    },
  },
  Bridgewatch: {
    refining: 0.18,
    crafting: 0.18,
    mods: {
      rock: 0.4,
      meat_goat: 0.1,
      crossbow: 0.15,
      dagger: 0.15,
      cursestaff: 0.15,
      plate_armor: 0.15,
      cloth_shoes: 0.15,
    },
  },
  Martlock: {
    refining: 0.18,
    crafting: 0.18,
    mods: {
      hide: 0.4,
      meat_cow: 0.1,
      axe: 0.15,
      quarterstaff: 0.15,
      froststaff: 0.15,
      plate_shoes: 0.15,
      offhand: 0.15,
    },
  },
  'Fort Sterling': {
    refining: 0.18,
    crafting: 0.18,
    mods: {
      wood: 0.4,
      meat_chicken: 0.1,
      meat_sheep: 0.1,
      hammer: 0.15,
      spear: 0.15,
      holystaff: 0.15,
      plate_helmet: 0.15,
      cloth_armor: 0.15,
    },
  },
  Caerleon: {
    refining: 0.18,
    crafting: 0.18,
    mods: { gatherergear: 0.15, tools: 0.15, food: 0.15, knuckles: 0.15, shapeshifterstaff: 0.15 },
  },
  Brecilien: { refining: 0.18, crafting: 0.18, mods: { cape: 0.15, bag: 0.15, potion: 0.15 } },
  Hideout: {
    refining: 0.15,
    crafting: 0.18,
    mods: {
      axe: 0.15,
      crossbow: 0.15,
      hammer: 0.15,
      mace: 0.15,
      sword: 0.15,
      knuckles: 0.15,
      plate_helmet: 0.15,
      plate_armor: 0.15,
      plate_shoes: 0.15,
    },
  },
  Island: { refining: 0, crafting: 0, mods: {} },
};

export function cityData(city) {
  return CITY_BONUS[city] || CITY_BONUS.Island;
}

export function bonusFor({ city, ccat = '', isRefining = false, focus = false, dailyBonusPct = 0 }) {
  const data = cityData(city);
  const base = isRefining ? data.refining : data.crafting;
  const modifier = data.mods[ccat] || 0;
  const focusBonus = focus ? TAX.focusBonus : 0;
  const daily = Math.max(0, Number(dailyBonusPct) || 0) / 100;
  const total = Math.max(0, base + modifier + focusBonus + daily);
  return { base, modifier, focus: focusBonus, daily, total, rrrPct: (total / (1 + total)) * 100 };
}

export function bestCityFor(ccat, isRefining = false) {
  let best = null;
  for (const [city, data] of Object.entries(CITY_BONUS)) {
    if (city === 'Island' || city === 'Hideout') continue;
    const value = (isRefining ? data.refining : data.crafting) + (data.mods[ccat] || 0);
    if (!best || value > best.value) best = { city, value };
  }
  return best ? best.city : 'Thetford';
}

export function cityLabel(city) {
  if (city === 'auto') return 'Automática';
  if (city === 'Black Market') return 'Mercado Negro';
  if (city === 'Varias') return 'Mejor precio';
  if (city === 'Hideout') return 'Refugio';
  if (city === 'Island') return 'Isla';
  return city;
}
