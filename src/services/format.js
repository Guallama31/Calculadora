/* Formato y escape de HTML. */
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt = v => int.format(Number(v) || 0);
export const fmt2 = v => dec.format(Number(v) || 0);
export const fmt1 = v => dec1.format(Number(v) || 0);
export const pct = v => fmt2(v) + ' %';
export const money = v => fmt(v) + ' p';

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9@._]+/g, ' ').trim();
}

export function ageInfo(minutes) {
  if (!isFinite(minutes)) return { label: 'sin dato', tone: 'none' };
  const tone = minutes > 480 ? 'stale' : minutes > 240 ? 'old' : minutes > 120 ? 'warn' : 'fresh';
  const label = minutes < 60 ? Math.floor(minutes) + ' min'
    : minutes < 1440 ? Math.floor(minutes / 60) + ' h'
      : Math.floor(minutes / 1440) + ' d';
  return { label, tone };
}

export function ageFromDate(date) {
  if (!date) return { label: 'sin dato', tone: 'none', minutes: Infinity };
  const minutes = Math.max(0, (Date.now() - new Date(date).getTime()) / 60000);
  return { ...ageInfo(minutes), minutes };
}

export const profitClass = v => (Number(v) > 0 ? 'positive' : Number(v) < 0 ? 'negative' : 'neutral');
export const byId = id => document.getElementById(id);
