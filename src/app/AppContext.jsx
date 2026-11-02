import * as React from 'react';
import { DEFAULTS } from '../settings/index.js';
import { loadPrefs, savePrefs } from '../services/storage.js';
import { moduleIds } from '../modules/registry.jsx';

const AppContext = React.createContext(null);
export const useApp = () => React.useContext(AppContext);
const valid = id => moduleIds.includes(id);

export function AppProvider({ children }) {
  const [prefs, setPrefsState] = React.useState(() => ({ ...DEFAULTS, ...loadPrefs() }));
  const [active, setActive] = React.useState(() => valid(location.hash.slice(1)) ? location.hash.slice(1) : 'crafting');
  const [pending, setPending] = React.useState({ seq: 0 });

  const setPrefs = React.useCallback(patch => {
    setPrefsState(current => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const setShared = React.useCallback((key, value) => setPrefs({ [key]: value }), [setPrefs]);

  const navigate = React.useCallback((id, options = {}) => {
    if (!valid(id)) return;
    setPending(p => ({ seq: p.seq + 1, ...options }));
    setActive(id);
    if (location.hash.slice(1) !== id) history.pushState(null, '', `#${id}`);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    const onPop = () => {
      const id = location.hash.slice(1);
      if (valid(id)) { setActive(id); setPending({ seq: 0 }); }
    };
    window.addEventListener('hashchange', onPop);
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('hashchange', onPop); window.removeEventListener('popstate', onPop); };
  }, []);

  const shared = React.useMemo(() => ({
    server: prefs.server, quality: Number(prefs.quality), premium: prefs.premium !== false,
  }), [prefs.server, prefs.quality, prefs.premium]);

  const value = React.useMemo(() => ({
    prefs, setPrefs, shared, setShared, active, pending, navigate,
    collapsed: !!prefs.collapsed,
    toggleCollapse: () => setPrefs({ collapsed: !prefs.collapsed }),
  }), [prefs, setPrefs, shared, setShared, active, pending, navigate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
