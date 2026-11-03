import { ApplicationShell } from './components/layout/ApplicationShell.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { useApp } from './app/AppContext.jsx';
import { modules } from './modules/registry.jsx';
import { MODULES } from './settings/index.js';

export default function App() {
  const { active, pending } = useApp();
  const View = modules[active] || modules.crafting;
  const meta = MODULES.find(m => m.id === active) || MODULES[0];
  /* La clave del límite es la misma navegación que remonta la vista: al cambiar
     de módulo, un módulo roto deja de mostrar el error. */
  const viewKey = `${active}:${pending.seq}`;
  return (
    <div className="shell">
      <ApplicationShell>
        <div className="shell-body">
          <main className="main" id="app-content">
            <ErrorBoundary key={viewKey} title={`El módulo ${meta.label} falló al cargar`}>
              <View meta={meta} />
            </ErrorBoundary>
          </main>
        </div>
      </ApplicationShell>
    </div>
  );
}
