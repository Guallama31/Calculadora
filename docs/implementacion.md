# Implementación

> Documenta la arquitectura de **Calculadora**, las fórmulas y las decisiones de diseño.
> El análisis del repositorio de referencia está en [`analisis-albion-analytics.md`](analisis-albion-analytics.md) (histórico); la revisión de Albion Market Hub, en [`analisis-albionmarkethub.md`](analisis-albionmarkethub.md).

## 1. Decisión de arquitectura

La app pasó por tres etapas: HTML original → HTML + módulos ES nativos → **React 18 + Vite 6 + Tailwind CSS 4 + Radix/shadcn**. La última migración fue una decisión explícita del usuario al adaptar el bloque *ApplicationShell3* y **revierte** la preferencia anterior de «HTML puro, sin build». Todo el historial queda en Git.

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Shell | React + Radix + Tailwind | Barra superior, desplegables, búsqueda global, hoja móvil, sidebar contraíble |
| Estado | `AppContext` (React) | Router por hash, preferencias, servidor/calidad/Premium, oportunidad pendiente |
| Vistas | Componentes `.jsx` por módulo | Configuración + resultados, pestañas horizontales |
| Lógica | Módulos ES puros en `src/services` | Catálogo, API, motor de cálculo, bonus, formato, storage |
| Build | Vite + `@vitejs/plugin-react` + `@tailwindcss/vite` | Dev server, bundle, Vitest |

La lógica de negocio **no se reescribió**: `catalog.js`, `api.js`, `engine.js`, `bonus.js`, `format.js` y `storage.js` son los mismos módulos sin DOM de la etapa anterior. Solo se reemplazó la capa de UI.

```text
index.html
  └─ src/main.jsx                 createRoot + AppProvider + hojas de estilo
       └─ src/App.jsx            ApplicationShell + Sidebar + módulo activo
            ├─ src/app/AppContext.jsx       estado compartido y navegación
            ├─ src/components/ui/*          primitivas shadcn (Radix)
            ├─ src/components/layout/*     barra superior, menús, hoja móvil, logo, datos de nav
            ├─ src/components/common/*     Tabs, Field, DataTable, ResultCard, ItemSelector
            ├─ src/components/charts/*     PriceBars / ProfitBars
            ├─ src/modules/*              CalculatorView, ScannerView, PricesView, registry
            ├─ src/settings/index.js       constantes
            └─ src/services/*              lógica pura (sin React)
```

Cada entrada de `registry.jsx` es un componente React `{ meta, render implícito }`. `App.jsx` usa `key={active + ':' + pending.seq}` para que al elegir un subménú (por ejemplo «Comparar ciudades») el módulo se remonte y lea las opciones pendientes (`tab`, `strategy`, `itemId`, `opportunity`).

## 2. El shell adaptado

Del bloque *ApplicationShell3* se conservaron, adaptados a nuestra app:

- **Barra superior sticky** de 56 px con logo, navegación por grupos, búsqueda y zona derecha.
- **`NavDropdown`**: un `DropdownMenu` de Radix por grupo (`Producción`, `Especialidades`, `Mercado`), con `children` que apuntan a pestañas o estrategias reales en vez de proyectos de ejemplo.
- **`MobileNav`**: un `Sheet` (Radix Dialog) con scroll, grupos, separador y grupo de soporte; se cierra al navegar.
- **`GlobalSearch`**: busca módulos e ítems del catálogo en un mismo campo; al elegir un ítem navega a Crafteo con `itemId` y lo preselecciona.
- **`cn()`** (`clsx` + `tailwind-merge`), `Button`, `Input`, `DropdownMenu*`, `Sheet*`, `ScrollArea`, `Separator`, iconos `lucide-react` y los tokens `@theme` de Tailwind 4 mapeados a nuestra paleta.

Lo que **no** se copió: `NavUser` (avatar, *Account*, *Log out*), el selector de `workspaces`, los datos de `person1`, el logo externo de shadcnblocks y las clases `dark:`. La app no tiene login ni backend, y la marca debe ser exactamente **Calculadora**, sin subtítulos. En su lugar, la zona derecha muestra servidor, calidad y Premium.

La **navegación lateral contraíble** se mantuvo: el botón de la cabecera alterna `.shell.collapsed`, guarda el estado y conserva los `title` de los ítems. Los grupos de la lateral ahora también son plegables.

## 3. Diseño visual

- Fondo `--bg: #f5f7fb`, superficies blancas, bordes suaves `#e0e6f0` y sombras mínimas.
- Azul `#1e5ed0` para acciones principales, navegación activa y gráficos; dorado `#d3a12c` para acentos, presets y campos manuales; verde `#16804b` para ganancias positivas.
- Pestañas horizontales con subrayado azul. En pantallas anchas, `.work-grid` divide la pantalla en configuración (≤385 px) y resultados; por debajo de 980 px se apila.
- Tres hojas: `index.css` (Tailwind 4 + tokens), `main.css` (tarjetas, tablas, resultados) y `shell.css` (barra superior, menús, búsqueda, hoja móvil). Sin fuentes externas.

## 4. Catálogo y precios

`tools/generate_catalog.py` descarga `items.json` y `formatted/items.json` de `ao-bin-dumps` y genera `data/catalog.js` como **módulo ES** (`export const CATALOG`). Contiene 8.302 recetas T2–T8 con encantamientos `.0`–`.4`, nombres ES/EN, `itemValue`, materiales (`ret:false`, `max`), diarios, `ccat`, `refine` y `upgrade`.

Como el archivo pesa ~5 MB y es ESM puro, `vite.config.js` incluye un pequeño middleware (`catalog-static`) que lo sirve **sin transformar en desarrollo**. Sin esto, Vite le inyecta un sourcemap inline que infla la respuesta a ~28 MB.

`src/services/api.js` consulta `/api/v2/stats/prices/{ids}.json?locations=…&qualities=…` en West, East o Europe. Agrupa IDs, cachea 60 s, respeta `RateLimit-Reset` en un `429` y traduce un `TypeError` de `fetch` a un mensaje de posible bloqueo CORS. Las vistas nunca recargan precios automáticamente.

| Modo | Campo AODP | Uso |
|---|---|---|
| Compra inmediata / orden de venta | `sell_price_min` | precio al que comprás o listás |
| Venta directa / orden de compra | `buy_price_max` | precio al que te compran |

Cada precio muestra su antigüedad (verde <2 h, dorado <4 h, rojo >4 h). Los valores escritos a mano se marcan en dorado y no se pisan al recargar, salvo «Sobrescribir precios manuales».

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

`src/modules/flipping/scanner.js` (JS puro) selecciona candidatos por tier/encantamiento/categoría/búsqueda, calcula los IDs necesarios, agrupa en lotes de ≤30 IDs respetando el límite de longitud de URL de AODP y evalúa todas las combinaciones de ciudades con el mismo `engine`. Cuatro estrategias:

- **Flip** — comprar barato, vender caro.
- **Royal → BM** — destino fijo Mercado Negro y venta directa.
- **Craft Trades** — `calculate()` con receta real, RRR de la ciudad y tasa de estación.
- **Refining Trades** — igual, sobre las recetas con `refine: true`.

Filtros: ganancia mínima, ROI mínimo, antigüedad máxima, orden, límite, rutas seguras, permiso de misma ciudad e inclusión del Mercado Negro. «Abrir en calculadora» pasa la fila por `AppContext` (`opportunity`) y precarga ítem, ciudades, modos, RRR, Focus, tasa de estación y precios.

## 7. Verificación

```bash
npm run check       # 40 archivos JS/JSX (esbuild + node --check)
npm test            # 13 pruebas Vitest + Testing Library + jsdom
npm run build       # bundle de producción
npm run dev         # servidor en 0.0.0.0:8000
```

Las pruebas cubren: marca exacta, barra superior y 10 módulos, colapso persistente, menús desplegables y submenús, hoja móvil, búsqueda global, autocompletado y chips `.0`–`.4`, receta y desglose, impuestos 4/8 %, RRR por ciudad y Focus, carga de precios, `429` y CORS, comparación de ciudades, las 4 estrategias del escáner, puente «Abrir en calculadora», matriz de precios por ciudad y calidad, y ausencia de errores de React al recorrer los 10 módulos. El `fetch` de AODP se simula en `tests/fixtures.js`.

## 8. Límites conocidos

- Sin backend no hay histórico, volumen, login, Market P2P, Builds ni escaneo de miles de ítems en milisegundos.
- CORS de AODP depende del navegador y del servidor; la app ofrece precios manuales y un campo de proxy opcional.
- Los precios son comunitarios: pueden faltar o estar desactualizados. Siempre hay que verificar en el juego.
