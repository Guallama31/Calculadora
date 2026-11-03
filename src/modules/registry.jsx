import CalculatorView from './crafting/CalculatorView.jsx';
import ScannerView from './flipping/ScannerView.jsx';
import PricesView from './prices/PricesView.jsx';
import MountsView from './mounts/MountsView.jsx';
import * as catalog from '../services/catalog.js';

const calculator = (moduleId, scopeLabel, filter) =>
  function ModuleView(props) {
    return <CalculatorView moduleId={moduleId} scopeLabel={scopeLabel} filter={filter} {...props} />;
  };

export const modules = {
  crafting: calculator('crafting', 'Recetas de Crafteo', entry => !entry.refine),
  enchanting: calculator('enchanting', 'Ítems encantables', catalog.isEnchantableBase),
  refining: calculator('refining', 'Recursos refinados', e => e.refine === true),
  farming: calculator(
    'farming',
    'Agricultura y alimentos',
    e =>
      ['farming', 'consumables'].includes(e.categoryId) ||
      /FARM|CARROT|POTATO|BEAN|WHEAT|CORN|PUMPKIN|COOK|PIE|SALAD|SOUP|STEW|OMELETTE|MEAL/.test(e.id),
  ),
  animals: calculator('animals', 'Animales y cría', e =>
    /ANIMAL|MOUNT|FOAL|CALF|LAMB|PIGLET|GOOSE|CHICK|COW|SHEEP|GOAT|HORSE|OX/.test(e.id),
  ),
  mounts: MountsView,
  alchemy: calculator(
    'alchemy',
    'Pociones y alquimia',
    e => e.categoryId === 'consumables' || /POTION|ELIXIR|POISON|TONIC|PHIAL/.test(e.id),
  ),
  cooking: calculator(
    'cooking',
    'Cocina y comida',
    e =>
      /COOKED|FOOD_|MEAL|PIE|SOUP|STEW|SALAD|SANDWICH|OMELETTE|CAKE|BREAD|FISH_/.test(e.id) ||
      e.ccat === 'food',
  ),
  flipping: ScannerView,
  prices: PricesView,
};
export const moduleIds = Object.keys(modules);
