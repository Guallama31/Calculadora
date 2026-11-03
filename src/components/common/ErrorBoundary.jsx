/* Barrera de errores de render: evita que una excepción en un módulo deje
   la app en blanco. Al reintentar, React vuelve a montar el subárbol. */
import * as React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    /* Se deja constancia en consola para poder diagnosticar sin pantalla blanca. */
    console.error('Error de render en la interfaz:', error, info?.componentStack);
  }

  retry() {
    this.setState({ error: null });
    this.props.onRetry?.();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { title = 'Algo salió mal', description } = this.props;
    return (
      <div className="error-boundary" role="alert" data-testid="error-boundary">
        <div className="error-boundary-card">
          <h2>{title}</h2>
          <p className="error-boundary-reason">{error.message || String(error)}</p>
          <p className="hint">
            {description ||
              'El resto de la aplicación sigue disponible. Podés reintentar este módulo o recargar la página.'}
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="btn primary" onClick={this.retry}>
              Reintentar
            </button>
            <button type="button" className="btn ghost" onClick={() => window.location.reload()}>
              Recargar la página
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
