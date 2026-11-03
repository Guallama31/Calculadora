import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary.jsx';

function Boom({ explode }) {
  if (explode) throw new Error('explotó el módulo');
  return <p>contenido recuperado</p>;
}

/* React 18 vuelve a lanzar el error en desarrollo para que jsdom lo registre.
   Aquí el fallo es intencional, así que se silencia ese ruido. */
const silenceJsdom = event => event.preventDefault();

describe('barrera de errores', () => {
  beforeAll(() => window.addEventListener('error', silenceJsdom));
  afterAll(() => window.removeEventListener('error', silenceJsdom));

  it('muestra el error en lugar de dejar la pantalla en blanco', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom explode /></ErrorBoundary>);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('explotó el módulo');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    spy.mockRestore();
  });

  it('vuelve a montar el contenido al reintentar', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let explode = true;
    function Flaky() {
      if (explode) throw new Error('fallo temporal');
      return <p>contenido recuperado</p>;
    }
    render(<ErrorBoundary><Flaky /></ErrorBoundary>);
    explode = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('contenido recuperado')).toBeTruthy();
    spy.mockRestore();
  });
});
