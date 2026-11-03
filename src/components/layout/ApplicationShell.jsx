import { MobileNav } from './MobileNav.jsx';
import { GlobalSearch } from './GlobalSearch.jsx';
import { Logo } from './Logo.jsx';
import { SERVERS } from '../../settings/index.js';
import { useApp } from '../../app/AppContext.jsx';

export function ApplicationShell({ children }) {
  const { shared, setShared } = useApp();
  return (
    <>
      <header className="header topbar">
        <div className="topbar-inner">
          <MobileNav />
          <Logo compact />
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
