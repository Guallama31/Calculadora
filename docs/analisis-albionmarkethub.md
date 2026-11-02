# Revisión de Albion Market Hub y traslado a Calculadora

> Análisis de [albionmarkethub.com](https://albionmarkethub.com/) realizado el 2026-11-02, y de qué partes se implementaron en esta web.
> Complementa [`analisis-albion-analytics.md`](analisis-albion-analytics.md) y [`implementacion.md`](implementacion.md).

## 1. Qué es y cómo se organiza

Es una **app web con backend** (SPA + servidor, con login y planes FREE/PRO/MAX), orientada al servidor **Americas (West)**. Él mismo aclara en su página de [Transparencia](https://albionmarkethub.com/transparency) que **no genera datos**: organiza los precios del **Albion Online Data Project (AODP)** y que sus escáneres «cruzan miles de rutas de ítems entre 8 ciudades en milisegundos, aplicando fórmulas de impuestos en tiempo real». El plan PRO financia ese cómputo; el escáner gratuito tiene **1 búsqueda diaria** por límite de uso justo.

Secciones visibles en la cabecera: **Prices**, **Profit Planner**, **Market**, **Trades**, **Builds**.

### Prices (`/`)
Tabla de precios **multi-ciudad**: Caerleon, Thetford, Fort Sterling, Lymhurst, Bridgewatch, Martlock, Brecilien y **Black Market**. Fila por ítem con icono, tier, encantamiento, categoría, calidad, precio por ciudad, «Updated» (antigüedad relativa: *1 minute ago*, *about 2 hours ago*) y acciones *Copy link* / *Details*. Filtros: búsqueda, **Category**, **Tier** (T1–T8), **Enchantment** (.0–.4), **Quality** (Normal→Masterpiece), **City**.

### Profit Planner (`/profit-planner`)
Planificador de rentabilidad con niveles FREE / PRO / MAX, *Demo*, botón **SEARCH** y:
- **Category**, **Tier**, **Ench** (.0–.4), **Cities** (multiselección, «5 of 8»).
- **Return rate %**, **Premium**, **Station fee**.
- Indicador contextual por categoría: «POTIONS · RRR without Focus (%): 0%».
- Columnas de resultado: **Item**, **Real cost / unit**, **Net sale**, **Profit / unit**, **Return/cost**, **Return**.
- Estados «Ready to search» y «0 opportunities found».

### Trades (`/trades`) — el analizador de flipping
Filtros globales **Category / Tier / Enchantment / Quality**, contador «Community Profit», aviso de riesgo («Always verify prices in-game before purchasing…») y botón **FIND OPPORTUNITIES**. Pestañas:
- **FLIP** — arbitraje de ítems entre mercados.
- **BLACK TRADES** → **ROYAL → BM** — comprar en ciudades reales, vender al Mercado Negro.
- **CRAFT TRADES** — fabricar en un lugar y vender en otro.
- **REFINING TRADES** — refinar y vender el refinado.

### Market y Builds
*Market* es un mercado P2P de ofertas WTS/WTB con negociación por Discord (fuera del alcance de una calculadora). *Builds* es un armador de equipamiento.

## 2. Opciones que conviene replicar

| Opción observada | Presente en Calculadora |
|---|---|
| Servidor, ciudad(es), tier, encantamiento, calidad | ✅ Cabecera + filtros del escáner |
| 7 ciudades reales + Black Market | ✅ (y Brecilien/Caerleon marcables como «ruta de riesgo») |
| **Dónde craftear** | ✅ Ciudad de crafteo con bonus real por categoría, o «Automática» |
| Dónde comprar los materiales / el ítem | ✅ Ciudad fija o «Mejor precio» (busca cada material por separado) |
| Dónde vender | ✅ Multiselección de ciudades + Mercado Negro |
| Return rate | ✅ Automático (base 0,18 + 0,40 refinado / 0,15 crafteo + 0,59 Focus + bonus diario) o manual |
| Premium | ✅ 4 % / 8 %, con comparativa lado a lado |
| Station fee | ✅ Plata por 100 nutrición (`itemValue × 0,1125`) o importe fijo |
| Modos de precio (compra inmediata / orden, venta directa / orden) | ✅ |
| Flip, Royal → BM, Craft Trades, Refining Trades | ✅ 4 estrategias |
| Ganancia / unidad, coste real, venta neta, ROI, margen | ✅ |
| Antigüedad de los precios | ✅ Badges por minutos/horas + filtro «Edad máxima» |
| Filtros de resultados (ganancia mínima, ROI mínimo, orden, límite) | ✅ |
| Riesgo de transporte | ✅ Aviso + toggle «Incluir rutas de riesgo» |
| Abrir la oportunidad en la calculadora para afinarla | ✅ Botón por fila (precarga ítem, ciudades, RRR y precios) |

### Qué **no** se puede copiar tal cual en una web estática
- El **escaneo completo de miles de ítems en milisegundos**: requiere servidor, caché propia y/o el stream NATS de AODP. Calculadora es 100 % cliente, sin backend ni login, así que consulta la API pública directamente.
- **Límites de AODP**: 100 req/min y 300/5 min por IP, URL < 4096 caracteres, `429` con `RateLimit-*`. Por eso el escáner limita los ítems por búsqueda (por defecto 60), agrupa todos los IDs en pocas peticiones, usa caché de 60 s y **nunca refresca automáticamente**.
- **Market P2P, cuentas, Discord, alertas, historial de sesiones, Builds, planes PRO**: necesitan backend, base de datos e identidad; quedan fuera del alcance.
- Los datos de **confianza/volumen** (spreads de 7 días, «Community Profit») requieren histórico propio; Calculadora muestra la antigüedad del precio y deja el criterio al usuario.

## 3. Cómo se implementó

Se integró como el módulo **Flipping** de la navegación lateral, compartiendo servidor, calidad y Premium con el resto de la app.

```
src/modules/flipping/scanner.js   candidatos, descarga por lotes, evaluación y ranking
src/modules/flipping/index.js     4 estrategias en pestañas, filtros, resultados y puente
src/services/engine.js           calculate() y calculateFlip() con los mismos impuestos
src/services/bonus.js            bonus por ciudad (craftingmodifiers.json + world.json) → RRR
src/modules/crafting/            recibe la oportunidad por ctx.opportunity y la precarga
data/catalog.js                  + ccat, refine y upgrade (encantamiento)
```

**Mapeo ciudad → bonus** (de los dumps del juego):

| Ciudad | Bonus de refinado (+0,40) | Categorías de crafteo (+0,15) |
|---|---|---|
| Thetford | mineral (`ore`) | maza, naturestaff, firestaff, leather_armor, cloth_helmet |
| Lymhurst | fibra (`fiber`) | espada, arco, arcanestaff, leather_helmet/shoes |
| Bridgewatch | piedra (`rock`) | ballesta, daga, cursestaff, plate_armor, cloth_shoes |
| Martlock | piel (`hide`) | hacha, quarterstaff, froststaff, plate_shoes, offhand |
| Fort Sterling | madera (`wood`) | martillo, lanza, holystaff, plate_helmet, cloth_armor |
| Caerleon | — | gatherergear, tools, food, knuckles, shapeshifterstaff |
| Brecilien | — | cape, bag, potion |

`RRR = bonus / (1 + bonus)` con `bonus = base(0,18) + categoría + Focus(0,59) + bonus diario`. Da 15,25 % sin bonus, 24,81 % en ciudad de crafteo, 36,71 % refinando en la ciudad correcta, 43,50 % con Focus y 53,92 % con ciudad + Focus — los mismos valores que los presets de la calculadora.

**Estrategias**
- *Flip*: `Crafting.calculateFlip` — compra (`sell_price_min` o `buy_price_max`), venta (`buy_price_max` o `sell_price_min`), impuesto 4/8 %, tarifa de orden 2,5 % y tarifa de orden de compra opcional.
- *Royal → BM*: flip con destino fijo **Black Market** y venta directa (el BM solo publica órdenes de compra).
- *Craft Trades*: `Crafting.calculate` con la receta real del ítem, RRR derivado de la ciudad, tasa de estación e impuestos; materiales comprados en la ciudad elegida o en la más barata.
- *Refining Trades*: igual, sobre las 35 recetas de refinado, con «Automática» eligiendo la ciudad con bonus para cada recurso.

Cada fila ofrece **«Abrir en calculadora»**, que precarga ítem, ciudad de crafteo, ciudad de compra, ciudad de venta, modos, RRR, tarifa de estación y todos los precios ya descargados, para agregar diarios, transporte u overrides manuales sin volver a consultar la API.

## 4. Limitaciones honestas y siguientes pasos

1. El escaneo examina un **subconjunto acotado** de ítems (5–250, por defecto 60), no el catálogo completo de 8.302 recetas. Ampliarlo exigiría un backend con caché.
2. No hay **volumen/liquidez** ni histórico de 7 días: una oportunidad puede ser un precio viejo o una orden ya consumida. De ahí el aviso permanente y el filtro de antigüedad.
3. No se incluyen **diarios, coste de transporte ni riesgo de gank** en el escáner; se afinan en la calculadora.
4. El Mercado Negro solo compra equipo; los recursos devuelven precio 0 y se descartan automáticamente.
5. Posibles mejoras: histórico (`/stats/history/`), volumen estimado, guardado de planes y comparación de las 8 ciudades para un ítem. Las alertas en tiempo real sí requerirían backend.

## Fuentes

- [Albion Market Hub](https://albionmarkethub.com/), [Profit Planner](https://albionmarkethub.com/profit-planner), [Trades](https://albionmarkethub.com/trades), [Market](https://albionmarkethub.com/market), [Transparency & Fair Use](https://albionmarkethub.com/transparency).
- [AODP API](https://www.albion-online-data.com/api/) · [Wiki: Marketplace](https://wiki.albiononline.com/wiki/Marketplace) · [Wiki: Margin](https://wiki.albiononline.com/wiki/Margin).
- [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) (`craftingmodifiers.json`, `formatted/world.json`, `items.json`).
