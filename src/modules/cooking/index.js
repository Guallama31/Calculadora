import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'cooking', scopeLabel: 'Cocina y comida',
  filter: entry => /COOKED|FOOD_|MEAL|PIE|SOUP|STEW|SALAD|SANDWICH|OMELETTE|CAKE|BREAD|FISH_/.test(entry.id) || entry.ccat === 'food' });
