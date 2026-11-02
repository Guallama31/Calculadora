import { ApplicationShell } from './components/layout/ApplicationShell.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { useApp } from './app/AppContext.jsx';
import { modules } from './modules/registry.jsx';
import { MODULES } from './settings/index.js';
import { cn } from './lib/utils.js';

export default function App() {
  const { active, collapsed, pending } = useApp();
  const View = modules[active] || modules.crafting;
  const meta = MODULES.find(m => m.id === active) || MODULES[0];
  return (
    <div className={cn('shell', collapsed && 'collapsed')}>
      <ApplicationShell>
        <div className="shell-body">
          <Sidebar />
          <main className="main" id="app-content">
            <View key={`${active}:${pending.seq}`} meta={meta} />
          </main>
        </div>
      </ApplicationShell>
    </div>
  );
}
