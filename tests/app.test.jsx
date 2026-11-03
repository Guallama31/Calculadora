import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/app/AppContext.jsx';
import App from '../src/App.jsx';
import { installFetch } from './fixtures.js';
import { get as getCatalogItem } from '../src/services/catalog.js';
import { CITIES } from '../src/settings/index.js';
import { fmt, fmt2 } from '../src/services/format.js';

const renderApp = () => render(<AppProvider><App /></AppProvider>);
const byText = text => screen.getByText(text, { exact: false });
const navigateFromMenu = async (container, label, moduleId) => {
  fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label, exact: true }));
  await waitFor(() => expect(container.querySelector('.module-view')?.dataset.module).toBe(moduleId));
};

describe('Shell adaptado de ApplicationShell3', () => {
  beforeEach(() => installFetch());

  it('muestra solo el menú lateral desplegable, sin una barra lateral fija', async () => {
    const { container } = renderApp();
    expect(container.querySelector('.header.topbar')).toBeTruthy();
    expect(container.querySelector('.brand strong').textContent).toBe('Calculadora');
    expect(document.body.textContent).not.toContain('Forja');
    expect(container.querySelector('.topbar-nav')).toBeNull();
    expect(container.querySelector('#app-sidebar')).toBeNull();
    expect(container.querySelector('#global-quality')).toBeNull();
    expect(container.querySelector('[aria-label="Abrir menú"]')).toBeTruthy();
    fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('button', { name: 'Crafteo', exact: true })).toBeTruthy();
    expect(within(menu).getByRole('button', { name: 'Precios', exact: true })).toBeTruthy();
  });

  it('navega a otro módulo desde el menú lateral desplegable', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Refinamiento', 'refining');
  });

  it('mantiene ítems y precios independientes entre Crafteo y Encantamiento', async () => {
    const { container } = renderApp();
    const craftingSearch = container.querySelector('#calc-item-search');
    fireEvent.change(craftingSearch, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_BAG'));
    await waitFor(() => expect(container.querySelector('#calc-sale-price').value).not.toBe(''));

    await navigateFromMenu(container, 'Encantamiento', 'enchanting');
    expect(container.querySelector('#calc-item-search').value).toBe('');
    expect(container.querySelector('#calc-recipe-meta').textContent).toBe('Sin ítem');
    expect(container.querySelector('#calc-sale-price').value).toBe('');
    expect(container.querySelector('.materials-table')).toBeNull();

    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]'));
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_MAIN_SWORD@1'));
    await waitFor(() => expect(container.querySelector('#calc-sale-price').value).not.toBe(''));

    await navigateFromMenu(container, 'Crafteo', 'crafting');
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_BAG'));
    expect(container.querySelector('#calc-item-search').value).toContain('Bolsa');
    await waitFor(() => expect(container.querySelector('#calc-sale-price').value).not.toBe(''));
  });

  it('abre la hoja móvil con la navegación completa', async () => {
    const { container } = renderApp();
    fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Documentación')).toBeTruthy();
    expect(within(sheet).getAllByText('Crafteo').length).toBeGreaterThan(0);
  });

  it('la búsqueda global abre un ítem en Crafteo', async () => {
    const { container } = renderApp();
    const search = container.querySelector('.global-search input');
    fireEvent.change(search, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('.search-popover')).toBeTruthy());
    const option = container.querySelector('.search-popover .dropdown-item[data-id]')
      || [...container.querySelectorAll('.search-popover .dropdown-item')].find(n => n.textContent.includes('T4_BAG'));
    expect(option).toBeTruthy();
    fireEvent.click(option);
    await waitFor(() => expect(container.querySelector('#calc-item-card strong')?.textContent.length).toBeGreaterThan(2));
  });

  it('excluye las recetas de refinamiento de Crafteo y las abre en Refinamiento desde la búsqueda global', async () => {
    const { container } = renderApp();
    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_PLANKS' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions .suggestion.muted')?.textContent)
      .toBe('Sin resultados'));

    const search = container.querySelector('.global-search input');
    fireEvent.change(search, { target: { value: 'T4_PLANKS' } });
    await waitFor(() => expect(container.querySelector('.search-popover [data-id="T4_PLANKS"]')).toBeTruthy());
    fireEvent.click(container.querySelector('.search-popover [data-id="T4_PLANKS"]'));

    await waitFor(() => expect(container.querySelector('.module-view').dataset.module).toBe('refining'));
    expect(container.querySelector('#calc-refining-type').value).toBe('wood');
    expect(container.querySelector('#calc-refining-tier').value).toBe('4');
    expect(container.querySelector('#calc-refining-enchantment').value).toBe('0');
    expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_PLANKS');
  });

  it('la búsqueda global no recorta las variantes de Matadragones', async () => {
    const { container } = renderApp();
    const search = container.querySelector('.global-search input');
    fireEvent.change(search, { target: { value: 'Matadragones' } });
    await waitFor(() => expect(container.querySelectorAll('.search-popover .dropdown-item'))
      .toHaveLength(75));
    expect(container.querySelector('.search-popover').textContent).toContain('T4_HEAD_LEATHER_DRAGON');
    expect(container.querySelector('.search-popover').textContent).toContain('T8_SHOES_LEATHER_DRAGON@4');
  });
});

describe('Calculadora', () => {
  beforeEach(() => installFetch());

  it('selecciona el refinado por tipo, nivel y encantamiento', async () => {
    const fetchSpy = installFetch();
    const { container } = renderApp();
    await navigateFromMenu(container, 'Refinamiento', 'refining');
    expect(container.querySelector('#calc-item-search')).toBeNull();
    expect(container.querySelector('#calc-refining-tier').disabled).toBe(true);
    expect(container.querySelector('#calc-refining-enchantment').disabled).toBe(true);

    fireEvent.change(container.querySelector('#calc-refining-type'), { target: { value: 'wood' } });
    expect([...container.querySelector('#calc-refining-tier').options].map(option => option.value))
      .toContain('8');
    fireEvent.change(container.querySelector('#calc-refining-tier'), { target: { value: '4' } });
    expect([...container.querySelector('#calc-refining-enchantment').options].map(option => option.value))
      .toEqual(['', '0', '1', '2', '3', '4']);
    fireEvent.change(container.querySelector('#calc-refining-enchantment'), { target: { value: '1' } });

    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent)
      .toContain('T4_PLANKS_LEVEL1@1'));
    const materialIds = [...container.querySelectorAll('.materials-table tbody .material-cell small')]
      .map(node => node.textContent);
    expect(materialIds).toEqual(['T4_WOOD_LEVEL1@1', 'T3_PLANKS']);
    await waitFor(() => {
      const requestUrls = fetchSpy.mock.calls.map(([url]) => String(url)).join('\n');
      expect(requestUrls).toContain('T4_PLANKS_LEVEL1@1');
      expect(requestUrls).toContain('T4_WOOD_LEVEL1@1');
    });

    fireEvent.click(container.querySelector('#calc-refining-heart-recipe'));
    await waitFor(() => expect(container.querySelector('#calc-primary-recipe-ref')).toBeTruthy());
    expect(container.querySelector('#calc-recipe-meta').textContent).toContain('3 materiales');
    const alternateIds = [...container.querySelectorAll('.materials-table tbody .material-cell small')]
      .map(node => node.textContent);
    expect(alternateIds).toEqual([
      'T4_WOOD_LEVEL1@1', 'T1_FACTION_FOREST_TOKEN_1', 'T3_PLANKS',
    ]);
    expect(container.querySelector('#calc-primary-recipe-ref').textContent).toContain('T4_WOOD_LEVEL1@1');
    await waitFor(() => {
      const requestUrls = fetchSpy.mock.calls.map(([url]) => String(url)).join('\n');
      expect(requestUrls).toContain('T1_FACTION_FOREST_TOKEN_1');
    });

    fireEvent.click(container.querySelector('#calc-refining-heart-recipe'));
    await waitFor(() => expect(container.querySelector('#calc-primary-recipe-ref')).toBeNull());
    expect(container.querySelector('#calc-recipe-meta').textContent).toContain('2 materiales');
    expect([...container.querySelectorAll('.materials-table tbody .material-cell small')].map(node => node.textContent))
      .toEqual(['T4_WOOD_LEVEL1@1', 'T3_PLANKS']);

    fireEvent.change(container.querySelector('#calc-refining-type'), { target: { value: 'rock' } });
    fireEvent.change(container.querySelector('#calc-refining-tier'), { target: { value: '4' } });
    expect([...container.querySelector('#calc-refining-enchantment').options].map(option => option.value))
      .toEqual(['', '0']);
  });

  it('muestra el ranking de transmutación con precios y candidatos del catálogo', async () => {
    const fetchSpy = installFetch();
    const { container } = renderApp();
    await navigateFromMenu(container, 'Refinamiento', 'refining');
    const transmutationTab = container.querySelector('#calc-tabs [data-tab="transmutation"]');
    expect(transmutationTab).toBeTruthy();
    fireEvent.click(transmutationTab);

    await waitFor(() => expect(container.querySelector('#transmute-status').textContent)
      .toMatch(/^✔ Precios actualizados/), { timeout: 10000 });
    expect(container.querySelectorAll('.transmute-table tbody tr').length).toBeGreaterThan(0);
    expect(container.querySelector('#transmute-status').textContent).toContain('registros recibidos');
    const requestUrls = fetchSpy.mock.calls.map(([url]) => String(url)).join('\n');
    expect(requestUrls).toContain('T4_WOOD');
    expect(requestUrls).toContain('T4_WOOD_LEVEL1@1');
  }, 15000);

  it('mantiene los manuales de transmutación separados por ciudad y lado del mercado', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Refinamiento', 'refining');
    fireEvent.click(container.querySelector('#calc-tabs [data-tab="transmutation"]'));
    await waitFor(() => expect(container.querySelector('#transmute-status').textContent)
      .toMatch(/^✔ Precios actualizados/), { timeout: 10000 });

    const input = container.querySelector('.transmute-table tbody input[aria-label^="Precio de compra"]');
    const inputLabel = input.getAttribute('aria-label');
    const findPriceInput = () => [...container.querySelectorAll('.transmute-table tbody input')]
      .find(node => node.getAttribute('aria-label') === inputLabel);
    fireEvent.change(input, { target: { value: '12345' } });
    await waitFor(() => expect(findPriceInput().value).toBe('12345'));
    fireEvent.change(container.querySelector('#transmute-city'), { target: { value: 'Lymhurst' } });
    await waitFor(() => expect(container.querySelector('#transmute-status').textContent)
      .toMatch(/^✔ Precios actualizados/), { timeout: 10000 });
    expect(findPriceInput().value).not.toBe('12345');

    fireEvent.change(container.querySelector('#transmute-city'), { target: { value: 'Martlock' } });
    await waitFor(() => expect(container.querySelector('#transmute-status').textContent)
      .toMatch(/^✔ Precios actualizados/), { timeout: 10000 });
    expect(findPriceInput().value).toBe('12345');
  }, 20000);

  it('selecciona un ítem, calcula impuestos y permite contraer RRR con bonus real', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelectorAll('#calc-item-chips .chip').length).toBe(5));
    expect(container.querySelectorAll('.materials-table tbody tr').length).toBeGreaterThan(1);
    expect(container.querySelector('#calc-item-value')).toBeNull();
    expect(container.querySelector('#calc-station-info').textContent)
      .toContain(fmt2(getCatalogItem('T4_BAG').value * 0.1125));

    container.querySelectorAll('.row-price').forEach((el, i) => fireEvent.change(el, { target: { value: String(100 + i * 10) } }));
    fireEvent.change(container.querySelector('#calc-sale-price'), { target: { value: '25000' } });
    await waitFor(() => expect(container.querySelector('#calc-verdict').textContent).toBe('Rentable'));
    expect(container.querySelector('#calc-breakdown').textContent).toContain('Tasa de estación');
    expect(container.querySelector('#calc-tax-summary').textContent).toContain('4 %');

    fireEvent.click(container.querySelector('#global-premium'));
    await waitFor(() => expect(container.querySelector('#calc-tax-summary').textContent).toContain('8 %'));
    fireEvent.click(container.querySelector('#global-premium'));

    fireEvent.change(container.querySelector('#calc-craft-city'), { target: { value: 'Fort Sterling' } });
    expect(container.querySelector('#calc-rrr-info').textContent).toContain('Fort Sterling');
    fireEvent.click(container.querySelector('#calc-focus'));
    expect(Number(container.querySelector('#calc-rrr').value)).toBeGreaterThan(20);
  });

  it('muestra todas las variantes de Matadragones y permite ampliar búsquedas largas', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'Matadragones' } });
    await waitFor(() => expect(container.querySelectorAll('#calc-item-suggestions [data-id]'))
      .toHaveLength(75));
    for (const id of ['T4_HEAD_LEATHER_DRAGON', 'T4_ARMOR_LEATHER_DRAGON', 'T4_SHOES_LEATHER_DRAGON',
      'T8_HEAD_LEATHER_DRAGON@4', 'T8_ARMOR_LEATHER_DRAGON@4', 'T8_SHOES_LEATHER_DRAGON@4']) {
      expect(container.querySelector(`#calc-item-suggestions [data-id="${id}"]`)).toBeTruthy();
    }

    fireEvent.change(input, { target: { value: 'T4' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions .suggestion-more')).toBeTruthy());
    expect(container.querySelectorAll('#calc-item-suggestions [data-id]')).toHaveLength(100);
    fireEvent.click(container.querySelector('#calc-item-suggestions .suggestion-more'));
    await waitFor(() => expect(container.querySelectorAll('#calc-item-suggestions [data-id]').length)
      .toBeGreaterThan(100));
  });

  it('carga precios de la API respetando los manuales y compara ciudades', async () => {
    const fetchSpy = installFetch();
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(Number(container.querySelector('#calc-sale-price').value)).toBeGreaterThan(0));
    const requestsAfterAutoLoad = fetchSpy.mock.calls.length;
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent).toContain('✔'));
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(requestsAfterAutoLoad);
    expect(Number(container.querySelector('#calc-sale-price').value)).toBeGreaterThan(0);
    expect(container.querySelector('#calc-use-sell-price').textContent).toContain('Actualizar precios');
    expect(container.querySelectorAll('#calc-sale-city-prices tbody tr')).toHaveLength(CITIES.length);
    expect(container.querySelector('#calc-sale-city-prices').textContent).toContain('Mejor precio');
    expect(container.querySelector('#calc-relists')).toBeNull();
    expect(container.querySelector('#calc-other-costs')).toBeNull();
    expect(container.querySelector('#calc-overwrite')).toBeNull();
    expect(container.querySelector('#calc-proxy')).toBeNull();
    expect(container.querySelector('summary')?.textContent).not.toContain('proxy');

    const materialCity = container.querySelector('.row-city');
    fireEvent.change(materialCity, { target: { value: 'Global' } });
    await waitFor(() => expect(container.querySelector('#calc-status').textContent)
      .toContain('Menor precio registrado'));
    fireEvent.click(container.querySelector('#calc-use-sell-price'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent)
      .toContain('Precios actualizados'));
    const globalRequestUrl = new URL(String(fetchSpy.mock.calls.at(-1)[0]));
    expect(globalRequestUrl.searchParams.get('locations').split(',')).toEqual(CITIES.map(city => city.value));
    const materialId = container.querySelector('.materials-table tbody .material-cell small').textContent;
    const expectedLowest = Math.min(...CITIES.map(city => {
      const base = 1000 + materialId.length * 37 + city.value.length * 11 + 100;
      return Math.max(1, Math.round(city.value === 'Thetford' ? base - 420 : base));
    }));
    expect(Number(container.querySelector('.materials-table tbody .row-price').value)).toBe(expectedLowest);
    expect(container.querySelector('.materials-table tbody .age').textContent).toContain('Thetford');

    const salePriceInput = container.querySelector('#calc-sale-price');
    fireEvent.change(salePriceInput, { target: { value: '1' } });
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-sale-price').value).toBe('1'));
    fireEvent.click(container.querySelector('#calc-sale-price').parentElement
      .querySelector('button.btn.ghost'));
    await waitFor(() => expect(Number(container.querySelector('#calc-sale-price').value)).not.toBe(1));
    const bestSaleCity = [...container.querySelectorAll('#calc-sale-city-prices tbody tr')]
      .find(row => row.textContent.includes('Mejor precio'));
    expect(bestSaleCity).toBeTruthy();
    fireEvent.click(bestSaleCity.querySelector('button'));
    expect(container.querySelector('#calc-sell-city').value).toBe(bestSaleCity.querySelector('strong').textContent);

    fireEvent.click([...container.querySelectorAll('#calc-tabs .tab')].find(t => t.dataset.tab === 'cities'));
    fireEvent.click(container.querySelector('#calc-compare-btn'));
    await waitFor(() => expect(container.querySelectorAll('#calc-compare-results .data-table tbody tr').length).toBeGreaterThan(4));
    expect(container.querySelectorAll('#calc-compare-results .bar-row').length).toBeGreaterThan(4);
  });

  it('indica cuando AODP no registra un precio y permite cargarlo manualmente', async () => {
    installFetch({ missingCity: 'Martlock' });
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelector('.materials-table .age')?.textContent)
      .toBe('No se registra precio'));

    const price = container.querySelector('.materials-table .row-price');
    expect(price.value).toBe('');
    expect(container.querySelector('.materials-table').textContent).toContain('No se registra precio');
    fireEvent.change(price, { target: { value: '12345' } });
    expect(price.value).toBe('12345');
    expect(price.classList.contains('manual')).toBe(true);
    expect(container.querySelector('.materials-table .age').textContent).toBe('precio manual');
    expect(container.querySelector('#calc-verdict').textContent).toBe('Precios incompletos');
    expect(container.querySelector('#calc-profit').textContent).toContain('—');
  });

  it('muestra las ciudades sin cotización en la consulta de precios', async () => {
    installFetch({ missingCity: 'Caerleon' });
    const { container } = renderApp();
    await navigateFromMenu(container, 'Precios', 'prices');
    const input = container.querySelector('#prices-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelector('#prices-cities').textContent)
      .toContain('No se registra precio'));
    expect(container.querySelectorAll('#prices-cities tbody tr')).toHaveLength(CITIES.length);
    expect(container.querySelector('#prices-status').textContent).toContain('Consulta completada');
  });

  it('ofrece la caché local como referencia anterior cuando AODP no está disponible', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Precios', 'prices');
    fireEvent.change(container.querySelector('#prices-item-search'), { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelector('#prices-status').textContent).toContain('Consulta completada'));
    await waitFor(() => expect(container.querySelector('#prices-cache-count')?.textContent).not.toBe('0'));

    installFetch({ mode: 'cors' });
    fireEvent.click(container.querySelector('#prices-load'));
    await waitFor(() => expect(container.querySelector('#prices-status').textContent)
      .toContain('cotizaciones anteriores'));
    expect(container.querySelector('#prices-cities').textContent).toContain('cotización anterior');
    expect(container.querySelector('#prices-status').textContent).toContain('AODP no respondió');

    fireEvent.click(container.querySelector('#prices-clear-cache'));
    await waitFor(() => expect(container.querySelector('#prices-cache-count').textContent).toBe('0'));
    expect(container.querySelector('#prices-cache-status').textContent).toContain('Caché local borrada');
  });

  it('informa 429 y problemas de conexión con AODP sin romperse', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    installFetch({ mode: '429' });
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent).toContain('429'));
    installFetch({ mode: 'cors' });
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent)
      .toContain('contactar con AODP'));
    expect(container.querySelector('.error-card')).toBeNull();
  });
});

describe('Flipping y Precios', () => {
  beforeEach(() => installFetch({ discount: 3000 }));

  it('ofrece rastreo global y reemplaza los filtros de resultado por la acción principal', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Flipping', 'flipping');
    expect(container.querySelector('#scan-run-card')).toBeTruthy();
    expect(container.querySelector('#scan-min-profit')).toBeNull();
    expect(screen.queryByText('Filtros de resultado')).toBeNull();
    expect(container.querySelector('#scan-run-card .hint').textContent).toContain('cada 15 minutos');
    expect(container.querySelector('#scan-run-card').textContent).toContain('15 minutos');
    expect(container.querySelector('#scan-summary')).toBeTruthy();
    expect(container.querySelector('#scan-opportunities')).toBeTruthy();

    fireEvent.click(container.querySelector('#scan-global'));
    expect(container.querySelector('#scan-category').disabled).toBe(true);
    expect(container.querySelector('#scan-max-items').value).toBe('250');
    expect([...container.querySelectorAll('.sell-city')]).toHaveLength(8);
    expect([...container.querySelectorAll('.sell-city')].every(city => city.checked && city.disabled)).toBe(true);
  });

  it('filtra el selector por categoría en Crafteo, Encantamiento y Precios', async () => {
    const { container } = renderApp();
    const craftingCategory = container.querySelector('#calc-item-category');
    expect(craftingCategory).toBeTruthy();
    fireEvent.change(craftingCategory, { target: { value: 'accessories' } });
    const craftingSearch = container.querySelector('#calc-item-search');
    fireEvent.change(craftingSearch, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.change(craftingCategory, { target: { value: 'weapons' } });
    const craftingSubcategory = container.querySelector('#calc-item-subcategory');
    expect(craftingSubcategory).toBeTruthy();
    expect(craftingSubcategory.querySelector('option[value="sword"]').textContent).toBe('Espadas');
    fireEvent.change(craftingSubcategory, { target: { value: 'sword' } });
    const exactItem = container.querySelector('#calc-item-exact-item');
    expect(exactItem).toBeTruthy();
    expect(exactItem.querySelector('option[value="T4_MAIN_SWORD"]').textContent.trim())
      .toBe('Espada ancha del iniciado');
    expect(exactItem.querySelector('option[value="T4_BAG"]')).toBeNull();
    fireEvent.change(exactItem, { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-card strong').textContent)
      .toBe('Espada ancha del iniciado'));
    fireEvent.change(craftingSearch, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions .suggestion.muted')?.textContent).toBe('Sin resultados'));
    fireEvent.change(craftingSearch, { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());
    fireEvent.change(craftingCategory, { target: { value: 'accessories' } });
    expect(container.querySelector('#calc-item-subcategory option[value="sword"]')).toBeNull();
    fireEvent.change(craftingCategory, { target: { value: 'raw-resources' } });
    expect(container.querySelector('#calc-item-subcategory')).toBeNull();
    expect(container.querySelector('#calc-item-exact-item')).toBeNull();

    await navigateFromMenu(container, 'Encantamiento', 'enchanting');
    const enchantingCategory = container.querySelector('#calc-item-category');
    expect(enchantingCategory).toBeTruthy();
    fireEvent.change(enchantingCategory, { target: { value: 'weapons' } });
    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());

    await navigateFromMenu(container, 'Precios', 'prices');
    expect(container.querySelector('#prices-item-category')).toBeTruthy();
    expect(container.querySelector('#prices-city option[value="Black Market"]')).toBeTruthy();
    fireEvent.change(container.querySelector('#prices-item-category'), { target: { value: 'accessories' } });
    fireEvent.change(container.querySelector('#prices-item-search'), { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
  });

  it('muestra la comparación de ciudades también en Encantamiento', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Encantamiento', 'enchanting');
    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]'));
    await waitFor(() => expect(container.querySelectorAll('#calc-sale-city-prices tbody tr').length)
      .toBeGreaterThan(0));
    expect(container.querySelector('#calc-sale-city-prices').textContent).toContain('Mejor precio');
  });

  it('muestra todas las ciudades y avisa cuando falta un precio de venta', async () => {
    installFetch({ missingCity: 'Caerleon', missingItem: 'T4_MAIN_SWORD@1' });
    const { container } = renderApp();
    await navigateFromMenu(container, 'Encantamiento', 'enchanting');
    fireEvent.change(container.querySelector('#calc-item-category'), { target: { value: 'weapons' } });
    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]'));
    await waitFor(() => expect(container.querySelectorAll('#calc-sale-city-prices tbody tr'))
      .toHaveLength(CITIES.length));
    const missingCityRow = [...container.querySelectorAll('#calc-sale-city-prices tbody tr')]
      .find(row => row.textContent.includes('Caerleon'));
    expect(missingCityRow.textContent).toContain('No se registra precio');
    expect(missingCityRow.querySelector('button').disabled).toBe(true);
  });

  it('permite comprar o craftear el ítem base y cotiza el material de encantamiento elegido', async () => {
    const fetchSpy = installFetch();
    const { container } = renderApp();
    await navigateFromMenu(container, 'Encantamiento', 'enchanting');
    fireEvent.change(container.querySelector('#calc-item-category'), { target: { value: 'weapons' } });
    fireEvent.change(container.querySelector('#calc-item-search'), { target: { value: 'T4_MAIN_SWORD' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_MAIN_SWORD"]'));

    expect(container.querySelector('#calc-base-mode').value).toBe('buy');
    expect(container.querySelector('#calc-craft-city')).toBeNull();
    expect(container.querySelector('#calc-focus')).toBeNull();
    expect(container.querySelector('#calc-runs').parentElement.textContent).toContain('Cantidad (lote)');
    expect(container.querySelector('#calc-enchantment-level').value).toBe('1');
    await waitFor(() => expect(Number(container.querySelector('#calc-sale-price').value)).toBeGreaterThan(0));
    let materialIds = [...container.querySelectorAll('.materials-table tbody .material-cell small')]
      .map(node => node.textContent);
    expect(materialIds).toContain('T4_MAIN_SWORD');
    expect(materialIds).toContain('T4_RUNE');
    expect(materialIds).not.toContain('T4_METALBAR');

    fireEvent.change(container.querySelector('#calc-enchantment-level'), { target: { value: '2' } });
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_MAIN_SWORD@2'));
    materialIds = [...container.querySelectorAll('.materials-table tbody .material-cell small')]
      .map(node => node.textContent);
    expect(materialIds).toContain('T4_RUNE');
    expect(materialIds).toContain('T4_SOUL');
    const runeRow = [...container.querySelectorAll('.materials-table tbody tr')]
      .find(row => row.querySelector('.material-cell small')?.textContent === 'T4_RUNE');
    const soulRow = [...container.querySelectorAll('.materials-table tbody tr')]
      .find(row => row.querySelector('.material-cell small')?.textContent === 'T4_SOUL');
    expect(runeRow.textContent).toContain('Paso .0 → .1');
    expect(soulRow.textContent).toContain('Paso .1 → .2');
    await waitFor(() => {
      expect(Number(runeRow.querySelector('.row-price').value)).toBeGreaterThan(0);
      expect(Number(soulRow.querySelector('.row-price').value)).toBeGreaterThan(0);
    });
    expect(container.querySelector('#calc-materials-total').textContent)
      .toBe(fmt(Number(runeRow.querySelector('.row-price').value) * 288
        + Number(soulRow.querySelector('.row-price').value) * 288
        + Number(container.querySelector('.materials-table tbody tr .row-price').value)));

    fireEvent.change(container.querySelector('#calc-enchantment-level'), { target: { value: '3' } });
    await waitFor(() => {
      expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_MAIN_SWORD@3');
      expect([...container.querySelectorAll('.materials-table tbody .material-cell small')]
        .map(node => node.textContent)).toContain('T4_RELIC');
    });
    const progression = [...container.querySelectorAll('.materials-table tbody tr')]
      .map(row => row.textContent);
    expect(progression.some(row => row.includes('Paso .0 → .1'))).toBe(true);
    expect(progression.some(row => row.includes('Paso .1 → .2'))).toBe(true);
    expect(progression.some(row => row.includes('Paso .2 → .3'))).toBe(true);
    await waitFor(() => expect(Number([...container.querySelectorAll('.materials-table tbody tr')]
      .find(row => row.querySelector('.material-cell small')?.textContent === 'T4_RELIC')
      .querySelector('.row-price').value)).toBeGreaterThan(0));
    fireEvent.change(container.querySelector('#calc-enchantment-level'), { target: { value: '2' } });
    await waitFor(() => expect(container.querySelector('#calc-recipe-meta').textContent).toContain('T4_MAIN_SWORD@2'));

    fireEvent.change(container.querySelector('#calc-base-mode'), { target: { value: 'craft' } });
    expect(container.querySelector('#calc-craft-city')).toBeTruthy();
    expect(container.querySelector('#calc-focus')).toBeTruthy();
    materialIds = [...container.querySelectorAll('.materials-table tbody .material-cell small')]
      .map(node => node.textContent);
    expect(materialIds).toContain('T4_METALBAR');
    expect(materialIds).toContain('T4_SOUL');
    await waitFor(() => {
      const requestUrls = fetchSpy.mock.calls.map(([url]) => String(url)).join('\n');
      expect(requestUrls).toContain('T4_METALBAR');
      expect(requestUrls).toContain('T4_SOUL');
    });
  });

  it('ejecuta el flip y abre una oportunidad en la calculadora', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Flipping', 'flipping');
    await waitFor(() => expect(container.querySelectorAll('#scan-tabs .tab').length).toBe(5));
    fireEvent.change(container.querySelector('#scan-max-items'), { target: { value: '20' } });
    fireEvent.click(container.querySelector('#scan-run'));
    await waitFor(() => expect(container.querySelector('#scan-status').textContent).toMatch(/✔|✖/), { timeout: 8000 });
    expect(container.querySelectorAll('#scan-results .data-table tbody tr').length).toBeGreaterThan(0);
    expect(container.querySelector('#scan-results .opportunity-item-icon')).toBeTruthy();
    expect(container.querySelector('#scan-results').textContent).toContain('Comprar en');
    expect(container.querySelector('#scan-results').textContent).toContain('Vender en');
    fireEvent.click(container.querySelector('[data-open]'));
    await waitFor(() => expect(container.querySelector('.module-view').dataset.module).toBe('crafting'));
    expect(container.querySelector('#calc-status').textContent).toContain('Oportunidad cargada');
  });

  it('muestra la matriz de ciudades y las 5 calidades', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Precios', 'prices');
    const input = container.querySelector('#prices-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]'));
    fireEvent.click(container.querySelector('#prices-load'));
    await waitFor(() => expect(container.querySelectorAll('#prices-cities .data-table tbody tr').length).toBeGreaterThan(5));
    expect(container.querySelectorAll('#prices-cities .bar-row').length).toBeGreaterThan(5);
    fireEvent.click([...container.querySelectorAll('#prices-tabs .tab')].find(t => t.dataset.tab === 'quality'));
    await waitFor(() => expect(container.querySelectorAll('#prices-quality .data-table tbody tr').length).toBe(5));
  });
});

describe('Menús, hoja móvil y estrategias', () => {
  beforeEach(() => installFetch({ discount: 3000 }));

  it('los submenús del menú lateral cambian de pestaña', async () => {
    const { container } = renderApp();
    fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Comparar ciudades' }));
    await waitFor(() => expect(container.querySelector('#calc-compare-btn')).toBeTruthy());
  });

  it('la hoja móvil navega y se cierra', async () => {
    const { container } = renderApp();
    fireEvent.click(container.querySelector('[aria-label="Abrir menú"]'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getAllByText('Refinamiento')[0]);
    await waitFor(() => expect(container.querySelector('.module-view').dataset.module).toBe('refining'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('las 5 estrategias del escáner devuelven oportunidades', async () => {
    const { container } = renderApp();
    await navigateFromMenu(container, 'Flipping', 'flipping');
    await waitFor(() => expect(container.querySelectorAll('#scan-tabs .tab').length).toBe(5));
    fireEvent.change(container.querySelector('#scan-max-items'), { target: { value: '20' } });
    const labels = { flip: 'Flip', royalbm: 'Royal → BM', upgrade: 'Mejora',
      craft: 'Craft Trades', refine: 'Refining Trades' };
    for (const id of Object.keys(labels)) {
      fireEvent.click([...container.querySelectorAll('#scan-tabs .tab')].find(t => t.dataset.tab === id));
      fireEvent.click(container.querySelector('#scan-run'));
      await waitFor(() => {
        expect(container.querySelector('#scan-meta').textContent).toContain(labels[id]);
        expect(container.querySelector('#scan-status').textContent).toContain('✔');
      }, { timeout: 10000 });
      expect(container.querySelector('#scan-coverage').textContent).toContain('%');
      const rows = container.querySelectorAll('#scan-results .data-table tbody tr').length;
      expect(rows, `${id} devolvió filas`).toBeGreaterThan(0);
      if (id === 'royalbm') expect(container.querySelector('#scan-results').textContent).toContain('Black Market');
      if (id === 'upgrade') expect(container.querySelector('#scan-results').textContent).toContain('mejorar');
      if (id === 'refine') expect(container.querySelector('#scan-results').textContent).toContain('RRR');
    }
  });

  it('no emite errores de React al renderizar los 10 módulos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderApp();
    const modules = [
      ['Crafteo', 'crafting'], ['Encantamiento', 'enchanting'], ['Refinamiento', 'refining'],
      ['Agricultura', 'farming'], ['Animales', 'animals'], ['Monturas', 'mounts'],
      ['Alquimia', 'alchemy'], ['Cocina', 'cooking'], ['Flipping', 'flipping'], ['Precios', 'prices'],
    ];
    for (const [label, moduleId] of modules) {
      await navigateFromMenu(container, label, moduleId);
    }
    const reactErrors = spy.mock.calls.filter(args => /Warning:|validateDOMNesting|Each child in a list/.test(String(args[0])));
    expect(reactErrors).toEqual([]);
    spy.mockRestore();
  });
});
