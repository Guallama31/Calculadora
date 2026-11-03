import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider } from './app/AppContext.jsx';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { initializeCatalog } from './services/catalog.js';

const container = document.getElementById('root');
const root = createRoot(container);

function BootError({ error }) {
  return (
    <div className="error-boundary" role="alert" data-testid="boot-error">
      <div className="error-boundary-card">
        <h2>No se pudo cargar el catálogo</h2>
        <p className="error-boundary-reason">{error?.message || String(error)}</p>
        <p className="hint">Revisá tu conexión y recargá la página para volver a intentarlo.</p>
        <div className="error-boundary-actions">
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Recargar la página
          </button>
        </div>
      </div>
    </div>
  );
}

/* El catálogo pesa ~5 MB: se pide con import() dinámico para que el shell y los
   estilos pinten primero, y para que quede en un chunk independiente y cacheable
   entre despliegues de la aplicación. */
async function bootstrap() {
  try {
    const data = await import('../data/catalog.js');
    initializeCatalog(data);
    root.render(
      <ErrorBoundary
        title="La aplicación falló"
        description="Se produjo un error inesperado fuera de un módulo. Recargá la página para volver a empezar."
      >
        <AppProvider>
          <App />
        </AppProvider>
      </ErrorBoundary>,
    );
  } catch (error) {
    console.error('No se pudo inicializar el catálogo:', error);
    root.render(<BootError error={error} />);
  }
}

void bootstrap();
