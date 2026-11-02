import { MODULES, GROUPS } from '../../settings/index.js';
import { esc } from '../../services/format.js';

export function Sidebar(active, collapsed) {
  const groups = GROUPS.map(group => `
    <div class="nav-group">
      <div class="nav-group-title">${esc(group)}</div>
      ${MODULES.filter(m => m.group === group).map(m => `
        <button type="button" class="nav-item ${m.id === active ? 'active' : ''}" data-module="${m.id}" title="${esc(m.label)}">
          <span class="nav-icon">${m.icon}</span><span class="nav-label">${esc(m.label)}</span>
        </button>`).join('')}
    </div>`).join('');
  return `
    <div class="sidebar-inner">
      <nav class="nav-groups">${groups}</nav>
      <div class="sidebar-foot">
        <span class="sidebar-foot-badge">AODP</span>
        <span class="nav-label">Datos de la comunidad</span>
      </div>
    </div>`;
}
