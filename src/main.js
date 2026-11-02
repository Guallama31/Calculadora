/* Punto de entrada: navegación lateral, preferencias compartidas y módulos. */
import { MODULES, DEFAULTS } from './settings/index.js';
import { AppShell, setCollapsed } from './components/layout/MainLayout.js';
import { Header } from './components/layout/Header.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { modules, moduleIds } from './modules/index.js';
import { loadPrefs, savePrefs } from './services/storage.js';
import { esc } from './services/format.js';

const root = document.getElementById('app');
let prefs = loadPrefs();
let shared = {
  server: prefs.server || DEFAULTS.server,
  quality: Number(prefs.quality) || 1,
  premium: prefs.premium !== false,
};
let active = validModule(location.hash.slice(1)) ? location.hash.slice(1) : 'crafting';
let opportunity = null;
let listeners = [];
let disposers = [];

function validModule(id) { return moduleIds.includes(id); }

export function setPref(keyOrObject, value) {
  if (typeof keyOrObject === 'object') Object.assign(prefs, keyOrObject);
  else prefs[keyOrObject] = value;
  savePrefs(prefs);
}

function setShared(key, value) {
  shared[key] = value;
  prefs[key] = value;
  savePrefs(prefs);
  listeners.forEach(cb => { try { cb(shared); } catch (error) { console.error(error); } });
}

function navigate(id, options = {}) {
  if (!validModule(id)) return;
  opportunity = options.opportunity || null;
  active = id;
  if (location.hash.slice(1) !== id) {
    history.pushState(null, '', `#${id}`);
  }
  renderShell();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ctx() {
  return {
    shared, prefs, navigate, setPref,
    opportunity,
    onSharedChange: cb => listeners.push(cb),
    onDestroy: cb => disposers.push(cb),
    setStatus: () => {},
  };
}

function renderShell() {
  disposers.forEach(fn => { try { fn(); } catch (error) { console.error(error); } });
  disposers = [];
  listeners = [];
  root.innerHTML = AppShell();
  root.querySelector('#app-header').innerHTML = Header(shared, !!prefs.collapsed);
  root.querySelector('#app-sidebar').innerHTML = Sidebar(active, !!prefs.collapsed);
  setCollapsed(root, !!prefs.collapsed);

  root.querySelector('#nav-toggle').addEventListener('click', () => {
    prefs.collapsed = !prefs.collapsed;
    savePrefs(prefs);
    setCollapsed(root, prefs.collapsed);
  });

  root.querySelectorAll('[data-module]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.module === active) return;
      navigate(button.dataset.module);
    });
  });

  root.querySelector('#global-server').addEventListener('change', event => setShared('server', event.target.value));
  root.querySelector('#global-quality').addEventListener('change', event => setShared('quality', Number(event.target.value)));
  root.querySelector('#global-premium').addEventListener('change', event => setShared('premium', event.target.checked));

  const content = root.querySelector('#app-content');
  const view = modules[active];
  try {
    content.innerHTML = view.render(ctx());
    view.mount(content, ctx());
  } catch (error) {
    console.error(error);
    content.innerHTML = `<section class="card error-card"><h2>No se pudo cargar el módulo</h2><p>${esc(error.message)}</p></section>`;
  }
  opportunity = null;
}

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (validModule(id) && id !== active) {
    active = id;
    opportunity = null;
    renderShell();
  }
});
window.addEventListener('popstate', () => {
  const id = location.hash.slice(1);
  if (validModule(id) && id !== active) {
    active = id;
    opportunity = null;
    renderShell();
  }
});

/* API mínima para depuración desde la consola. */
window.Calculadora = { navigate, get shared() { return shared; }, get prefs() { return prefs; }, modules: MODULES };

renderShell();
