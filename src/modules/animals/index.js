import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'animals', scopeLabel: 'Animales y cría',
  filter: entry => /ANIMAL|MOUNT|FOAL|CALF|LAMB|PIGLET|GOOSE|CHICK|COW|SHEEP|GOAT|HORSE|OX/.test(entry.id) });
