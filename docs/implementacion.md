# Implementación

> Documenta la arquitectura de **Calculadora**, las fórmulas y las decisiones de diseño.
> El análisis del repositorio de referencia está en [`analisis-albion-analytics.md`](analisis-albion-analytics.md) (histórico); la revisión de Albion Market Hub, en [`analisis-albionmarkethub.md`](analisis-albionmarkethub.md).

## 1. Decisión de arquitectura

La app pasó por tres etapas: HTML original → HTML + módulos ES nativos → **React 18 + Vite 6 + Tailwind CSS 4 + Radix/shadcn**. La última migración fue una decisión explícita del usuario al adaptar el bloque *ApplicationShell3* y **revierte** la preferencia anterior de «HTML puro, sin build». Todo el historial queda en Git.

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Shell | React + Radix + Tailwind | Barra superior, menú lateral desplegable, búsqueda global y hoja móvil |
| Estado | `AppContext` (React) | Router por hash, preferencias, servidor/calidad/Premium, oportunidad pendiente |
| Vistas | Componentes `.jsx` por módulo | Configuración + resultados, pestañas horizontales |
| Lógica | Módulos ES puros en `src/services` | Catálogo, API, motor de cálculo, bonus, formato, storage |
| Build | Vite + `@vitejs/plugin-react` + `@tailwindcss/vite` | Dev server, bundle, Vitest, ESLint |

La lógica de negocio **no se reescribió**: `catalog.js`, `api.js`, `engine.js`, `bonus.js`, `format.js` y `storage.js` son los mismos módulos sin DOM de la etapa anterior. Solo se reemplazó la capa de UI.

```text
index.html                            # placeholder «Cargando…» + favicon
  └─ src/main.jsx                     import() del catálogo + createRoot + ErrorBoundary
       └─ src/App.jsx                 ApplicationShell + ErrorBoundary + módulo activo
            ├─ src/app/AppContext.jsx       estado compartido y navegación
            ├─ src/components/ui/*          primitivas shadcn (Radix)
            ├─ src/components/layout/*     barra superior, menú lateral, hoja móvil, logo, datos de nav
            ├─ src/components/common/*     Tabs, Field, DataTable, ResultCard, ItemSelector, ErrorBoundary
            ├─ src/components/charts/*     PriceBars / ProfitBars
            ├─ src/modules/*              CalculatorView, ScannerView, PricesView, MountsView, registry
            ├─ src/settings/index.js       constantes
            ├─ src/services/*              lógica pura (sin React)
            └─ data/catalog.js             catálogo generado (~5 MB, chunk aparte)
```

El catálogo **no** se importa de forma estática: `main.jsx` lo pide con `import()` dinámico, lo
registra con `initializeCatalog()` y recién entonces monta React. Así el HTML y el CSS pintan
primero un estado de carga, y los ~5 MB quedan en un chunk `catalog` que el navegador cachea
entre despliegues de la aplicación. `tests/setup.js` inicializa el catálogo para las pruebas.

Cada entrada de `registry.jsx` es un componente React `{ meta, render implícito }`. `App.jsx` usa `key={active + ':' + pending.seq}` para que al elegir un subménú (por ejemplo «Comparar ciudades») el módulo se remonte y lea las opciones pendientes (`tab`, `strategy`, `itemId`, `opportunity`).

## 2. El shell adaptado

Del bloque *ApplicationShell3* se conservaron, adaptados a nuestra app:

- **Barra superior sticky** de 56 px con logo, navegación por grupos, búsqueda y zona derecha.
- **`MobileNav`** (menú lateral desplegable): un `Sheet` (Radix Dialog) con scroll, tres grupos
  (`Producción`, `Especialidades`, `Mercado`), submenús que apuntan a pestañas y estrategias reales,
  separador y grupo de soporte; se cierra al navegar. Es el **único** menú de navegación y está
  disponible en cualquier tamaño de pantalla (no hay barra lateral fija).
- **`GlobalSearch`**: busca módulos e ítems del catálogo en un mismo campo; al elegir un ítem navega a Crafteo con `itemId` y lo preselecciona.
- **`cn()`** (`clsx` + `tailwind-merge`), `Button`, `Input`, `DropdownMenu*`, `Sheet*`, `ScrollArea`, `Separator`, iconos `lucide-react` y los tokens `@theme` de Tailwind 4 mapeados a nuestra paleta.

Lo que **no** se copió: `NavUser` (avatar, *Account*, *Log out*), el selector de `workspaces`, los datos de `person1`, el logo externo de shadcnblocks y las clases `dark:`. La app no tiene login ni backend, y la marca debe ser exactamente **Calculadora**, sin subtítulos. En su lugar, la zona derecha muestra servidor, calidad y Premium.

Los grupos del menú se definen en `src/components/layout/sidebar-data.js`, que es la única fuente
de la navegación; `MODULES[].group` en `src/settings/index.js` solo alimenta la insignia del
encabezado y debe coincidir con esos títulos. El menú incluye las **cinco** estrategias del escáner
(*Flip*, *Royal → BM*, *Mejora*, *Craft Trades* y *Refining Trades*).

**Barrera de errores.** `ErrorBoundary` (`src/components/common/ErrorBoundary.jsx`) envuelve cada
módulo en `App.jsx` con `key={active + ':' + pending.seq}`: si una vista lanza durante el render se
muestra un mensaje con «Reintentar» y «Recargar», la navegación sigue funcionando y, al cambiar de
módulo, el error se descarta solo. `main.jsx` usa otra barrera para fallos del shell y una pantalla
de error específica si el catálogo no se puede descargar.

## 3. Diseño visual

- Fondo `--bg: #f5f7fb`, superficies blancas, bordes suaves `#e0e6f0` y sombras mínimas.
- Azul `#1e5ed0` para acciones principales, navegación activa y gráficos; dorado `#d3a12c` para acentos, presets y campos manuales; verde `#16804b` para ganancias positivas.
- Pestañas horizontales con subrayado azul. En pantallas anchas, `.work-grid` divide la pantalla en configuración (≤385 px) y resultados; por debajo de 980 px se apila.
- Tres hojas: `index.css` (Tailwind 4 + tokens), `main.css` (tarjetas, tablas, resultados) y `shell.css` (barra superior, menús, búsqueda, hoja móvil). Sin fuentes externas.

## 4. Catálogo y precios

`tools/generate_catalog.py` descarga `items.json` y `formatted/items.json` de [`ao-data/ao-bin-dumps`](https://github.com/ao-data/ao-bin-dumps) **en el commit fijado** `0483dd97f1581dfaf02eed42f25f5ea2a3cb75e5` (2026-11-02, modificable con `--ref <sha>` y `--out <ruta>`) y genera `data/catalog.js` como **módulo ES** (`export const CATALOG`), con el SHA en la cabecera para que el catálogo sea reproducible. Regenerarlo con ese mismo commit produce un archivo idéntico al versionado. Contiene los ítems T2–T8 que tienen receta de fabricación en los dumps, con encantamientos disponibles `.0`–`.4`, nombres ES/EN, `itemValue`, materiales (`ret:false`, `max`), recetas alternativas con corazones (`alternateRes`), diarios, `ccat`, `refine` y `upgrade`. Para los refinados encantados registra los IDs de mercado `T4_PLANKS_LEVEL1@1` y sus materiales de receta, aunque no figuren como una receta normal de encantamiento. No es la lista completa de todo objeto del juego: los objetos sin receta de fabricación no se incluyen como resultados seleccionables. 23 entradas (fichas de habilidad y alquimia rara) no traen `itemValue`; la interfaz lo advierte porque, sin ese valor, la nutrición y la tasa de estación quedan en 0. El dump tampoco nombra 83 IDs (mapas `T*_RANDOM_DUNGEON_*_TOKEN*`, prototipos `T*_*_PROTOTYPE` y monturas de evento como `UNIQUE_MOUNT_PANDA_TELLAFRIEND`): el generador los exporta con `untranslated: true` y la interfaz muestra el ID con la etiqueta «sin nombre en el dump».

El módulo se carga con `import()` dinámico (ver §1) y el servidor de desarrollo lo sirve sin transformar para no inflar la respuesta con un sourcemap inline.

Auditoría del catálogo actual contra `ao-bin-dumps` actualizado el 2026-11-02 (commit [`0483dd9`](https://github.com/ao-data/ao-bin-dumps/commit/0483dd97f1581dfaf02eed42f25f5ea2a3cb75e5)): 8.382 entradas, 8.382 IDs únicos y 2.626 IDs base; se añadieron 80 variantes de refinados encantados. Todos los IDs base están en los datos oficiales del juego. La serie Matadragones está incluida: búsqueda en español devuelve 75 variantes de 15 piezas base (armaduras de cabeza, pecho y pies de tiers 4–8, con encantamientos). El problema era que el selector limitaba la búsqueda a 40 coincidencias y la búsqueda global a 8. Ahora ambos muestran 100 por página y permiten ampliar resultados cuando hay más.

### Refinamiento

En lugar de buscar por nombre, Refinamiento permite seleccionar el tipo de salida (tablas, lingotes, cuero, tela o bloques), el tier y el encantamiento disponible en el dump del juego. La combinación resuelve la entrada de catálogo y consulta su ID de mercado y receta real. Piedra no ofrece encantamientos en los datos del juego. Las variantes encantadas de los otros refinados usan como materiales el recurso encantado del tier seleccionado y el refinado previo normal, de acuerdo con las recetas de `items.json`. Para 85 variantes de refinados, el catálogo incluye también la receta alternativa oficial que sustituye una unidad del recurso principal por un corazón de ciudad. La receta principal siempre se muestra; la opción alternativa se activa voluntariamente y cambia los materiales, precios y cálculo de costes sin modificar la receta primaria.

La pestaña **Transmutación** rankea las conversiones de recursos T4–T8 al siguiente tier o encantamiento disponible. Cada candidato consume una unidad del recurso de origen y genera una del destino; se descuenta la tasa fija de plata del juego por cada salto, el impuesto de venta (4 % con Premium / 8 % sin Premium), las tarifas de órdenes cuando correspondan y un impuesto de estación configurable. Los costos por salto se basan en la tabla posterior a Wild Blood de [Albion Online Wiki · Transmuting](https://wiki.albiononline.com/wiki/Transmuting) y en los valores publicados por la comunidad en [octubre de 2023](https://www.reddit.com/r/albiononline/comments/17eo9jl/transmutation_cost/); el flujo y el requisito mínimo T4 están descritos en la [guía oficial de Refinamiento](https://albiononline.com/news/guide-refining). Los precios proceden de AODP, se solicitan por lotes y nunca se extrapolan. Si falta una cotización, el resultado queda pendiente y se puede ingresar el precio manualmente; el ranking tampoco incluye transporte.

Como el archivo pesa ~5 MB y es ESM puro, `vite.config.js` incluye un pequeño middleware (`catalog-static`) que lo sirve **sin transformar en desarrollo**. Sin esto, Vite le inyecta un sourcemap inline que infla la respuesta a ~28 MB.

`src/services/api.js` consulta `/api/v2/stats/prices/{ids}.json?locations=…&qualities=…` en West, East o Europe, agrupando varios ítems, ciudades y calidades por petición y evitando la caché HTTP del navegador. Deduplica peticiones simultáneas, respeta `RateLimit-Reset` en un `429` y traduce un `TypeError` de `fetch` a un mensaje de posible bloqueo CORS. Las vistas actualizan al seleccionar un ítem o cambiar filtros; el usuario también puede solicitar una actualización manual.

Cada consulta tiene un **tiempo máximo de espera** (`PRICE_REQUEST_TIMEOUT_MS`, 15 s) y acepta una
`AbortSignal`: CalculatorView, PricesView, BreedingView y el escáner cancelan la petición anterior al
cambiar de ítem o de filtros y al desmontarse, y el escáner ofrece un botón «Cancelar búsqueda». Al
cancelar se libera la entrada de deduplicación de inmediato; una cancelación del usuario nunca se
informa como error ni se responde con la caché. Si vence el tiempo de espera o falla la red, se
intenta la **caché local en IndexedDB** (`src/services/price-cache.js`): claves por servidor, ítem,
ciudad y calidad, observaciones de compra y venta con fechas independientes, retención de 90 días y
depuración cada 24 h. Una fila inválida ya no aborta el lote completo.

| Modo | Campo AODP | Uso |
|---|---|---|
| Compra inmediata / orden de venta | `sell_price_min` | precio al que comprás o listás |
| Venta directa / orden de compra | `buy_price_max` | precio al que te compran |

Cada precio muestra su antigüedad (verde <2 h, dorado <4 h, rojo >4 h). La opción «Menor precio registrado» busca cotizaciones reales en las ocho ubicaciones y conserva la ciudad y la fecha de la cotización seleccionada: no promedia ni completa datos ausentes. Si AODP no devuelve un precio positivo, la interfaz indica «No se registra precio», deja el campo vacío y habilita la carga manual. El resultado de rentabilidad permanece oculto hasta que todos los precios necesarios estén cargados.

### Actualización y cobertura de precios

La fuente es [Albion Online Data Project (AODP)](https://www.albion-online-data.com/), que distribuye datos aportados por jugadores. La API separa los servidores (West, East y Europe) y permite consultar IDs de ítem, ubicaciones y calidades; cada servidor publica su [documentación de API](https://www.albion-online-data.com/api/). Las ciudades no son necesariamente igual de recientes: se conserva y muestra la fecha entregada por AODP, sin convertir un precio antiguo en uno actual.

AODP explica que su [cliente comunitario](https://github.com/ao-data/albiondata-client/releases) solo puede aportar las órdenes de mercado que el jugador carga en el juego. Para mejorar la cobertura, se puede ejecutar ese cliente mientras se recorren los mercados de las ciudades/servidor/calidades buscados y luego volver a actualizar la consulta. La Calculadora no consulta históricos ni extrapola precios de otra calidad, ciudad o servidor; sin una cotización válida, el usuario puede introducir el valor manualmente.

## 5. Motor de cálculo

`src/services/engine.js` es puro (sin DOM ni React). Fórmulas reimplementadas en JS a partir del análisis de `Triky313/AlbionOnline-StatisticsAnalysis`:

```text
salida            = crafteos × amount
bruto_material    = cantidad_por_crafteo × crafteos
devuelto          = retornable ? min(bruto_material × RRR, maxReturn × crafteos) : 0
coste_material    = (bruto_material − devuelto) × precio
nutrición         = itemValue × 0,1125 × crafteos
tasa_estación     = ceil(tarifa_por_100 × nutrición / 100)       // tarifa manual
impuesto_venta    = ceil(ingreso_bruto × (premium ? 0,04 : 0,08))
tarifa_orden      = modo_venta === 'order'
                    ? ceil(ingreso_bruto × 0,025) × (1 + republicaciones) : 0
orden_compra      = activa ? ceil(coste_materiales_neto × 0,025) : 0
coste_total       = materiales_netos + tasa_estación + orden_compra + diarios_vacíos + otros
ingreso_neto      = ingreso_bruto − impuesto_venta − tarifa_orden + diarios_llenos
ganancia          = ingreso_neto − coste_total
ROI               = ganancia / coste_total × 100
equilibrio        = (coste_total − diarios_llenos) / salida / (1 − tasa_impuesto − tarifa_orden)
```

- El impuesto de transacción se aplica **siempre** (4 % Premium / 8 % sin Premium); la tarifa de orden **solo** en orden de venta y **no cambia con Premium**. Los impuestos se redondean hacia arriba.
- `calculate()` ejecuta el escenario dos veces y entrega `premiumComparison` para la tarjeta «Comparativa Premium».
- `calculateFlip()` hace lo mismo para arbitraje puro.
- **RRR:** `bonusFor()` combina base de ciudad (0,18; refugio 0,15; isla 0), especialidad (+0,40 refinado, +0,15 categoría), Focus (+0,59) y bonus diario; `RRR = bonus / (1 + bonus)`. `bestCityFor()` elige la ciudad óptima para el modo *Automática*.

En React, `CalculatorView.jsx` guarda la configuración y los precios en estado y deriva `rrr`, `bonus` y `result` con `useMemo`; no hay manipulación directa del DOM.

## 6. Escáner

`src/modules/flipping/scanner.js` (JS puro) selecciona candidatos por tier/encantamiento/categoría/búsqueda, calcula los IDs necesarios, agrupa en lotes de ≤30 IDs respetando el límite de longitud de URL de AODP y evalúa todas las combinaciones de ciudades con el mismo `engine`. Cinco estrategias:

- **Flip** — comprar barato, vender caro.
- **Royal → BM** — destino fijo Mercado Negro y venta directa.
- **Mejora** — comprar el ítem del encantamiento anterior y su runa, alma o reliquia, y vender el
  ítem resultante. No suma tasa de estación (el encantamiento con runas se resuelve en el inventario
  y el modelo no le asigna costo de plata); si en tu caso pagás una tarifa, agregala en «Abrir
  encantamiento».
- **Craft Trades** — `calculate()` con receta real, RRR de la ciudad y tasa de estación.
- **Refining Trades** — igual, sobre las recetas con `refine: true`.

Las filas se publican **por unidad**: coste, venta, impuestos, tarifas y ganancia se dividen por las
unidades producidas, de modo que la columna «Ganancia / u» y las de impuestos son comparables.

Filtros: ganancia mínima, ROI mínimo, antigüedad máxima, orden, límite, rutas seguras, permiso de misma ciudad e inclusión del Mercado Negro. «Abrir en calculadora» pasa la fila por `AppContext` (`opportunity`) y precarga ítem, ciudades, modos, RRR, Focus, tasa de estación y precios.

## 7. Monturas: crianza y ensillado

Monturas tiene dos flujos separados: **Crianza** y **Ensillado**. Ensillado reutiliza la calculadora de fabricación y sus recetas; Crianza usa los registros de bebé/adulto, tiempo de crecimiento, chance y cantidad promedio de crías, plata de crianza, nutrientes y categorías de alimento exportados desde los dumps oficiales en `data/catalog.js`.

El alimento sugerido se calcula como `ceil(ceil(growTime / secondsPerNutrition) / nutritionPerFood)` y se puede modificar manualmente. Es una estimación a partir de los datos del dump, no una garantía de consumo exacto en cada ciclo. El dump distingue `@favorite` de `@foodcategory`: marca comidas favoritas para animales de granja (por ejemplo, trigo para gallinas y nabos para cabras), pero no asigna favoritos a los animales de montura incluidos; para estos solo declara las categorías aceptadas (plantas, carne o monturas). La interfaz muestra esta diferencia en lugar de suponer que un alimento de la misma categoría sea favorito. Las crías obtenidas se muestran como promedio estadístico (`cantidad × probabilidad × crías por éxito`); no representan una cantidad garantizada. El bonus y el costo de Focus del dump se exponen como datos de referencia pero **no se incorporan al resultado**, ya que su aplicación por ciclo no está validada.

Fuente de mecánicas y atributos: [ao-bin-dumps/items.json](https://github.com/ao-data/ao-bin-dumps/blob/master/items.json), campos `consumption.food.acceptedfood.@foodcategory`, `@favorite` y `@favoritebonus` de `farmableitem`.

La calculadora consulta AODP para la cría y el alimento al comprar, y el animal adulto y las crías al vender. Permite elegir ciudades, modo de compra/venta y completar manualmente los precios que no existan. El costo suma compras, plata de crianza y tarifa de orden de compra cuando aplica. Ingresos por ventas descuentan el impuesto Premium/no Premium y las tarifas de orden correspondientes. Las crías conservadas se muestran como valor de mercado separado y no como ganancia realizada. No se informa rentabilidad hasta cargar todos los precios necesarios.

## 8. Verificación

```bash
npm run lint        # ESLint (js.configs.recommended + react-hooks + jsx-uses-vars)
npm run check       # sintaxis de JS/JSX (esbuild + node --check)
npm test            # pruebas Vitest + Testing Library + jsdom
npm run test:coverage   # lo mismo con cobertura V8
npm run build       # bundle de producción
npm run dev         # servidor en 0.0.0.0:8000
```

`npm run format` aplica Prettier de forma manual; el código existente todavía no se reformateó para
no mezclar un diff masivo con los cambios funcionales.

Las pruebas cubren: marca exacta, barra superior y 10 módulos, menú lateral desplegable y submenús,
hoja móvil, búsqueda global, autocompletado y chips `.0`–`.4`, receta y desglose, impuestos 4/8 %,
RRR por ciudad y Focus, carga de precios, `429`, CORS, tiempo de espera y cancelación de consultas,
comparación de ciudades, las 5 estrategias del escáner, puente «Abrir en calculadora», matriz de
precios por ciudad y calidad, cálculo de crianza, elección de cotización según el modo de venta,
crías retenidas, precios ausentes/manuales, caché local (retención y depuración), navegación entre
Crianza/Ensillado, precarga de monturas desde búsqueda global, fórmulas del motor de cálculo y la
barrera de errores. El `fetch` de AODP se simula en `tests/fixtures.js`.

El repositorio incluye un flujo de GitHub Actions (`.github/workflows/ci.yml`) que ejecuta
`lint`, `check`, `test` y `build` en cada push a `main` y en cada pull request.

## 9. Límites conocidos

- Sin backend no hay histórico, volumen, login, Market P2P, Builds ni escaneo de miles de ítems en milisegundos.
- CORS de AODP depende del navegador y de la conexión; la app selecciona el endpoint regional automáticamente y ofrece edición manual si no se pueden obtener precios.
- Los precios son comunitarios: pueden faltar o estar desactualizados. Siempre hay que verificar en el juego.
