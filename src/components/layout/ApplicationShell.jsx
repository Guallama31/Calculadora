import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { MobileNav } from './MobileNav.jsx';
import { NavDropdown } from './NavDropdown.jsx';
import { GlobalSearch } from './GlobalSearch.jsx';
import { Logo } from './Logo.jsx';
import { NAV_GROUPS } from './sidebar-data.js';
import { SERVERS, QUALITIES } from '../../settings/index.js';
import { useApp } from '../../app/AppContext.jsx';

export function ApplicationShell({ children }) {
  const { collapsed, toggleCollapse, shared, setShared } = useApp();
  return (
    <>
      <header className="header topbar">
        <div className="topbar-inner">
          <MobileNav />
          <Button variant="ghost" size="icon" onClick={toggleCollapse}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
          <Logo compact />
          <nav className="topbar-nav desktop-only" aria-label="Navegación principal">
            {NAV_GROUPS.map(group => <NavDropdown key={group.title} group={group} />)}
          </nav>
          <div className="topbar-right">
            <GlobalSearch />
            <span className="topbar-divider" />
            <label className="topbar-field">
              <span>Servidor</span>
              <select id="global-server" className="topbar-select" value={shared.server} onChange={e => setShared('server', e.target.value)}
                aria-label="Servidor">
                {SERVERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="topbar-field">
              <span>Calidad</span>
              <select id="global-quality" className="topbar-select" value={shared.quality} onChange={e => setShared('quality', Number(e.target.value))}
                aria-label="Calidad">
                {QUALITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="topbar-toggle" title="4 % de impuesto con Premium, 8 % sin Premium">
              <input id="global-premium" type="checkbox" checked={shared.premium} onChange={e => setShared('premium', e.target.checked)} />
              <span className="switch" /><span>Premium</span>
            </label>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
