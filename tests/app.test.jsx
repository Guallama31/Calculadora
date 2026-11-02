import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AppProvider } from '../src/app/AppContext.jsx';
import App from '../src/App.jsx';
import { installFetch } from './fixtures.js';

const renderApp = () => render(<AppProvider><App /></AppProvider>);
const byText = text => screen.getByText(text, { exact: false });

describe('Shell adaptado de ApplicationShell3', () => {
  beforeEach(() => installFetch());

  it('muestra la marca exacta, la barra superior y la navegación lateral contraíble', () => {
    const { container } = renderApp();
    expect(container.querySelector('.header.topbar')).toBeTruthy();
    expect(container.querySelector('.brand strong').textContent).toBe('Calculadora');
    expect(document.body.textContent).not.toContain('Forja');
    expect(container.querySelectorAll('.topbar-nav .ui-btn').length).toBe(3);
    expect(container.querySelectorAll('.sidebar .nav-item').length).toBe(10);
    expect(container.querySelector('#app-sidebar')).toBeTruthy();
    const toggle = container.querySelector('[aria-label="Contraer menú"]');
    fireEvent.click(toggle);
    expect(container.querySelector('.shell').classList.contains('collapsed')).toBe(true);
    expect(JSON.parse(localStorage.getItem('calculadora-prefs-v1')).collapsed).toBe(true);
  });

  it('abre un menú desplegable por grupo y navega a otro módulo', async () => {
    const { container } = renderApp();
    const triggers = container.querySelectorAll('.topbar-nav [data-state]');
    fireEvent.keyDown(triggers[0], { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getByText('Refinamiento'));
    await waitFor(() => expect(container.querySelector('.module-view').dataset.module).toBe('refining'));
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
});

describe('Calculadora', () => {
  beforeEach(() => installFetch());

  it('selecciona un ítem, calcula impuestos y permite contraer RRR con bonus real', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    await waitFor(() => expect(container.querySelectorAll('#calc-item-chips .chip').length).toBe(5));
    expect(container.querySelectorAll('.materials-table tbody tr').length).toBeGreaterThan(1);
    expect(Number(container.querySelector('#calc-item-value').value)).toBeGreaterThan(0);

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

  it('carga precios de la API respetando los manuales y compara ciudades', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent).toContain('✔'));
    expect(Number(container.querySelector('#calc-sale-price').value)).toBeGreaterThan(0);

    fireEvent.click([...container.querySelectorAll('#calc-tabs .tab')].find(t => t.dataset.tab === 'cities'));
    fireEvent.click(container.querySelector('#calc-compare-btn'));
    await waitFor(() => expect(container.querySelectorAll('#calc-compare-results .data-table tbody tr').length).toBeGreaterThan(4));
    expect(container.querySelectorAll('#calc-compare-results .bar-row').length).toBeGreaterThan(4);
  });

  it('informa 429 y posibles bloqueos CORS sin romperse', async () => {
    const { container } = renderApp();
    const input = container.querySelector('#calc-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#calc-item-suggestions [data-id="T4_BAG"]'));
    fireEvent.change(container.querySelector('.topbar-right select[aria-label="Calidad"]'), { target: { value: '5' } });
    installFetch({ mode: '429' });
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent).toContain('429'));
    fireEvent.change(container.querySelector('.topbar-right select[aria-label="Calidad"]'), { target: { value: '4' } });
    installFetch({ mode: 'cors' });
    fireEvent.click(container.querySelector('#calc-load-prices'));
    await waitFor(() => expect(container.querySelector('#calc-status').textContent).toContain('CORS'));
    expect(container.querySelector('.error-card')).toBeNull();
  });
});

describe('Flipping y Precios', () => {
  beforeEach(() => installFetch({ discount: 3000 }));

  it('ejecuta las 4 estrategias y abre una oportunidad en la calculadora', async () => {
    const { container } = renderApp();
    const nav = [...container.querySelectorAll('.sidebar .nav-item')].find(b => b.textContent.includes('Flipping'));
    fireEvent.click(nav);
    await waitFor(() => expect(container.querySelectorAll('#scan-tabs .tab').length).toBe(4));
    fireEvent.change(container.querySelector('#scan-max-items'), { target: { value: '20' } });
    fireEvent.click(container.querySelector('#scan-run'));
    await waitFor(() => expect(container.querySelector('#scan-status').textContent).toMatch(/✔|✖/), { timeout: 8000 });
    expect(container.querySelectorAll('#scan-results .data-table tbody tr').length).toBeGreaterThan(0);
    fireEvent.click(container.querySelector('[data-open]'));
    await waitFor(() => expect(container.querySelector('.module-view').dataset.module).toBe('crafting'));
    expect(container.querySelector('#calc-status').textContent).toContain('Oportunidad cargada');
  });

  it('muestra la matriz de ciudades y las 5 calidades', async () => {
    const { container } = renderApp();
    const nav = [...container.querySelectorAll('.sidebar .nav-item')].find(b => b.textContent.includes('Precios'));
    fireEvent.click(nav);
    const input = container.querySelector('#prices-item-search');
    fireEvent.change(input, { target: { value: 'T4_BAG' } });
    await waitFor(() => expect(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]')).toBeTruthy());
    fireEvent.click(container.querySelector('#prices-item-suggestions [data-id="T4_BAG"]'));
    fireEvent.click(container.querySelector('#prices-load'));
    await waitFor(() => expect(container.querySelectorAll('#prices-cities .data-table tbody tr').length).toBeGreaterThan(5));
    expect(container.querySelectorAll('#prices-cities .bar-row').length).toBeGreaterThan(5);
    fireEvent.click([...container.querySelectorAll('#prices-tabs .tab')].find(t => t.dataset.tab === 'quality'));
    expect(container.querySelectorAll('#prices-quality .data-table tbody tr').length).toBe(5);
  });
});

describe('Menús, hoja móvil y estrategias', () => {
  beforeEach(() => installFetch({ discount: 3000 }));

  it('los submenús del desplegable cambian de pestaña', async () => {
    const { container } = renderApp();
    const triggers = container.querySelectorAll('.topbar-nav [data-state]');
    fireEvent.keyDown(triggers[0], { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    fireEvent.click(within(screen.getByRole('menu')).getByText('Comparar ciudades'));
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

  it('las 4 estrategias del escáner devuelven oportunidades', async () => {
    const { container } = renderApp();
    const nav = [...container.querySelectorAll('.sidebar .nav-item')].find(b => b.textContent.includes('Flipping'));
    fireEvent.click(nav);
    await waitFor(() => expect(container.querySelectorAll('#scan-tabs .tab').length).toBe(4));
    fireEvent.change(container.querySelector('#scan-max-items'), { target: { value: '20' } });
    for (const id of ['flip', 'royalbm', 'craft', 'refine']) {
      fireEvent.click([...container.querySelectorAll('#scan-tabs .tab')].find(t => t.dataset.tab === id));
      fireEvent.click(container.querySelector('#scan-run'));
      await waitFor(() => expect(container.querySelector('#scan-status').textContent).toContain('✔'), { timeout: 10000 });
      const rows = container.querySelectorAll('#scan-results .data-table tbody tr').length;
      expect(rows, `${id} devolvió filas`).toBeGreaterThan(0);
      if (id === 'royalbm') expect(container.querySelector('#scan-results').textContent).toContain('Black Market');
      if (id === 'refine') expect(container.querySelector('#scan-results').textContent).toContain('RRR');
    }
  });

  it('no emite errores de React al renderizar los 10 módulos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderApp();
    for (const button of container.querySelectorAll('.sidebar .nav-item')) {
      fireEvent.click(button);
      await waitFor(() => expect(container.querySelector('.module-view')).toBeTruthy());
    }
    const reactErrors = spy.mock.calls.filter(args => /Warning:|validateDOMNesting|Each child in a list/.test(String(args[0])));
    expect(reactErrors).toEqual([]);
    spy.mockRestore();
  });
});
