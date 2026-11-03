# Calculadora

**Calculadora** es una app web para calcular la rentabilidad real de producir, encantar, refinar o revender ítems de Albion Online, y para encontrar oportunidades de mercado entre ciudades. Usa **8.382 recetas reales del juego**, los **precios del Albion Online Data Project**, los **bonus de producción por ciudad** y **todos los impuestos** que se pagan al vender. Servidor **Américas (West)** por defecto; también Asia (East) y Europa.

Stack: **React 18 + Vite 6 + Tailwind CSS 4 + componentes Radix/shadcn + lucide-react**. Los servicios de cálculo, catálogo y API son módulos ES puros reutilizados sin cambios.

## Diseño

- Fondo blanco / gris muy claro, tarjetas con bordes suaves, **azul** principal y **dorado** de acento; botones principales azules y ganancias positivas en verde.
- **Barra superior** (altura 56 px) con un único menú lateral desplegable, búsqueda global de módulos e ítems y controles compartidos de servidor / calidad / Premium.
- **Menú lateral desplegable** con 10 módulos agrupados en _Producción_, _Especialidades_ y _Mercado_, disponible en cualquier tamaño de pantalla.
- **Pestañas horizontales** dentro de cada módulo y distribución _configuración a la izquierda · resultados a la derecha_.
- Sin cuentas, avatares ni workspaces ficticios: la app no tiene login ni backend.

## Módulos

| Módulo                                                  | Qué hace                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crafteo**                                             | Calculadora completa: receta, materiales editables, RRR, diarios, tasa de estación, impuestos, comparativa Premium y comparación de ciudades. |
| **Encantamiento**                                       | El mismo motor sobre recetas de ítems encantados (runas, almas y reliquias).                                                                  |
| **Refinamiento**                                        | Recetas con bonus de ciudad, recetas alternativas con corazones y ranking de transmutación.                                                   |
| **Agricultura**, **Animales**, **Alquimia**, **Cocina** | La calculadora filtrada al catálogo de cada actividad.                                                                                        |
| **Monturas**                                            | Flujos separados de crianza y ensillado, con precios AODP/manuales, costos y crías promedio.                                                  |
| **Flipping**                                            | Escáner con 5 estrategias en pestañas: _Flip_, _Royal → BM_, _Mejora_, _Craft Trades_ y _Refining Trades_.                                    |
| **Precios**                                             | Matriz de precios por ciudad y comparativa por calidad, con antigüedad de cada dato.                                                          |

## Qué se puede configurar

- **Ítem y encantamiento**: buscador con autocompletado (nombre ES/EN o ID, tolerante a acentos) y chips `.0`–`.4`. La **búsqueda global** de la cabecera abre cualquier ítem directamente en Crafteo.
- **Dónde craftear / refinar**: la ciudad aplica su bonus real (base 0,18; +0,40 refinado; +0,15 por categoría; Focus +0,59; bonus diario) y calcula el RRR automáticamente. También existe modo _Automática_.
- **Dónde comprar** los materiales y **dónde vender** el ítem, con compra inmediata / orden de compra y venta directa / orden de venta.
- **Precios automáticos**: al elegir un ítem, la calculadora consulta AODP y completa materiales y precio de venta; en Crafteo y Encantamiento también compara las ciudades con cotización disponible y recomienda el mejor precio de venta. Al cargar precios se reemplazan los valores manuales. Diarios y tarifa de estación se introducen a mano.
- **Impuestos**: 4 % con Premium / 8 % sin Premium, tarifa de orden de venta 2,5 %, tarifa de orden de compra opcional y comparativa lado a lado con/sin Premium.
- **Diarios de crafteo** con fama, diarios vacíos y llenos.
- **Resultado**: desglose completo, ganancia neta, ROI, ganancia por ítem, precio de equilibrio y comparación de ganancia por ciudad.
- **Escáner**: filtros de categoría, tier, encantamiento, ciudad de compra, ciudades de venta, rutas seguras, RRR, Focus, bonus diario, tasa de estación, ganancia mínima, ROI mínimo, antigüedad máxima, orden y límite de filas. Cada fila se puede **abrir en la calculadora** con el ítem, las ciudades y los precios precargados.

## Cómo ejecutarla

```bash
npm install          # primera vez (Node ≥ 20)
npm run dev          # Vite en http://localhost:8000 (0.0.0.0, apto para preview)
npm run build        # bundle de producción en dist/ (incluye docs/)
npm run preview      # sirve dist/ en el puerto 8000
npm test             # pruebas con Vitest + Testing Library + jsdom
npm run test:coverage  # lo mismo con cobertura V8
npm run lint         # ESLint (React, hooks y variables sin usar)
npm run check        # verifica sintaxis de JS / JSX (esbuild + node --check)
npm run format       # Prettier sobre src/, tests/, tools/ y archivos raíz
npm run format:check # comprueba el formato sin escribir (lo usa el CI)
npm run catalog      # regenera data/catalog.js desde ao-bin-dumps (Python 3)
```

GitHub Actions ejecuta `format:check`, `lint`, `check`, `test` y `build` en cada push a `main` y en
cada PR (`.github/workflows/ci.yml`).

No se puede abrir `index.html` con doble clic: la app necesita el servidor de Vite para resolver JSX, Tailwind y los módulos.

## Estructura

```
Calculadora/
├── index.html                          # #root, estado de carga y favicon
├── package.json                        # scripts y dependencias
├── vite.config.js                      # React, Tailwind, host del preview, Vitest, copia de docs
├── eslint.config.js                    # reglas de lint
├── data/catalog.js                     # módulo ES con 8.382 recetas generadas (chunk aparte)
├── src/
│   ├── main.jsx                        # import() del catálogo + createRoot + AppProvider
│   ├── App.jsx                         # shell + barrera de errores + módulo activo
│   ├── app/AppContext.jsx              # router por hash, preferencias, estado compartido
│   ├── components/
│   │   ├── ui/                         # Button, Input, DropdownMenu, Sheet, ScrollArea, Separator
│   │   ├── layout/                     # ApplicationShell, MobileNav,
│   │   │                               # GlobalSearch, Logo, sidebar-data
│   │   ├── common/                     # Tabs, Field, DataTable, ResultCard, ItemSelector, ErrorBoundary
│   │   └── charts/PriceBars.jsx
│   ├── modules/
│   │   ├── crafting/CalculatorView.jsx # vista reutilizable de los 7 módulos de producción
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
├── public/favicon.svg
├── .github/workflows/ci.yml            # lint + check + test + build
└── docs/
    ├── analisis-albion-analytics.md    # análisis del repositorio de referencia (WPF, histórico)
    ├── analisis-albionmarkethub.md     # revisión de Albion Market Hub
    ├── implementacion.md               # arquitectura, fórmulas y decisiones
    └── informe-revision-2026-11-03.md  # revisión técnica y correcciones aplicadas
```

Todo el estado se guarda en `localStorage` (`calculadora-prefs-v1`): ciudad de crafteo, compra/venta, Focus, bonus diario, Premium, servidor, calidad y último ítem. Las cotizaciones válidas de AODP se guardan en IndexedDB (`calculadora-market-cache`, retención de 90 días) y se usan como referencia si la API falla o tarda más de 15 s.

## Fuentes y créditos

- Recetas, `itemValue`, bonuses por ciudad, nombres localizados y materiales de encantamiento: [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps), en el commit fijado `0483dd97f1581dfaf02eed42f25f5ea2a3cb75e5` (2026-11-02). El generador escribe ese SHA en la cabecera de `data/catalog.js` y acepta `--ref <sha>` para actualizar el catálogo a propósito.
- El dump no trae nombre para 83 IDs (mapas de mazmorra y varias monturas de evento). Esas entradas se marcan con `untranslated: true` y la interfaz muestra el ID con la etiqueta «sin nombre en el dump» en vez de inventar una traducción.
- Precios: [Albion Online Data Project](https://www.albion-online-data.com/api/) (datos subidos por la comunidad).
- Iconos: Albion Render Service y [lucide-react](https://lucide.dev/).
- Reglas de impuestos: [Albion Online Wiki – Marketplace](https://wiki.albiononline.com/wiki/Marketplace) y [Margin](https://wiki.albiononline.com/wiki/Margin).
- Lógica y modelo de datos inspirados en [Triky313/AlbionOnline-StatisticsAnalysis](https://github.com/Triky313/AlbionOnline-StatisticsAnalysis) (GPL-3.0), **reimplementados en JavaScript**.
- Shell, menús y hoja móvil adaptados de un bloque _ApplicationShell3_ de shadcnblocks (React + Radix + Tailwind).
- Funciones y filtros del escáner inspirados en [Albion Market Hub](https://albionmarkethub.com/trades); ver `docs/analisis-albionmarkethub.md`.
- Propuesta vigente para mejorar cobertura y manejo de precios: [`docs/cobertura-precios-propuesta.md`](docs/cobertura-precios-propuesta.md).

> Sin backend: la app selecciona automáticamente el endpoint regional de AODP y consulta un subconjunto acotado de ítems por búsqueda. No hay actualización periódica en segundo plano; las pantallas consultan AODP al solicitar o cambiar sus parámetros. Si la API responde `429`, reducí el número de ítems o esperá. Los precios también se pueden editar manualmente.

## Aviso

Herramienta educativa y de referencia, no afiliada a Sandbox Interactive ni a Albion Online. Los precios cambian constantemente: verificá siempre en el juego antes de invertir plata.
