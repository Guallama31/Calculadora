# Análisis de «Albion Analytics» (Statistics Analysis Tool)

> Informe técnico previo al rediseño. **Alcance de este paso: solo análisis.** No se modificaron `index.html`, `style.css` ni `script.js`. Es un documento histórico: la propuesta de archivos `js/*` de la sección 7 quedó superada por la arquitectura modular actual, descrita en [`implementacion.md`](implementacion.md).
> Fecha: 2026-11-02 · Repositorio analizado: [Triky313/AlbionOnline-StatisticsAnalysis](https://github.com/Triky313/AlbionOnline-StatisticsAnalysis) · Rama `main`, commit `8ad2067` (2026-10-25).

---

## 0. Resumen ejecutivo

| | |
|---|---|
| **Nombre real del proyecto** | *Albion Online – Statistics Analysis* (la app se llama *Statistics Analysis Tool*). No existe un repo llamado exactamente "Albion Analytics"; este es el que se suele nombrar así y el que tiene las tres funciones pedidas. |
| **Qué es** | Aplicación de escritorio **Windows** (WPF / .NET 10, C#), ~1.900 archivos en `src/`, 536 ★ / 153 forks, licencia **GPL-3.0**. |
| **HTML en el repo** | Solo la página estática de documentación (`docs/index.html`, GitHub Pages). **La aplicación no es HTML**: es XAML + C#. |
| **Tres módulos a reutilizar** | ① Calculadora de crafteo basada en recetas reales, ② precios desde la API del *Albion Online Data Project* (AODP, lo que llamamos "Albion Data Market"), ③ buscador de ítems sobre un catámetro local. |
| **Conclusión clave** | Lo portable a HTML son **las ideas, las fórmulas, el modelo de datos y los endpoints**. No se puede portar el código (C#/WPF) ni el *sniffer* de paquetes (Npcap), que es la fuente de precios "en vivo" del juego. En el navegador solo tendremos los precios comunitarios de AODP. |
| **Riesgo legal** | El repo es GPL-3.0 y este repo no declara licencia. Copiar código implicaría adoptar GPL-3.0. Recomendación: **reimplementar en JS desde cero**, con atribución. |

---

## 1. Arquitectura general del repositorio

Solución `src/StatisticsAnalysisTool.sln` con proyectos separados:

| Proyecto | Papel |
|---|---|
| `StatisticsAnalysisTool` | App WPF: UI (`.xaml`), ViewModels, lógica de negocio. Aquí viven los 3 módulos. |
| `StatisticAnalysisTool.Extractor` | Extrae los archivos de datos del cliente del juego instalado (`items.json`, `indexedItems.json`, `localization.xml`, `craftingmodifiers.json`, `world.json`). |
| `StatisticsAnalysisTool.Network`, `.PhotonPackageParser`, `.Protocol18` | Captura de paquetes (Npcap / socket), eventos del juego, DPS meter, loot, etc. |
| `.Abstractions`, `.Diagnostics`, `.UnitTests` | Soporte y tests (NUnit + FluentAssertions). |

Capas que nos interesan:

```
GameFileData/  → catálogo de ítems + recetas + bonus de crafteo (datos del juego)
Common/        → ApiController (precios AODP) + ItemController (índice/búsqueda)
Crafting/      → CraftingRecipeResolver + CraftingCalculator + CraftingBindings (UI/estado)
ViewModels/    → MainWindowViewModel (filtro del buscador de ítems)
```

Flujo de datos: **datos locales del juego → catálogo en memoria → búsqueda/receta → precios AODP por HTTP → calculadora → resultados**.

---

## 2. Módulo ① — Calculadora de crafteo

### 2.1 De dónde salen las recetas

* `ItemController.LoadIndexedItemsDataAsync()` / `LoadMainItemDataAsync()` (`Common/ItemController.cs:352`, `:359`) cargan `indexedItems.json` (índice → `UniqueName` + nombres localizados) y `items.json` (información completa).
* `SetFullItemInfoToItems()` (`:466`) cruza ambos por `UniqueName` y construye un diccionario O(1) (`RebuildItemLookup`, `:954`) con 16 tipos de ítem (`Weapon`, `EquipmentItem`, `ConsumableItem`, `Mount`, `SimpleItem`, `JournalItem`, …).
* `CraftingRecipeResolver.GetCraftingRequirements()` (`Crafting/CraftingRecipeResolver.cs:93`) lee `CraftingRequirements` del ítem; si el ítem está encantado, usa la receta del nivel de encantamiento correspondiente.
* `GetResources()` (`:31`) agrupa los `CraftResource` por `(UniqueName, EnchantmentLevel)`, suma `Count`, y resuelve variantes encantadas con los sufijos del juego: `ID@n` para equipo y `ID_LEVELn@n` para materiales (`GetSuitableResourceItem`, `:195`).
* `IsCraftable()` (`:16`) = la receta tiene al menos un `CraftResource`. `GetAmountCrafted()` (`:22`) lee `AmountCrafted` (ítems por *run*; por defecto 1).
* `GetReturnPolicy()` (`:152`) decide si un material devuelve recursos: si la receta **no** trae `MaxReturnAmount` ⇒ devuelve sin límite; si todos son 0 ⇒ **no devuelve** (artefactos); si trae límites positivos ⇒ suma el tope por *run*. Hay tests en `UnitTests/Crafting/CraftingRecipeResolverTests.cs`.
* `GetResourceKind()` clasifica `Artefact`, `Favor`, `Alchemy`, `AvalonianEnergy`, `TomeOfInsight`, `Essence`, `Standard`: útil para mostrar advertencias (p. ej. los artefactos no se recuperan).

### 2.2 Entradas de la calculadora (`CraftingCalculationInput.cs`)

`ItemUniqueName`, `CraftingRuns`, `AmountCrafted`, `ReturnRatePercent`, `UsesFocus`, `OutputUnitPrice`, `StationFee`, `NutritionConsumedPerRun`, `SalesTaxPercent`, `SetupFeePercent` (default **2,5 %**), `OtherCosts`, `OutputUnitWeight`, `Resources[]`, `Journal`.

Valores por defecto de la UI (`CraftingBindings.cs:68-69`): **impuesto de venta 4 %** (premium) y **tarifa de orden 2,5 %**. La tasa de estación es un importe **por cada 100 de nutrición**, no un % sobre la venta.

* `CraftingStationFeeService.cs:8`: `nutrición por run = itemValue × 0,1125` (el *item value* sale de `items.json`).
* `CraftingLocationData.cs:86`: el RRR no se teclea a ciegas, se deriva del **bonus de producción**:
  `RRR = bonus / (1 + bonus) × 100`. El bonus = bonus de ciudad/zona (`craftingmodifiers.json`) + bonus diario (0 / 10 / 20 %) + bonus de hideout + **59 % si se usa Focus** (`:17`, `:97`).

### 2.3 Fórmulas exactas (`Crafting/CraftingCalculator.cs:8`)

```text
runs            = max(0, CraftingRuns)
amount          = max(1, AmountCrafted)
outputQty       = runs × amount
rrr             = clamp(ReturnRatePercent, 0, 100) / 100

Por cada material:
  grossQty      = QuantityPerRun × runs
  expectedBack  = IsReturnable ? min(grossQty × rrr, MaxReturnPerRun × runs) : 0
  netQty        = max(0, grossQty − expectedBack)
  grossCost     = grossQty × UnitPrice
  netCost       = netQty   × UnitPrice

stationFee      = feePor100Nutrición × nutriciónPorRun × runs / 100
grossMaterials  = Σ grossCost
netMaterials    = Σ netCost
nonReturnable   = Σ netCost de materiales no retornables
revenueGross    = outputQty × OutputUnitPrice
salesTax        = revenueGross × SalesTax% / 100
setupFee        = revenueGross × SetupFee% / 100
revenueNet      = revenueGross − salesTax − setupFee
journals        = ver §2.4
totalCosts      = netMaterials + stationFee + journalCosts + otherCosts
profit          = revenueNet + journalRevenue − totalCosts
ROI%            = profit / totalCosts × 100
breakEven       = (totalCosts − journalRevenue) / outputQty / (1 − (tax%+setup%)/100)
profitPerItem   = profit / outputQty
```

También calcula pesos antes/después del crafteo (para transporte). Todo se redondea: plata a 2 decimales, cantidades a 4, porcentajes a 2 (`AwayFromZero`).

**Recálculo reactivo:** `CraftingBindings.Recalculate()` (`:1307`) se dispara al cambiar cualquier precio, cantidad, RRR, impuesto, etc. (`CraftingResourceEntry.UnitPrice` invoca `ValuesChanged`). No hay botón "Calcular": el resultado se actualiza solo.

### 2.4 Diarios de crafteo (journals)

`CraftingCalculator.cs:115` + `CraftingJournalService.cs`:

* Fama por *run* = nº de materiales (excluyendo artefactos/favor/alchemy) × factor según tier y nivel de encantamiento (tabla `GetTotalBaseFame`: T4.0 = 22,5 por material … T8.4 = 22.320).
* `journals vacíos = ceil(famaTotal / famaMáximaPorDiario)`, `diarios llenos = floor(...)`, más % del diario parcial.
* Coste = diarios vacíos × precio; ingreso = diarios llenos × precio. Ambos precios se pueden cargar del mercado o teclear.
* El tipo de diario (`MAGE`, `HUNTER`, `WARRIOR`, `TOOLMAKER`) se deduce del `craftingCategory` / `UniqueName` del ítem.

### 2.5 Salidas que muestra la UI (`CraftingCalculationResult.cs`, `CraftingControl.xaml:754+`)

Cantidad producida, coste total, venta neta, **ganancia**, ganancia por ítem, ROI %, **precio de equilibrio**, materiales brutos / netos / no retornables, tasa de estación, otros costes, coste e ingreso de diarios, y una tabla por material con: cantidad por run, bruta, devolución esperada, neta, precio unitario editable, coste bruto, coste neto, tipo de recurso y peso.

Además: planes guardados en JSON local (`SavedCraftingController.cs`), notas, y pestañas extra (Black Market / Loss Explorer) que consumen otras APIs.

### 2.6 Diferencias con nuestra web actual

| Aspecto | `Calculadora` hoy (`script.js`) | Statistics Analysis Tool |
|---|---|---|
| Datos | Ninguno: el usuario teclea un "coste total de materiales" | Receta real por ítem, material por material, con cantidades del juego |
| Identidad del ítem | No existe | `UniqueName` (`T4_BAG`, `T5_2H_BOW@1`, …), tier, encantamiento, categoría |
| Precios | Manuales | Automáticos desde AODP + override manual por material |
| Devolución (RRR) | `coste × %` aplicado al total | Por material, con `IsReturnable` y tope `MaxReturnAmount` × runs |
| Tasa de estación | `% sobre el precio de venta` (incorrecto) | `fee/100 nutrición × itemValue × 0,1125 × runs` |
| Impuestos | Un solo % sobre la venta | Impuesto de venta (4 %) + tarifa de orden (2,5 %) separados |
| Focus | `puntos × valor en plata` | +59 % de bonus de producción ⇒ cambia el RRR |
| Cantidades | 1 objeto implícito | `runs × AmountCrafted`, diarios, pesos, break-even |
| Diarios / journals | No existen | Coste, ingreso y fama por run |
| Ciudad / servidor / calidad | No existen | Seleccionables; precios por ciudad y calidad 1-5 |
| Otras calculadoras | Refinado, Recursos, Flip, Fama (5 formularios independientes) | Un único flujo de crafteo (el refinado es simplemente otra receta) |

> El diseño actual (5 paneles apilados, tema medieval, números inventados por defecto) y su lógica (fórmulas genéricas sin datos del juego) son justamente lo que el usuario quiere reemplazar.

---

## 3. Módulo ② — Obtención de precios ("Albion Data Market")

### 3.1 Aclaración de nombre

El repo **no** usa un servicio llamado "Albion Data Market". Usa la **API pública v2 del Albion Online Data Project (AODP)**: [https://www.albion-online-data.com/api/](https://www.albion-online-data.com/api/) — datos subidos por la comunidad mediante el *Albion Data Client*. Los hosts por servidor están en `Common/UserSettings/SettingsObject.cs:30-32`:

| Servidor | Base URL | Uso sugerido |
|---|---|---|
| Américas (West) | `https://west.albion-online-data.com/api/v2/` | **Por defecto para AR / Mendoza** |
| Asia (East) | `https://east.albion-online-data.com/api/v2/` | |
| Europa | `https://europe.albion-online-data.com/api/v2/` | |

`ApiController.GetAoDataProjectServerBaseUrlByCurrentServer()` (`:639`) elige el host según el servidor detectado/configurado.

### 3.2 Endpoints usados (`Common/ApiController.cs`)

| Método | Endpoint | Uso |
|---|---|---|
| `GetCityItemPricesFromJsonAsync` (`:31`, `:41`) | `stats/prices/{ids}?locations=...&qualities=...` | Precios actuales (hasta 5 calidades: `1,2,3,4,5`) |
| `GetHistoryItemPricesFromJsonAsync` (`:91`) | `stats/history/{id}?locations=...&date=...&qualities=...&time-scale=24` | Historial / gráficos |
| `GetGoldPricesFromJsonAsync` (`:372`) | `stats/gold?count=N` | Precio del oro |
| (`Albion-Api-Doku…txt`) | `gameinfo.albiononline.com/api/gameinfo/...` | Jugadores, gremios, kills; **no** se usa para buscar ítems |
| Iconos | `render.albiononline.com/v1/item/{UniqueName}.png?quality=N` | Imágenes de ítems |

`Locations.GetAllMarketLocations()` (`Common/Locations.cs:100`) pide 14 ubicaciones: Lymhurst, Martlock, FortSterling, Thetford, Bridgewatch, Caerleon, BlackMarket, Brecilien, los 5 cruces y SmugglersNetwork. Luego `MergeMarketAndPortalLocations()` / `MergeCityAndPortalCity()` unifican mercado y portal de cada ciudad.

**Formato de respuesta verificado en vivo (2026-11-02):**

```json
[
  {"item_id":"T4_BAG","city":"Martlock","quality":1,
   "sell_price_min":4194,"sell_price_min_date":"2026-11-02T04:40:00",
   "sell_price_max":5000,"sell_price_max_date":"2026-11-02T04:40:00",
   "buy_price_min":2044,"buy_price_min_date":"2026-11-01T16:20:00",
   "buy_price_max":2056,"buy_price_max_date":"2026-11-01T16:20:00"}
]
```

Modelo: `Models/MarketResponse.cs` (`item_id`, `city`, `quality`, `sell_price_min/max` + fechas, `buy_price_min/max` + fechas), `MarketHistoriesResponse.cs` para historial. Se admiten **varios IDs separados por coma en una sola llamada** (`T4_BAG,T4_PLANKS`), ideal para pedir de una vez el producto + todos sus materiales.

### 3.3 Reglas de selección de precio (lo más reutilizable)

* `CraftingBindings.LoadPricesAsync()` (`:1790`) es **explícito**: solo se dispara al pulsar el botón *Prices*. La app nunca consulta la API en segundo plano.
* `LoadPriceAsync()` (`:1830`): para la ciudad elegida, toma la fila **más reciente** por fecha y usa `sell_price_min` (compra inmediata de materiales y precio de venta del producto) o `buy_price_max` si el destino es el **Mercado Negro**.
* `GetSellPriceOptionValue()` (`:1539`): por ciudad, descarta `sell_price_min <= 0`, ordena por precio ascendente y fecha descendente; en Black Market usa la mejor `buy_price_max`.
* `ApplyPriceRankIndicators()` (`:1489`): ordena las ciudades (más barato para comprar / más caro para vender, con desempate por fecha) y marca las 3 mejores con `<<<`, `<<`, `<`.
* **Antigüedad del dato**: `ExtensionMethod.GetValueTimeStatus()` (`:410`) clasifica en `Normal` (<2 h), `ToOldFirst` (>2 h), `ToOldSecond` (>4 h), `ToOldThird` (>8 h), `NoValue`. Cada opción de precio muestra su fecha/estado.
* **Concurrencia**: contador `_priceOptionRequestVersion` (`:718`, `:1474`) descarta respuestas de una petición anterior si el usuario cambió de ítem mientras cargaba.
* **Errores**: HTTP 429 → `TooManyRequestsException`; timeouts de 30 s (precios) / 300 s (historial); `HttpClient` con TLS1.2/1.3 y descompresión GZip/Deflate/Brotli; en fallo devuelve lista vacía y la calculadora sigue funcionando con precios manuales.
* **Siempre hay override manual**: cada precio es un campo editable; si la API no tiene dato, el usuario lo teclea y el cálculo no se rompe.

### 3.4 Restricciones reales de la API (documentación oficial)

Según [API docs (West)](https://west.albion-online-data.com/api-docs):

* **100 peticiones/minuto y 300/5 min por IP**; sin cabecera `Accept-Encoding` de compresión, **1 petición cada 5 min** (los navegadores ya envían gzip/br automáticamente).
* `429` con cabeceras `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; reintentar antes de tiempo ⇒ baneo temporal de 5 min.
* Agrupar muchos ítems/ciudades en **una** petición, manteniendo la URL por debajo de **4096 caracteres**.
* Parámetros: `locations` (nombres o IDs; `Fort Sterling` / `FortSterling` / `Fort%20Sterling`), `qualities` (1-5).
* Los datos son **comunitarios**: pueden faltar, ser 0 o estar desactualizados. No son el libro de órdenes en tiempo real.

### 3.5 Lo que **no** se puede llevar a HTML

| Función del repo | Por qué no |
|---|---|
| *Sniffer* Npcap / socket de paquetes del cliente | Requiere permisos de administrador, Windows y acceso a la red local; un navegador no puede hacerlo. Es la fuente de precios "al abrir el mercado en el juego". |
| *Estimated Market Value* (EMV) leído del cliente | Igual: sale de los paquetes del juego. |
| Extracción de `items.json` del cliente instalado | En HTML hay que usar un catámetro empaquetado o los dumps públicos `ao-data/ao-bin-dumps`. |
| CORS | No pude verificar las cabeceras `Access-Control-Allow-Origin` desde este sandbox (salida de red restringida); hay reportes de proyectos que necesitan proxy. **Hay que probar un `fetch()` real desde el navegador** y prever un proxy ligero / dev-server proxy como plan B. |

---

## 4. Módulo ③ — Búsqueda de ítems

### 4.1 Origen de datos

* El repo extrae del cliente del juego (`GameFileData/GameData.cs`, `StatisticAnalysisTool.Extractor`): `indexedItems.json`, `items.json`, `localization.xml` (nombres traducidos, incluido español), `craftingmodifiers.json`, `world.json`. Como referencia pública, la propia UI enlaza los dumps `formatted/items.json` e `items.json` de `raw.githubusercontent.com` (`MainWindowViewModel.cs:1827-1828`): [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) ([items.json](https://github.com/ao-data/ao-bin-dumps/blob/master/formatted/items.json), `items.txt`, `world.json`). Para una web estática, estos dumps son la fuente natural del catámetro.
* `ItemController` mantiene `ObservableCollection<Item> Items` + diccionarios por índice, `UniqueName` y nombre "limpio" (`GetCleanUniqueName`, `:43`) para búsquedas O(1), y enriquece cada ítem con `FullItemInformation` (categorías `ShopCategory` / `ShopSubCategory1-3`, tier, nivel de encantamiento, valor, peso, recetas).
* Iconos: `render.albiononline.com/v1/item/{UniqueName}.png` (+ `?quality=`), con caché local de imágenes.

### 4.2 Dos buscadores

**A) Pestaña "Item Search" (`UserControls/ItemSearchControl.xaml` + `MainWindowViewModel.ItemsViewFilter():562`)**
Panel izquierdo con cuadro de texto + filtros (categoría, 3 subcategorías, tier, nivel/encantamiento, solo favoritos, solo ítems con alerta) y lista virtualizada; panel derecho con el detalle del ítem: icono, propiedades, **precios por ciudad y calidad**, historial y costes de crafteo. Filtro = `Contains` insensible a mayúsculas sobre `LocalizedNameAndEnglish` + AND de todos los filtros. Contador `mostrados/total`.

**B) Autocompletado dentro de Crafteo (`CraftingBindings.cs:951`, `:1064`, `:1086`)**
* `CraftableItems` = solo ítems con receta (`_recipeResolver.IsCraftable`), ordenados por nombre localizado (`:77-83`).
* Al escribir: `ItemMatchesSearchText` = `Contains` sobre nombre localizado + inglés; `ItemMatchesFilter` aplica categoría/subcategorías/tier/nivel.
* Muestra como máximo **50 sugerencias** en un popup con nombre + icono.
* Al elegir un ítem (`ApplySelectedItem`, `:1097`): se cargan `AmountCrafted`, las ubicaciones de crafteo con su bonus, la lista de materiales, el diario correspondiente, y se recalcula. Equivale a "buscar ítem ⇒ la receta se arma sola".

> Insight de diseño: **la búsqueda no es un fin en sí misma, es la puerta de entrada a la calculadora** (y a la ficha de precios). No hay un endpoint de búsqueda de ítems: todo se filtra en memoria sobre el catámetro local.

---

## 5. Cómo usaríamos esto en nuestra web HTML (propuesta, sin implementar aún)

### 5.1 Cambio de paradigma

De **5 formularios con números manuales** a **un flujo guiado por ítem**:

```
[Servidor / Ciudad / Calidad]  ← configuración global
        ↓
Buscar ítem (autocompletado) → elegir → se arma la receta automáticamente
        ↓
"Cargar precios" (1 sola petición con producto + materiales) → tabla editable
   con precio, ciudad y antigüedad (≤2h / >2h / >4h / >8h / sin dato)
        ↓
Parámetros: runs, RRR (derivado de ciudad/bonus/focus), tasa de estación,
            impuesto 4 %, tarifa de orden 2,5 %, otros costes, diarios (opcional)
        ↓
Resultados en vivo: desglose por material, costes, venta neta, ganancia,
            ROI, precio de equilibrio, lista de compras
```

Esto resuelve a la vez "no me gusta el diseño" (nada de paneles medievales apilados: una sola vista tipo herramienta con buscador, tabla de materiales y panel de resultados) y "no me gusta cómo funciona" (datos reales en vez de números inventados, recálculo automático, sin botón *Calcular*).

### 5.2 Módulos JS propuestos (HTML + CSS + JS puro, sin build)

| Archivo | Responsabilidad (portada desde…) |
|---|---|
| `data/catalog.json` | Catámetro reducido: `UniqueName`, nombre ES/EN, tier, encantamiento, categoría, icono, `itemValue`, peso + receta (`craftResource[]`, `amountCrafted`, `maxReturnAmount`). Generado desde `ao-bin-dumps/formatted/items.json`, recortado a ítems crafteables + columnas necesarias para no arrastrar decenas de MB. |
| `js/search.js` | Índice en memoria, normalización (sin acentos, minúsculas), `Contains` sobre nombre ES/EN/ID, filtros tier/encantamiento/categoría, límite de 50 sugerencias (de `ItemController` + `CraftingBindings`). |
| `js/prices.js` | Cliente AODP: host por servidor (West por defecto), batch de IDs, `locations`/`qualities`, caché en `localStorage` con timestamp, badges de antigüedad, control de 429 + `RateLimit-Reset`, versión de petición anti race-condition, override manual, y fallback a proxy si CORS falla. |
| `js/crafting.js` | `resolveRecipe()` + `calculate()` con las fórmulas de §2.3 (RRR por material, nutrición 0,1125, impuestos separados, diarios, break-even). Recálculo reactivo. |
| `js/app.js` | Estado global (servidor, ciudad, calidad, ítem seleccionado) y pegado de los 3 módulos. |

### 5.3 Decisiones a tomar antes de codificar

1. **Licencia**: reimplementar en JS (recomendado) y añadir atribución; o adoptar GPL-3.0 si se porta código. Además, respetar los términos de uso de datos/imágenes de Sandbox Interactive (iconos del Render Service) y de AODP.
2. **Catámetro**: ¿empaquetar un JSON propio reducido (funciona offline, fácil de versionar) o descargar `ao-bin-dumps` en tiempo de build? Recomiendo JSON propio + script de generación; el buscador de AODP también publica [IDs de ítems](https://www.albion-online-data.com/items) con nombres en varios idiomas.
3. **Alcance funcional**: ¿incluimos encantamientos `.1-.4`, diarios, bonus diario/hideout, Mercado Negro, comparación entre ciudades e historial, o arrancamos con un MVP (ítem → receta → precios → ganancia)?
4. **Servidor por defecto**: Américas (`west`) por la ubicación del usuario, con selector visible Europa/Asia.
5. **CORS**: validar con un `fetch()` real; si bloquea, decidir entre proxy propio (añade backend, rompe "solo HTML") o un proxy público/Cloudflare Worker.
6. **Conservar o no** las calculadoras de Refinado / Flip / Fama: en el modelo del repo, el refinado es solo otra receta; Flip y Fama no existen allí.

---

## 6. Riesgos y limitaciones

* **Datos de mercado incompletos**: precios 0, ausentes o con horas de antigüedad; el repo lo mitiga con badges y edición manual → debemos copiar ese comportamiento, no tratar 0 como "gratis".
* **Rate limits** agresivos (100/min, 300/5 min) ⇒ una petición por lote, caché y botón explícito, nunca auto-refresh descontrolado.
* **Catámetro pesado**: `items.json` completo es enorme; hay que derivar un subconjunto.
* **Nombres en español**: salen de la localización del cliente / dumps; conviene un fallback al nombre inglés y al `UniqueName` para que la búsqueda funcione siempre.
* **Windows/.NET/WPF/XAML**: nada de eso es reusable en HTML; solo el modelo y las fórmulas.
* **Sin sniffer**: en el navegador no veremos precios "en vivo" del juego, solo los de la comunidad AODP.
* **Licencia GPL-3.0** del repo de origen (ver §5.3.1).

---

## 7. Fuentes

* Código: [Triky313/AlbionOnline-StatisticsAnalysis](https://github.com/Triky313/AlbionOnline-StatisticsAnalysis) (commit `8ad2067`), rutas citadas arriba.
* [The Albion Online Data Project – API](https://www.albion-online-data.com/api/) y [API docs (Americas/West)](https://west.albion-online-data.com/api-docs).
* [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) (`items.json`, `world.json`, `craftingmodifiers`).
* [Albion Render Service](https://render.albiononline.com/v1/item/T4_BAG.png) (iconos).
* Verificación en vivo de `stats/prices` realizada el 2026-11-02 (`T4_BAG`, `T4_PLANKS`, ciudades Martlock/Lymhurst/Thetford, calidad 1, host West).
* Repo local de este proyecto: `index.html`, `style.css`, `script.js`, `README.md` (estado actual sin cambios).
