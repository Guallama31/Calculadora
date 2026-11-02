import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'alchemy', scopeLabel: 'Pociones y alquimia',
  filter: entry => entry.cat === 'consumables' || /POTION|ELIXIR|POISON|TONIC|PHIAL/.test(entry.id) });
