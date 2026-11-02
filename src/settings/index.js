/* Configuración global: servidores, ciudades, impuestos, módulos y categorías. */
export const APP_NAME = 'Calculadora';
export const STORAGE_KEY = 'calculadora-prefs-v1';

export const SERVERS = [
  { value: 'west', label: 'Américas (West)' },
  { value: 'east', label: 'Asia (East)' },
  { value: 'europe', label: 'Europa' },
];

export const QUALITIES = [
  { value: '1', label: 'Normal' }, { value: '2', label: 'Buena' },
  { value: '3', label: 'Destacada' }, { value: '4', label: 'Excelente' },
  { value: '5', label: 'Obra maestra' },
];

export const CITIES = [
  { value: 'Thetford', label: 'Thetford' },
  { value: 'Lymhurst', label: 'Lymhurst' },
  { value: 'Bridgewatch', label: 'Bridgewatch' },
  { value: 'Martlock', label: 'Martlock' },
  { value: 'Fort Sterling', label: 'Fort Sterling' },
  { value: 'Caerleon', label: 'Caerleon' },
  { value: 'Brecilien', label: 'Brecilien' },
  { value: 'Black Market', label: 'Mercado Negro' },
];
export const ROYAL_CITIES = CITIES.slice(0, 7).map(c => c.value);
export const SAFE_CITIES = ROYAL_CITIES.slice(0, 5);
export const BLACK_MARKET = 'Black Market';

export const CRAFT_CITIES = [
  { value: 'auto', label: 'Automática (mejor bonus)' },
  ...CITIES.slice(0, 7).map(c => ({ value: c.value, label: c.label })),
  { value: 'Hideout', label: 'Refugio (Arthur’s Rest)' },
  { value: 'Island', label: 'Isla personal (sin bonus)' },
];

export const TAX = Object.freeze({
  salesPremium: 0.04,
  salesNoPremium: 0.08,
  setup: 0.025,
  focusBonus: 0.59,
  nutritionPerItemValue: 0.1125,
});

export const CATEGORIES = [
  { value: '', label: 'Todas las categorías' },
  { value: 'weapons', label: 'Armas' },
  { value: 'armors', label: 'Armaduras' },
  { value: 'head', label: 'Cascos' },
  { value: 'shoes', label: 'Botas' },
  { value: 'offhands', label: 'Mano izquierda' },
  { value: 'capes', label: 'Capas' },
  { value: 'bags', label: 'Bolsas' },
  { value: 'artefacts', label: 'Artefactos' },
  { value: 'consumables', label: 'Consumibles' },
  { value: 'gathering', label: 'Herramientas' },
  { value: 'mounts', label: 'Monturas' },
  { value: 'crafting', label: 'Materiales refinados' },
  { value: 'farming', label: 'Agricultura' },
  { value: 'other', label: 'Otros' },
  { value: 'furniture', label: 'Mobiliario' },
];

export const MODULES = [
  { id: 'crafting', label: 'Crafteo', icon: '⚒', group: 'Producción', description: 'Calculá la rentabilidad real de fabricar un ítem: receta, materiales, impuestos, diarios y tasa de estación.' },
  { id: 'enchanting', label: 'Encantamiento', icon: '✦', group: 'Producción', description: 'Compará el coste de mejorar un ítem con runas, almas o reliquias frente al precio del ítem encantado.' },
  { id: 'refining', label: 'Refinamiento', icon: '▤', group: 'Producción', description: 'Refiná recursos en la ciudad con bonus de producción y calculá la devolución por RRR.' },
  { id: 'farming', label: 'Agricultura', icon: '❀', group: 'Producción', description: 'Recetas de cultivo y productos agrícolas con precios por ciudad.' },
  { id: 'animals', label: 'Animales', icon: '❖', group: 'Producción', description: 'Calculadora de margen para cría y venta de animales con tus propios valores.' },
  { id: 'mounts', label: 'Monturas', icon: '◈', group: 'Producción', description: 'Coste de fabricación de monturas y comparación con su precio de mercado.' },
  { id: 'alchemy', label: 'Alquimia', icon: '⚗', group: 'Producción', description: 'Pociones y consumibles alquímicos: recetas, impuestos y ganancia.' },
  { id: 'cooking', label: 'Cocina', icon: '◍', group: 'Producción', description: 'Comida y platos cocinados con recetas reales del juego.' },
  { id: 'flipping', label: 'Flipping', icon: '⇄', group: 'Mercado', description: 'Encontrá oportunidades: flip entre ciudades, Royal → Mercado Negro, crafteo y refinamiento.' },
  { id: 'prices', label: 'Precios', icon: '▦', group: 'Mercado', description: 'Precios de un ítem en todas las ciudades, con antigüedad y comparativa visual.' },
];

export const GROUPS = ['Producción', 'Mercado'];
export const DEFAULTS = {
  server: 'west', quality: '1', premium: true,
  craftCity: 'Thetford', buyCity: 'Martlock', sellCity: 'Lymhurst',
  buyMode: 'instant', sellMode: 'order', rrrMode: 'auto',
  focus: false, dailyBonus: 0, stationFee: 0, syncBuyCity: true,
  collapsed: false,
};
