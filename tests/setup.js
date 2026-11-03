import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearPriceCache } from '../src/services/api.js';
import { initializeCatalog } from '../src/services/catalog.js';
import { CATALOG, MOUNT_BREEDING, MOUNT_FOODS } from '../data/catalog.js';

/* La app carga el catálogo con import() dinámico desde `main.jsx`; en las
   pruebas se inicializa aquí para que los componentes lo encuentren listo. */
initializeCatalog({ CATALOG, MOUNT_BREEDING, MOUNT_FOODS });

if (typeof globalThis.localStorage === 'undefined') {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: key => values.get(String(key)) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => values.delete(String(key)),
      setItem: (key, value) => values.set(String(key), String(value)),
    },
  });
}

window.scrollTo = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
Element.prototype.scrollIntoView = () => {};

afterEach(async () => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  await clearPriceCache();
});
