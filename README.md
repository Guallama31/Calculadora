# Calculadora

**Calculadora** es una app web para calcular la rentabilidad real de producir, encantar, refinar o revender ítems de Albion Online, y para encontrar oportunidades de mercado entre ciudades. Usa **8.302 recetas reales del juego**, los **precios del Albion Online Data Project**, los **bonus de producción por ciudad** y **todos los impuestos** que se pagan al vender. Servidor **Américas (West)** por defecto; también Asia (East) y Europa.

Stack: **React 18 + Vite 6 + Tailwind CSS 4 + componentes Radix/shadcn + lucide-react**. Los servicios de cálculo, catálogo y API son módulos ES puros reutilizados sin cambios.

## Diseño

- Fondo blanco / gris muy claro, tarjetas con bordes suaves, **azul** principal y **dorado** de acento; botones principales azules y ganancias positivas en verde.
- **Barra superior** (altura 56 px) adaptada de *ApplicationShell3*: menús desplegables por grupo, búsqueda global de módulos e ítems, hoja deslizante para móvil y controles compartidos de servidor / calidad / Premium.
- **Navegación lateral contraíble** con 10 módulos agrupados en *Producción*, *Especialidades* y *Mercado*; el estado del colapso se guarda en `localStorage`.
- **Pestañas horizontales** dentro de cada módulo y distribución *configuración a la izquierda · resultados a la derecha*.
- Sin cuentas, avatares ni workspaces ficticios: la app no tiene login ni backend.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Crafteo** | Calculadora completa: receta, materiales editables, RRR, diarios, tasa de estación, impuestos, comparativa Premium y comparación de ciudades. |
| **Encantamiento** | El mismo motor sobre recetas de ítems encantados (runas, almas y reliquias). |
| **Refinamiento** | Recetas de refinado con el bonus real de la ciudad. |
| **Agricultura**, **Animales**, **Monturas**, **Alquimia**, **Cocina** | La misma calculadora filtrada al catálogo de cada actividad. |
| **Flipping** | Escáner con 4 estrategias en pestañas: *Flip*, *Royal → BM*, *Craft Trades* y *Refining Trades*. |
| **Precios** | Matriz de precios por ciudad y comparativa por calidad, con antigüedad de cada dato. |

## Qué se puede configurar

- **Ítem y encantamiento**: buscador con autocompletado (nombre ES/EN o ID, tolerante a acentos) y chips `.0`–`.4`. La **búsqueda global** de la cabecera abre cualquier ítem directamente en Crafteo.
- **Dónde craftear / refinar**: la ciudad aplica su bonus real (base 0,18; +0,40 refinado; +0,15 por categoría; Focus +0,59; bonus diario) y calcula el RRR automáticamente. También existe modo *Automática*.
- **Dónde comprar** los materiales y **dónde vender** el ítem, con compra inmediata / orden de compra y venta directa / orden de venta.
- **Precios manuales** para materiales, venta, diarios y tarifa de estación (introducida a mano). «Cargar precios del mercado» completa los datos desde AODP y **respeta los valores manuales** salvo que se active «Sobrescribir».
- **Impuestos**: 4 % con Premium / 8 % sin Premium, tarifa de orden de venta 2,5 % (más republicaciones), tarifa de orden de compra opcional y comparativa lado a lado con/sin Premium.
- **Diarios de crafteo** con fama, diarios vacíos y llenos.
- **Resultado**: desglose completo, ganancia neta, ROI, ganancia por ítem, precio de equilibrio y comparación de ganancia por ciudad.
- **Escáner**: filtros de categoría, tier, encantamiento, ciudad de compra, ciudades de venta, rutas seguras, RRR, Focus, bonus diario, tasa de estación, ganancia mínima, ROI mínimo, antigüedad máxima, orden y límite de filas. Cada fila se puede **abrir en la calculadora** con el ítem, las ciudades y los precios precargados.

## Cómo ejecutarla

```bash
npm install          # primera vez
npm run dev          # Vite en http://localhost:8000 (0.0.0.0, apto para preview)
npm run build        # bundle de producción en dist/
npm run preview      # sirve dist/ en el puerto 8000
npm test             # 13 pruebas con Vitest + Testing Library + jsdom
npm run check        # verifica sintaxis de JS / JSX (esbuild + node --check)
npm run catalog      # regenera data/catalog.js desde ao-bin-dumps (Python 3)
```

No se puede abrir `index.html` con doble clic: la app necesita el servidor de Vite para resolver JSX, Tailwind y los módulos.

## Estructura

```
Calculadora/
├── index.html                          # #root + /src/main.jsx
├── package.json                        # scripts y dependencias
├── vite.config.js                      # React, Tailwind, host del preview, Vitest
├── data/catalog.js                     # módulo ES con 8.302 recetas generadas
├── src/
│   ├── main.jsx                        # createRoot + AppProvider
│   ├── App.jsx                         # shell + sidebar + módulo activo
│   ├── app/AppContext.jsx              # router por hash, preferencias, estado compartido
│   ├── components/
│   │   ├── ui/                         # Button, Input, DropdownMenu, Sheet, ScrollArea, Separator
│   │   ├── layout/                     # ApplicationShell, Sidebar, NavDropdown, MobileNav,
│   │   │                               # GlobalSearch, Logo, sidebar-data
│   │   ├── common/                     # Tabs, Field, DataTable, ResultCard, ItemSelector
│   │   └── charts/PriceBars.jsx
│   ├── modules/
│   │   ├── crafting/CalculatorView.jsx # vista reutilizable de los 8 módulos de producción
│   │   ├── flipping/                   # scanner.js + ScannerView.jsx
│   │   ├── prices/PricesView.jsx
│   │   ├── enchanting/ refining/ farming/ animals/ mounts/ alchemy/ cooking/
│   │   └── registry.jsx                # registro de módulos
│   ├── lib/utils.js                    # cn() = clsx + tailwind-merge
│   ├── settings/index.js               # ciudades, impuestos, módulos, defaults
│   ├── services/                       # catalog, api, engine, bonus, format, storage (JS puro)
│   └── styles/                         # index.css (Tailwind), main.css, shell.css
├── tools/
│   ├── check.mjs                       # verificación de sintaxis
│   └── generate_catalog.py             # regenera el catálogo
├── tests/                              # setup, fixtures AODP y pruebas de la app
└── docs/
    ├── analisis-albion-analytics.md    # análisis del repositorio de referencia (WPF, histórico)
    ├── analisis-albionmarkethub.md     # revisión de Albion Market Hub
    └── implementacion.md               # arquitectura, fórmulas y decisiones
```

Todo el estado se guarda en `localStorage` (`calculadora-prefs-v1`): ciudad de crafteo, compra/venta, Focus, bonus diario, colapso de la barra, Premium, servidor, calidad y último ítem.

## Fuentes y créditos

- Recetas, `itemValue`, bonuses por ciudad, nombres localizados y materiales de encantamiento: [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps).
- Precios: [Albion Online Data Project](https://www.albion-online-data.com/api/) (datos subidos por la comunidad).
- Iconos: Albion Render Service y [lucide-react](https://lucide.dev/).
- Reglas de impuestos: [Albion Online Wiki – Marketplace](https://wiki.albiononline.com/wiki/Marketplace) y [Margin](https://wiki.albiononline.com/wiki/Margin).
- Lógica y modelo de datos inspirados en [Triky313/AlbionOnline-StatisticsAnalysis](https://github.com/Triky313/AlbionOnline-StatisticsAnalysis) (GPL-3.0), **reimplementados en JavaScript**.
- Shell, menús y hoja móvil adaptados de un bloque *ApplicationShell3* de shadcnblocks (React + Radix + Tailwind).
- Funciones y filtros del escáner inspirados en [Albion Market Hub](https://albionmarkethub.com/trades); ver `docs/analisis-albionmarkethub.md`.

> Sin backend: el escáner consulta la API pública directamente y analiza un subconjunto acotado de ítems por búsqueda. No hay auto-refresh; si la API responde `429`, reducí el número de ítems o esperá. La app ofrece precios manuales y un proxy CORS opcional.

## Aviso

Herramienta educativa y de referencia, no afiliada a Sandbox Interactive ni a Albion Online. Los precios cambian constantemente: verificá siempre en el juego antes de invertir plata.
