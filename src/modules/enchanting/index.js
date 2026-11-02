import { createCalculatorView } from '../crafting/CalculatorView.js';
/* El encantamiento usa el mismo motor: receta de runas/almas/reliquias + impuestos. */
export default createCalculatorView({ moduleId: 'enchanting', scopeLabel: 'Ítems encantables',
  filter: entry => entry.lvl > 0 && entry.upgrade && entry.res.length > 0 });
