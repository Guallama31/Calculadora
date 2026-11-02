import { APP_NAME, SERVERS, QUALITIES } from '../../settings/index.js';
import { esc } from '../../services/format.js';

export function Header(shared, collapsed) {
  const serverOpts = SERVERS.map(o => `<option value="${o.value}" ${o.value === shared.server ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  const qualityOpts = QUALITIES.map(o => `<option value="${o.value}" ${o.value === String(shared.quality) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  return `
    <div class="header-left">
      <button type="button" id="nav-toggle" class="icon-btn" title="Contraer / expandir menú" aria-label="Contraer menú">
        <span class="hamburger">${collapsed ? '☰' : '☰'}</span>
      </button>
      <div class="brand"><span class="brand-dot"></span><strong>${APP_NAME}</strong></div>
    </div>
    <div class="header-right">
      <label class="header-field"><span>Servidor</span><select id="global-server">${serverOpts}</select></label>
      <label class="header-field"><span>Calidad</span><select id="global-quality">${qualityOpts}</select></label>
      <label class="header-toggle" title="4 % de impuesto con Premium, 8 % sin Premium">
        <input type="checkbox" id="global-premium" ${shared.premium ? 'checked' : ''}>
        <span class="switch"></span><span>Premium</span>
      </label>
    </div>`;
}
