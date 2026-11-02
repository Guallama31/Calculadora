import { createCalculatorView } from '../crafting/CalculatorView.js';
export default createCalculatorView({ moduleId: 'mounts', scopeLabel: 'Monturas',
  filter: entry => entry.cat === 'mounts' || /^T[0-9]_MOUNT/.test(entry.id) });
