import { cn } from '../../lib/utils.js';
import { sidebarData } from './sidebar-data.js';

export function Logo({ compact = false, className }) {
  return (
    <span className={cn('brand', compact && 'topbar-brand', className)}>
      <span className="brand-dot" />
      <strong>{sidebarData.logo.title}</strong>
    </span>
  );
}
