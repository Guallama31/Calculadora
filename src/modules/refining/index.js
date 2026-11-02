import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'refining', scopeLabel: 'Recursos refinados',
  filter: entry => entry.refine === true });
