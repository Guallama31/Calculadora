# Implementación

> Documenta la arquitectura de **Calculadora**, las fórmulas y las decisiones de diseño.
> El análisis del repositorio de referencia está en [`analisis-albion-analytics.md`](analisis-albion-analytics.md); la revisión de Albion Market Hub, en [`analisis-albionmarkethub.md`](analisis-albionmarkethub.md).

## 1. Arquitectura

**HTML + CSS + módulos ES nativos, sin build, sin frameworks y sin dependencias en runtime.** Se mantiene lo que gustaba (es HTML) y se reemplazan el diseño original y la forma de funcionar por una app de navegación lateral con módulos, pestañas horizontales y distribución *configuración + resultados*.

```text
index.html
  └─ src/main.js                    shell, router por hash, estado compartido, preferencias
       ├─ src/components/layout/     Header, Sidebar, MainLayout
       ├─ src/components/common/     Tabs, Select, DataTable, ResultCard, ItemSelector
       ├─ src/components/charts/     PriceBars
       ├─ src/modules/               un directorio por módulo + registro en index.js
       ├─ src/settings/index.js      constantes: ciudades, impuestos, módulos, defaults
       └─ src/services/              lógica pura y acceso a datos
            ├─ catalog.js            índice y búsqueda sobre data/catalog.js
            ├─ api.js                cliente AODP, caché 60 s, errores 429/CORS
            ├─ engine.js             motor de crafteo y flipping (sin DOM)
            ├─ bonus.js              bonus por ciudad → RRR
            ├─ format.js             números, escape HTML, antigüedad
            └─ storage.js            preferencias en localStorage
```

Cada módulo expone `{ meta, render(ctx), mount(root, ctx) }`. `main.js` renderiza el shell, monta el módulo activo y le pasa un contexto con `shared` (servidor, calidad, Premium), `prefs`, `navigate`, `setPref`, `onSharedChange` y la oportunidad pendiente del escáner. El router usa `location.hash`, así que el botón «atrás» funciona.

**Reutilización:** `src/modules/crafting/CalculatorView.js` es una fábrica de vistas. Los módulos *Crafteo, Encantamiento, Refinamiento, Agricultura, Animales, Monturas, Alquimia* y *Cocina* usan exactamente el mismo motor y la misma UI, cambiando solo el filtro del catálogo y la etiqueta de alcance. *Flipping* y *Precios* tienen vistas propias.

## 2. Diseño visual

- Fondo `--bg: #f5f7fb`, superficies blancas, bordes suaves `#e0e6f0` y sombras mínimas.
- Azul `#1e5ed0` para acciones principales, navegación activa y gráficos; dorado `#d3a12c` para acentos, presets y campos manuales; verde `#16804b` para ganancias positivas.
- Sidebar de 238 px que se contrae a 72 px; el estado se guarda y los ítems conservan su `title` para seguir siendo identificables.
- Pestañas horizontales con subrayado azul. En pantallas anchas, `.work-grid` divide la pantalla en configuración (≤385 px) y resultados; por debajo de 980 px se apila.
- `src/styles/main.css` es la única hoja de estilos; no hay fuentes externas.

## 3. Catálogo y precios

`tools/generate_catalog.py` descarga `items.json` y `formatted/items.json` de `ao-bin-dumps` y genera `data/catalog.js` como **módulo ES** (`export const CATALOG`). Contiene 8.302 recetas T2–T8 con encantamientos `.0`–`.4`, nombres ES/EN, `itemValue`, materiales (incluyendo `ret:false` y `max` para no retornables), diarios, `ccat` (categoría de bonus), `refine` y `upgrade` (runas/almas/reliquias para encantar).

`src/services/api.js` consulta `/api/v2/stats/prices/{ids}.json?locations=…&qualities=…` en West, East o Europe. Agrupa IDs en una sola petición, cachea 60 s, respeta `RateLimit-Reset` en un `429` y traduce un `TypeError` de `fetch` a un mensaje de posible bloqueo CORS. Las vistas nunca recargan precios automáticamente.

| Modo | Campo AODP | Uso |
|---|---|---|
| Compra inmediata / orden de venta | `sell_price_min` | precio al que comprás o listás |
| Venta directa / orden de compra | `buy_price_max` | precio al que te compran |

Cada precio muestra su antigüedad (verde <2 h, dorado <4 h, rojo >4 h). Los valores escritos a mano se marcan en dorado y no se pisan al recargar, salvo «Sobrescribir precios manuales».

## 4. Motor de cálculo

`src/services/engine.js` es puro (sin DOM) y se puede probar con Node. Fórmulas, reimplementadas en JS a partir del análisis de `Triky313/AlbionOnline-StatisticsAnalysis`:

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
- `calculateFlip()` hace lo mismo para arbitraje puro (una unidad), incluyendo transporte.
- **RRR:** `bonusFor()` combina base de ciudad (0,18; refugio 0,15; isla 0), especialidad (+0,40 refinado, +0,15 categoría), Focus (+0,59) y bonus diario; `RRR = bonus / (1 + bonus)`. `bestCityFor()` elige la ciudad óptima para el modo *Automática*.

## 5. Escáner

`src/modules/flipping/scanner.js` selecciona candidatos por tier/encantamiento/categoría/búsqueda, calcula los IDs necesarios (ítem + materiales en Craft/Refining), agrupa en lotes de ≤30 IDs respetando el límite de longitud de URL de AODP y evalúa todas las combinaciones de ciudades con el mismo `engine`. Cuatro estrategias:

- **Flip** — comprar barato, vender caro; `engine.calculateFlip`.
- **Royal → BM** — destino fijo Mercado Negro y venta directa.
- **Craft Trades** — `engine.calculate` con receta real, RRR de la ciudad de crafteo y tasa de estación.
- **Refining Trades** — igual, sobre las recetas con `refine: true`.

Filtros: ganancia mínima, ROI mínimo, antigüedad máxima, orden por ganancia/ROI/margen/frescura, límite de filas, rutas seguras (5 ciudades reales), permiso de misma ciudad e inclusión del Mercado Negro. «Abrir en calculadora» pasa la fila por `ctx.opportunity` y precarga ítem, ciudades, modos, RRR, Focus, tasa de estación y precios.

## 6. Verificación

```bash
npm run check       # node --check sobre src/, tools/ y data/
npm run dev         # servidor en 0.0.0.0:8000
```

La suite de humo (jsdom, fuera del repo) cubre: marca exacta, 10 módulos, colapso persistente de la barra, autocompletado y chips `.0`–`.4`, receta y desglose, impuestos 4/8 % y tarifa de orden, RRR por ciudad y Focus, carga de precios con precios manuales respetados/sobrescritos, comparación de ciudades, render de los 8 módulos de producción, 4 estrategias del escáner, puente «Abrir en calculadora» y matriz de precios por ciudad y calidad.

## 7. Límites conocidos

- Sin backend no hay histórico, volumen, login, Market P2P, Builds ni escaneo de miles de ítems en milisegundos.
- CORS de AODP depende del navegador y del servidor; la app ofrece precios manuales y un campo de proxy opcional.
- Los precios son comunitarios: pueden faltar o estar desactualizados. Siempre hay que verificar en el juego.
