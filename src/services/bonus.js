/* Bonus de producción por ciudad → RRR (ao-bin-dumps/craftingmodifiers.json). */
import { TAX } from '../settings/index.js';

const CITY_BONUS = {
  Thetford: { refining: .18, crafting: .18, mods: { ore: .40, meat_pig: .10, mace: .15, naturestaff: .15, firestaff: .15, leather_armor: .15, cloth_helmet: .15 } },
  Lymhurst: { refining: .18, crafting: .18, mods: { fiber: .40, meat_goose: .10, sword: .15, bow: .15, arcanestaff: .15, leather_helmet: .15, leather_shoes: .15 } },
  Bridgewatch: { refining: .18, crafting: .18, mods: { rock: .40, meat_goat: .10, crossbow: .15, dagger: .15, cursestaff: .15, plate_armor: .15, cloth_shoes: .15 } },
  Martlock: { refining: .18, crafting: .18, mods: { hide: .40, meat_cow: .10, axe: .15, quarterstaff: .15, froststaff: .15, plate_shoes: .15, offhand: .15 } },
  'Fort Sterling': { refining: .18, crafting: .18, mods: { wood: .40, meat_chicken: .10, meat_sheep: .10, hammer: .15, spear: .15, holystaff: .15, plate_helmet: .15, cloth_armor: .15 } },
  Caerleon: { refining: .18, crafting: .18, mods: { gatherergear: .15, tools: .15, food: .15, knuckles: .15, shapeshifterstaff: .15 } },
  Brecilien: { refining: .18, crafting: .18, mods: { cape: .15, bag: .15, potion: .15 } },
  Hideout: { refining: .15, crafting: .18, mods: { axe: .15, crossbow: .15, hammer: .15, mace: .15, sword: .15, knuckles: .15, plate_helmet: .15, plate_armor: .15, plate_shoes: .15 } },
  Island: { refining: 0, crafting: 0, mods: {} },
};

export function cityData(city) { return CITY_BONUS[city] || CITY_BONUS.Island; }

export function bonusFor({ city, ccat = '', isRefining = false, focus = false, dailyBonusPct = 0 }) {
  const data = cityData(city);
  const base = isRefining ? data.refining : data.crafting;
  const modifier = data.mods[ccat] || 0;
  const focusBonus = focus ? TAX.focusBonus : 0;
  const daily = Math.max(0, Number(dailyBonusPct) || 0) / 100;
  const total = Math.max(0, base + modifier + focusBonus + daily);
  return { base, modifier, focus: focusBonus, daily, total, rrrPct: total / (1 + total) * 100 };
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
