import { ApplicationShell } from './components/layout/ApplicationShell.jsx';
import { useApp } from './app/AppContext.jsx';
import { modules } from './modules/registry.jsx';
import { MODULES } from './settings/index.js';

export default function App() {
  const { active, pending } = useApp();
  const View = modules[active] || modules.crafting;
  const meta = MODULES.find(m => m.id === active) || MODULES[0];
  return (
    <div className="shell">
      <ApplicationShell>
        <div className="shell-body">
          <main className="main" id="app-content">
            <View key={`${active}:${pending.seq}`} meta={meta} />
          </main>
        </div>
      </ApplicationShell>
    </div>
  );
}
