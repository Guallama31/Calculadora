import * as React from 'react';
import { MODULE_ICONS } from '../../components/layout/sidebar-data.js';
import { Tabs } from '../../components/common/Tabs.jsx';
import CalculatorView from '../crafting/CalculatorView.jsx';
import { useApp } from '../../app/AppContext.jsx';
import BreedingView from './BreedingView.jsx';

const TABS = [
  { id: 'breeding', label: 'Crianza' },
  { id: 'saddling', label: 'Ensillado' },
];
const mountFilter = entry => entry.categoryId === 'mounts' || /^T[0-9]_MOUNT/.test(entry.id);

export default function MountsView({ meta }) {
  const { pending } = useApp();
  const [tab, setTab] = React.useState(() =>
    pending?.itemId || pending?.opportunity ? 'saddling' : 'breeding',
  );
  const Icon = MODULE_ICONS.mounts;

  return (
    <div className="module-view" data-module="mounts">
      <div className="module-head">
        <div>
          <h1>
            <Icon className="size-5" />
            {meta?.label}
          </h1>
          <p>{meta?.description}</p>
        </div>
        <span className="module-badge">{meta?.group}</span>
      </div>
      <Tabs id="mounts-flow-tabs" tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'breeding' ? (
        <BreedingView />
      ) : (
        <CalculatorView
          moduleId="mounts"
          scopeLabel="Monturas"
          filter={mountFilter}
          meta={meta}
          showModuleHead={false}
        />
      )}
    </div>
  );
}
