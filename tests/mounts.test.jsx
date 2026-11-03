import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';
import { AppProvider } from '../src/app/AppContext.jsx';
import { installFetch } from './fixtures.js';

function renderApp() {
  return render(<AppProvider><App /></AppProvider>);
}

async function openMounts(container) {
  fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
  const menu = await screen.findByRole('dialog');
  fireEvent.click(within(menu).getByRole('button', { name: 'Monturas', exact: true }));
  await waitFor(() => expect(container.querySelector('.module-view')?.dataset.module).toBe('mounts'));
}

describe('Monturas', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    installFetch();
  });

  it('separa crianza y ensillado y consulta cotizaciones para la crianza seleccionada', async () => {
    const { container } = renderApp();
    await openMounts(container);

    expect(container.querySelector('#mounts-flow-tabs [data-tab="breeding"]')?.textContent).toBe('Crianza');
    expect(container.querySelector('#mounts-flow-tabs [data-tab="saddling"]')?.textContent).toBe('Ensillado');
    fireEvent.change(container.querySelector('#mount-breeding-animal'), {
      target: { value: 'T4_FARM_HORSE_BABY' },
    });
    expect(container.textContent).toContain('El dump del juego no indica una comida favorita para este animal');
    fireEvent.change(container.querySelector('#mount-breeding-food'), {
      target: { value: 'T1_CARROT' },
    });

    await waitFor(() => expect(container.querySelector('#mount-breeding-baby-buy-price').value).not.toBe(''));
    expect(container.querySelector('#mount-breeding-feed-per-animal').value).toBe('30');
    expect(container.querySelector('#mount-breeding-grown-sell-price').value).not.toBe('');
    expect(container.querySelector('#mount-breeding-profit').textContent).not.toBe('Faltan precios');

    fireEvent.click(container.querySelector('#mounts-flow-tabs [data-tab="saddling"]'));
    expect(container.querySelector('#calc-item-search')).toBeTruthy();
    expect(container.querySelector('#mounts-flow-tabs [data-tab="saddling"]').getAttribute('aria-selected')).toBe('true');
  });

  it('mantiene explícito el precio ausente y permite completarlo manualmente', async () => {
    const { container } = renderApp();
    installFetch({ missingCity: 'Martlock', missingItem: 'T4_FARM_HORSE_BABY' });
    await openMounts(container);
    fireEvent.change(container.querySelector('#mount-breeding-animal'), {
      target: { value: 'T4_FARM_HORSE_BABY' },
    });
    fireEvent.change(container.querySelector('#mount-breeding-food'), {
      target: { value: 'T1_CARROT' },
    });

    await waitFor(() => expect(container.querySelector('#mount-breeding-baby-buy-price').placeholder)
      .toBe('No se registra precio'));
    expect(container.querySelector('#mount-breeding-profit .result-value').textContent).toBe('Faltan precios');
    fireEvent.change(container.querySelector('#mount-breeding-baby-buy-price'), {
      target: { value: '1000' },
    });
    await waitFor(() => expect(container.querySelector('#mount-breeding-profit .result-value').textContent)
      .not.toBe('Faltan precios'));
  });

  it('conserva el precio manual al actualizar y permite volver a AODP', async () => {
    const { container } = renderApp();
    await openMounts(container);
    fireEvent.change(container.querySelector('#mount-breeding-animal'), {
      target: { value: 'T4_FARM_HORSE_BABY' },
    });
    fireEvent.change(container.querySelector('#mount-breeding-food'), {
      target: { value: 'T1_CARROT' },
    });
    await waitFor(() => expect(container.querySelector('#mount-breeding-baby-buy-price').value).not.toBe(''));

    const input = container.querySelector('#mount-breeding-baby-buy-price');
    fireEvent.change(input, { target: { value: '1234' } });
    fireEvent.click(container.querySelector('.card-head-actions button'));
    await waitFor(() => expect(input.value).toBe('1234'));
    fireEvent.click(input.parentElement.querySelector('button.btn.ghost'));
    await waitFor(() => expect(Number(input.value)).not.toBe(1234));
  });

  it('abre un ítem de montura enviado desde la búsqueda global en Ensillado', async () => {
    const { container } = renderApp();
    const search = container.querySelector('.global-search input');
    fireEvent.change(search, { target: { value: 'T4_MOUNT_HORSE' } });
    await waitFor(() => expect(container.querySelector('.search-popover [data-id="T4_MOUNT_HORSE"]')).toBeTruthy());
    fireEvent.click(container.querySelector('.search-popover [data-id="T4_MOUNT_HORSE"]'));

    await waitFor(() => expect(container.querySelector('.module-view')?.dataset.module).toBe('mounts'));
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta')?.textContent).toContain('T4_MOUNT_HORSE'));
    expect(container.querySelector('#mounts-flow-tabs [data-tab="saddling"]')
      .getAttribute('aria-selected')).toBe('true');
  });
});

describe('Monturas · precio según el modo de venta', () => {
  /* En los fixtures `sell_price_min = P` y `buy_price_max = 0.86 · P`. */
  const priceOf = (id, city) => Math.max(1, Math.round(
    1000 + id.length * 37 + city.length * 11 + 1 * 100,
  ));

  it('publica con sell_price_min y vende en el acto contra buy_price_max', async () => {
    installFetch();
    const { container } = render(<AppProvider><App /></AppProvider>);
    await openMounts(container);
    fireEvent.change(container.querySelector('#mount-breeding-animal'), {
      target: { value: 'T4_FARM_HORSE_BABY' },
    });
    fireEvent.change(container.querySelector('#mount-breeding-food'), {
      target: { value: 'T1_CARROT' },
    });

    const grown = () => Number(container.querySelector('#mount-breeding-grown-sell-price').value);
    const expectedSell = priceOf('T4_FARM_HORSE_GROWN', 'Lymhurst');
    const expectedBuy = Math.round(expectedSell * .86);

    await waitFor(() => expect(grown()).toBe(expectedSell));

    fireEvent.change(container.querySelector('#mount-breeding-sell-mode'), {
      target: { value: 'instant' },
    });
    await waitFor(() => expect(grown()).toBe(expectedBuy));

    fireEvent.change(container.querySelector('#mount-breeding-sell-mode'), {
      target: { value: 'order' },
    });
    await waitFor(() => expect(grown()).toBe(expectedSell));
  });
});
