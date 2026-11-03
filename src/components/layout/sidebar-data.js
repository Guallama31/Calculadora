/* Datos de navegación: misma forma que el SidebarData del ejemplo, pero con
   los módulos reales de Calculadora y sin workspaces ni usuarios ficticios. */
import {
  Hammer,
  Sparkles,
  Layers,
  Sprout,
  PawPrint,
  Package,
  FlaskConical,
  CookingPot,
  ArrowLeftRight,
  Table2,
  BookOpen,
  Database,
  LayoutDashboard,
  Wrench,
  TrendingUp,
} from 'lucide-react';
import { MODULES } from '../../settings/index.js';

export const MODULE_ICONS = {
  crafting: Hammer,
  enchanting: Sparkles,
  refining: Layers,
  farming: Sprout,
  animals: PawPrint,
  mounts: Package,
  alchemy: FlaskConical,
  cooking: CookingPot,
  flipping: ArrowLeftRight,
  prices: Table2,
};

const item = (id, children) => {
  const meta = MODULES.find(m => m.id === id);
  return {
    label: meta.label,
    icon: MODULE_ICONS[id],
    moduleId: id,
    href: `#${id}`,
    isActive: false,
    children: children || undefined,
  };
};

export const NAV_GROUPS = [
  {
    title: 'Producción',
    defaultOpen: true,
    icon: LayoutDashboard,
    items: [
      item('crafting', [
        { label: 'Calculadora', icon: Hammer, moduleId: 'crafting', href: '#crafting', tab: 'calc' },
        {
          label: 'Comparar ciudades',
          icon: TrendingUp,
          moduleId: 'crafting',
          href: '#crafting',
          tab: 'cities',
        },
      ]),
      item('enchanting'),
      item('refining'),
    ],
  },
  {
    title: 'Especialidades',
    defaultOpen: true,
    icon: Wrench,
    items: [item('farming'), item('animals'), item('mounts'), item('alchemy'), item('cooking')],
  },
  {
    title: 'Mercado',
    defaultOpen: true,
    icon: TrendingUp,
    items: [
      item('flipping', [
        { label: 'Flip', icon: ArrowLeftRight, moduleId: 'flipping', href: '#flipping', strategy: 'flip' },
        {
          label: 'Royal → BM',
          icon: ArrowLeftRight,
          moduleId: 'flipping',
          href: '#flipping',
          strategy: 'royalbm',
        },
        {
          label: 'Mejora',
          icon: ArrowLeftRight,
          moduleId: 'flipping',
          href: '#flipping',
          strategy: 'upgrade',
        },
        {
          label: 'Craft Trades',
          icon: ArrowLeftRight,
          moduleId: 'flipping',
          href: '#flipping',
          strategy: 'craft',
        },
        {
          label: 'Refining Trades',
          icon: ArrowLeftRight,
          moduleId: 'flipping',
          href: '#flipping',
          strategy: 'refine',
        },
      ]),
      item('prices', [
        { label: 'Ciudades', icon: Table2, moduleId: 'prices', href: '#prices', tab: 'cities' },
        { label: 'Por calidad', icon: Table2, moduleId: 'prices', href: '#prices', tab: 'quality' },
      ]),
    ],
  },
];

export const FOOTER_GROUP = {
  title: 'Soporte',
  items: [
    { label: 'Documentación', icon: BookOpen, href: '/docs/implementacion.md' },
    { label: 'Análisis de mercado', icon: Database, href: '/docs/analisis-albionmarkethub.md' },
  ],
};

export const sidebarData = {
  logo: { src: null, alt: 'Calculadora', title: 'Calculadora' },
  navGroups: NAV_GROUPS,
  footerGroup: FOOTER_GROUP,
};
