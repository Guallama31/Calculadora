/* Buscador de ítems con autocompletado, variantes de encantamiento y ficha. */
import * as catalog from '../../services/catalog.js';
import { esc, fmt } from '../../services/format.js';

export function ItemSelector({ id = 'item', placeholder = 'Buscar por nombre o ID…', filter = null } = {}) {
  return `
    <div class="item-selector" id="${esc(id)}-selector" data-filter="${filter ? '1' : '0'}">
      <div class="search-wrap">
        <input type="search" id="${esc(id)}-search" class="item-search" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false">
        <div class="suggestions" id="${esc(id)}-suggestions" hidden></div>
      </div>
      <div class="enchant-chips" id="${esc(id)}-chips"></div>
      <div class="item-card empty" id="${esc(id)}-card"><span>Elegí un ítem</span></div>
    </div>`;
}

export function mountItemSelector(root, { id = 'item', filter = null, onSelect = () => {}, quality = 1 } = {}) {
  const input = root.querySelector(`#${id}-search`);
  const box = root.querySelector(`#${id}-suggestions`);
  const chips = root.querySelector(`#${id}-chips`);
  const card = root.querySelector(`#${id}-card`);
  let current = null;
  let list = [];
  let cursor = -1;
  let timer = null;
  const AC = root.ownerDocument?.defaultView?.AbortController || AbortController;
  const controller = new AC();
  const opts = () => ({ signal: controller.signal });

  function renderCard(entry) {
    if (!entry) { card.className = 'item-card empty'; card.innerHTML = '<span>Elegí un ítem</span>'; return; }
    card.className = 'item-card';
    card.innerHTML = `
      <img src="${esc(catalog.icon(entry.id, quality))}" alt="">
      <div class="item-card-text">
        <strong>${esc(entry.es)}</strong>
        <small>${esc(entry.id)}</small>
        <div class="tags">
          <span class="pill">T${entry.tier}</span>
          <span class="pill gold">.${entry.lvl}</span>
          <span class="pill">${esc(entry.cat || '—')}</span>
          <span class="pill">valor ${fmt(entry.value)}</span>
          ${entry.amount > 1 ? `<span class="pill">×${entry.amount}</span>` : ''}
        </div>
      </div>`;
  }

  function renderChips(entry) {
    if (!entry) { chips.innerHTML = ''; return; }
    const variants = catalog.variants(entry.base);
    chips.innerHTML = variants.map(v => `<button type="button" class="chip ${v.id === entry.id ? 'active' : ''}" data-id="${esc(v.id)}">.${v.lvl}</button>`).join('');
  }

  function show(query) {
    list = catalog.search(query, 50, filter);
    cursor = -1;
    box.innerHTML = list.length ? list.map((entry, i) => `
      <div class="suggestion" data-index="${i}" data-id="${esc(entry.id)}">
        <img src="${esc(catalog.icon(entry.id, quality))}" alt="" loading="lazy">
        <div class="suggestion-text"><strong>${esc(entry.es)}</strong><small>${esc(entry.id)}</small></div>
        <span class="pill">T${entry.tier}</span>
        ${entry.lvl ? `<span class="pill gold">.${entry.lvl}</span>` : ''}
      </div>`).join('') : '<div class="suggestion muted">Sin resultados</div>';
    box.hidden = false;
  }

  function hide() { box.hidden = true; cursor = -1; }

  function highlight(index) {
    const nodes = box.querySelectorAll('.suggestion[data-index]');
    if (!nodes.length) return;
    cursor = (index + nodes.length) % nodes.length;
    nodes.forEach((n, i) => n.classList.toggle('active', i === cursor));
    nodes[cursor].scrollIntoView?.({ block: 'nearest' });
  }

  function select(entry) {
    if (!entry) return;
    current = entry;
    input.value = entry.es;
    renderChips(entry);
    renderCard(entry);
    hide();
    onSelect(entry);
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value;
    timer = setTimeout(() => show(q), 90);
  }, opts());
  input.addEventListener('focus', () => show(input.value), opts());
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); highlight(cursor + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(cursor - 1); }
    else if (event.key === 'Enter') { event.preventDefault(); select(list[cursor >= 0 ? cursor : 0]); }
    else if (event.key === 'Escape') hide();
  }, opts());
  box.addEventListener('click', event => {
    const node = event.target.closest('.suggestion[data-id]');
    if (node) select(catalog.get(node.dataset.id));
  }, opts());
  chips.addEventListener('click', event => {
    const chip = event.target.closest('.chip[data-id]');
    if (chip) select(catalog.get(chip.dataset.id));
  }, opts());
  document.addEventListener('click', event => {
    if (!event.target.closest(`#${id}-selector`)) hide();
  }, opts());

  function destroy() { clearTimeout(timer); controller.abort(); }

  return {
    getItem: () => current,
    setItem: entry => { current = entry; if (entry) input.value = entry.es; renderChips(entry); renderCard(entry); },
    setQuality: q => { quality = q; if (current) renderCard(current); },
    refresh: () => { if (current) renderCard(current); },
    destroy,
  };
}
