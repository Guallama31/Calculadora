import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { NAV_GROUPS } from './sidebar-data.js';
import { useApp } from '../../app/AppContext.jsx';
import { cn } from '../../lib/utils.js';

export function Sidebar() {
  const { active, navigate, collapsed } = useApp();
  const [open, setOpen] = React.useState(() =>
    Object.fromEntries(NAV_GROUPS.map(group => [group.title, group.defaultOpen !== false])));

  return (
    <aside className="sidebar" id="app-sidebar">
      <div className="sidebar-inner">
        <nav className="nav-groups">
          {NAV_GROUPS.map(group => (
            <div className="nav-group" key={group.title}>
              <button type="button" className="nav-group-head"
                onClick={() => setOpen(current => ({ ...current, [group.title]: !current[group.title] }))}
                aria-expanded={open[group.title]} title={group.title}>
                <span className="nav-label">{group.title}</span>
                <ChevronDown className={cn('size-3', !open[group.title] && '-rotate-90')} />
              </button>
              {open[group.title] !== false && group.items.map(entry => {
                const Icon = entry.icon;
                return (
                  <button type="button" key={entry.moduleId}
                    className={cn('nav-item', entry.moduleId === active && 'active')}
                    title={entry.label} onClick={() => navigate(entry.moduleId)}>
                    <Icon className="nav-icon size-4" />
                    <span className="nav-label">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="sidebar-foot-badge">AODP</span>
          <span className="nav-label">Datos de la comunidad</span>
        </div>
      </div>
    </aside>
  );
}
