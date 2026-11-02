export function AppShell() {
  return `
    <div class="shell" id="shell">
      <header class="header" id="app-header"></header>
      <div class="shell-body">
        <aside class="sidebar" id="app-sidebar"></aside>
        <main class="main" id="app-content"></main>
      </div>
    </div>`;
}

export function setCollapsed(root, collapsed) {
  root.querySelector('#shell')?.classList.toggle('collapsed', collapsed);
  const btn = root.querySelector('#nav-toggle');
  if (btn) {
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? 'Expandir menú' : 'Contraer menú';
  }
}

export function ModuleHead(module, tabsHtml = '') {
  return `
    <div class="module-head">
      <div>
        <h1>${module.icon} ${module.label}</h1>
        <p>${module.description}</p>
      </div>
    </div>
    ${tabsHtml}`;
}
