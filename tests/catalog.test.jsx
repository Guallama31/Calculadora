import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as catalog from '../src/services/catalog.js';
import { CATALOG } from '../data/catalog.js';
import { ItemSelector } from '../src/components/common/ItemSelector.jsx';

/* El dump del juego no nombra los mapas de mazmorra ni varias monturas de
   evento; el generador las marca con `untranslated: true` para que la
   interfaz muestre el ID sin fingir una traducción. */
describe('catálogo: ítems sin nombre en el dump', () => {
  it('isUntranslated solo marca entradas con la bandera', () => {
    expect(catalog.isUntranslated(null)).toBe(false);
    expect(catalog.isUntranslated({ id: 'T4_RANDOM_DUNGEON_TOKEN' })).toBe(false);
    expect(catalog.isUntranslated({ id: 'T4_RANDOM_DUNGEON_TOKEN', untranslated: true })).toBe(true);
  });

  it('el catálogo conserva la bandera al registrarse', () => {
    const raw = CATALOG.find(entry => entry.untranslated);
    expect(raw).toBeTruthy();
    const registered = catalog.get(raw.id);
    expect(registered).toBeTruthy();
    expect(catalog.isUntranslated(registered)).toBe(true);
    expect(registered.es).toBe(registered.base);
  });

  it('las entradas con nombre en español no se marcan', () => {
    const named = CATALOG.find(entry => !entry.untranslated && entry.lvl === 0);
    expect(named).toBeTruthy();
    expect(catalog.isUntranslated(catalog.get(named.id))).toBe(false);
    expect(named.es).not.toBe(named.base);
  });

  it('los alimentos de montura marcados son los que el dump no nombra', () => {
    const flagged = catalog.mountFoods().filter(entry => catalog.isUntranslated(entry));
    expect(flagged.length).toBeGreaterThan(0);
    flagged.forEach(entry => expect(entry.es).toBe(entry.id));
  });

  it('la ficha del ítem aclara cuando el nombre viene del ID', () => {
    const raw = CATALOG.find(entry => entry.untranslated && entry.lvl === 0);
    const { unmount } = render(<ItemSelector id="sinNombre" value={raw.id} />);
    expect(screen.getByText('sin nombre en el dump')).toBeTruthy();
    unmount();
    const named = CATALOG.find(entry => !entry.untranslated && entry.lvl === 0);
    render(<ItemSelector id="conNombre" value={named.id} />);
    expect(screen.queryByText('sin nombre en el dump')).toBeNull();
  });
});
