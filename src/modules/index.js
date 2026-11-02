/* Registro de módulos: cada uno expone { meta, render(ctx), mount(root, ctx) }. */
import { MODULES } from '../settings/index.js';
import crafting from './crafting/index.js';
import enchanting from './enchanting/index.js';
import refining from './refining/index.js';
import farming from './farming/index.js';
import animals from './animals/index.js';
import mounts from './mounts/index.js';
import alchemy from './alchemy/index.js';
import cooking from './cooking/index.js';
import * as flipping from './flipping/index.js';
import * as prices from './prices/index.js';

const meta = id => MODULES.find(m => m.id === id);

export const modules = {
  crafting, enchanting, refining, farming, animals, mounts, alchemy, cooking,
  flipping: { meta: meta('flipping'), render: flipping.render, mount: flipping.mount },
  prices: { meta: meta('prices'), render: prices.render, mount: prices.mount },
};
export const moduleIds = Object.keys(modules);
