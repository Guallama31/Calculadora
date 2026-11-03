import { cn } from '../../lib/utils.js';
export function Tabs({ id = 'tabs', tabs, active, onChange }) {
  return (
    <div className="tabs" id={id} role="tablist">
      {tabs.map(tab => (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={tab.id === active}
          className={cn('tab', tab.id === active && 'active')}
          data-tab={tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge && <span className="tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}
