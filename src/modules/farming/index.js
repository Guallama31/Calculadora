import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'farming', scopeLabel: 'Agricultura y alimentos',
  filter: entry => ['farming', ' consumables'].includes(entry.cat) || /FARM|CARROT|POTATO|BEAN|WHEAT|CORN|PUMPKIN|COOK|PIE|SALAD|SOUP|STEW|OMELETTE|MEAL/.test(entry.id) });
