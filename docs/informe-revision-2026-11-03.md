# Informe de revisión — Calculadora

**Fecha:** 3 de noviembre de 2026
**Rama revisada:** `arena/0b15c234-calculadora` (idéntica a `main` en `d063104`)
**Alcance:** estado del repositorio, análisis del último commit, verificación ejecutable (tests, sintaxis, build, servidor de desarrollo) y revisión de código de los servicios y vistas principales.

> **Actualización del mismo día:** las correcciones del §7 ya están aplicadas. Ver el detalle en
> [§9 · Correcciones aplicadas](#9-correcciones-aplicadas) y el estado nuevo de cada verificación.

---

## 1. Resumen ejecutivo

| Área | Estado |
|---|---|
| Repositorio / Git | ✅ Sano. Árbol limpio, sin conflictos, sin ramas divergentes. |
| Pruebas (`npm test`) | ✅ 78/78 en 7 archivos (~28 s). |
| Sintaxis (`npm run check`) | ✅ 51/51 archivos. |
| Build de producción | ✅ 1.672 módulos, 7,6 s. |
| Servidor de desarrollo / preview | ✅ Responde en `0.0.0.0:8000`, acepta el host del preview. |
| Calidad de código | 🟡 Sin linter/formatter, 9 imports sin usar, sin CI. |
| Corrección funcional | 🔴 **1 bug real de cálculo** (Monturas) + inconsistencias de documentación. |
| Seguridad del preview | 🟡 El dev server puede servir archivos fuera del proyecto. |
| Rendimiento | 🟡 Bundle único de 5,27 MB (436 KB gzip), sin *code splitting*. |

**Conclusión:** el proyecto está en buen estado y la última entrega es amplia y coherente, pero **no está "listo para confiar"** todavía: hay un error de cálculo en la pestaña *Crianza* que invierte los precios de compra/venta, la documentación quedó desfasada respecto a los archivos eliminados en el último commit, y el catálogo de 5,24 MB se sirve en un único bundle.

---

## 2. Estado del repositorio

* Rama actual: `arena/0b15c234-calculadora` → apunta al mismo commit que `main` (`d063104`), 0 commits de diferencia en ambos sentidos.
* `git status`: árbol limpio, sin archivos sin seguimiento (`.gitignore` cubre `node_modules/`, `dist/`, `.vite/`, `*.log`).
* Historial: 7 commits, dos PR mergeados (#1, #2) y el último commit (`d063104`) **aplicado directamente sobre `main`, sin PR**.
* Sin marcadores de conflicto (`<<<<<<<`, `=======`, `>>>>>>>`) en todo el árbol.
* Sin `stash`, sin ramas huérfanas, sin submódulos.
* No hay `.github/` (sin CI), ni `LICENSE`, ni `engines` en `package.json`.

### Historia

```
d063104 2026-11-03  Actualización de calculadora. Caché integrado.   (directo a main)
7f22ef6 2026-11-02  Merge PR #2 (ApplicationShell3 + React/Vite/Tailwind)
77a314c 2026-11-02  Adapta ApplicationShell3 …
4aba840 2026-11-02  Rediseña la app como Calculadora …
94e2027 2026-11-02  Merge PR #1
34e17c7 2026-11-02  Agrega web de calculadoras …
09cf287 2026-11-02  Initial commit
```

---

## 3. Análisis del último commit (`d063104`)

**Magnitud:** 44 archivos, **+4.432 / −2.068** líneas. Es, de lejos, el cambio más grande del repo.

**Qué incorpora**

| Bloque | Detalle |
|---|---|
| Caché de precios | `src/services/price-cache.js` (nuevo, IndexedDB, retención 90 días) + fallback y avisos en `api.js`. |
| Monturas | `BreedingView.jsx` (315 líneas), `mount-breeding.js`, datos `MOUNT_BREEDING` / `MOUNT_FOODS` en el catálogo. |
| Transmutación | `TransmutationView.jsx`, `transmutation.js`, tablas de tarifas T4–T8. |
| Taxonomía | `item-taxonomy.js` (208 líneas) + `tests/item-taxonomy.test.jsx` (23 casos). |
| Escáner | +152 líneas en `scanner.js` (nueva estrategia *Mejora*, cobertura, lotes, dedupe). |
| Vista principal | `CalculatorView.jsx` +552/−128, `PricesView.jsx` +97. |
| Pruebas | 6 archivos nuevos de test, `app.test.jsx` +490. |
| Documentación | `docs/cobertura-precios-propuesta.md` (254 líneas nuevas) y actualizaciones. |
| Dependencias | `package-lock.json` −1.470/+479 (limpieza y actualización de Radix/Tailwind). |

**Archivos eliminados:** `src/components/layout/NavDropdown.jsx` y `src/components/layout/Sidebar.jsx`. No quedan importaciones rotas, pero **sí quedaron referencias en la documentación** (ver §5.4).

**Lockfile:** pasa a `lockfileVersion 3` con 300 paquetes resueltos. `npm ci` instala 205 paquetes en 5 s y reporta **0 vulnerabilidades**.

⚠️ El commit se aplicó directamente sobre `main` sin PR, siendo el más grande y arriesgado del proyecto. Recomendado: exigir PR + CI verde para cambios de este tamaño.

---

## 4. Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm ci` | 205 paquetes, 0 vulnerabilidades |
| `npm run check` | `51/51 archivos con sintaxis correcta` |
| `npm test` | `7 archivos / 78 tests passed` (~28 s) |
| `npm run build` | `1672 modules transformed` · JS 5.269,78 kB (gzip 436,56 kB) · CSS 33,75 kB (gzip 7,48 kB) |
| `npm run dev` | Vite listo en 212 ms, escucha en `0.0.0.0:8000`, `Host` de preview aceptado (HTTP 200) |
| Catálogo servido | `/data/catalog.js` → 200, 5.495.147 bytes, `text/javascript` |

---

## 5. Hallazgos

### 5.1 🔴 P1 — Los precios de venta de *Monturas → Crianza* están invertidos

**Archivo:** `src/modules/mounts/BreedingView.jsx:12-13`

```js
const buyPriceMode  = mode => mode === 'instant' ? 'sell' : 'buy';
const sellPriceMode = mode => mode === 'instant' ? 'sell' : 'buy';   // ← debería ser 'buy' : 'sell'
```

En todo el resto de la app la convención es la correcta y consistente:

* `CalculatorView.jsx:345` (y 350/401/458/561) → `cfg.sellMode === 'instant' ? 'buy' : 'sell'`
* `scanner.js:217` → `citySellMode === 'instant' ? 'buy' : 'sell'` (idéntico).

`BreedingView` usa `sellPriceMode(...)` para **tres** precios de venta (potro criado, cría y montura ensillada), así que:

* con **orden de venta** (por defecto) muestra el precio de **compra** (`buy_price_max`, más bajo) → subestima ingresos;
* con **venta directa** muestra el precio de **venta** (`sell_price_min`, más alto) → sobreestima ingresos.

**Evidencia medida** (fixtures de test: `sell_price_min = P`, `buy_price_max = 0,86·P`):

```
sellMode = order    → precio mostrado 1626   (esperado 1891, sell_price_min)
sellMode = instant  → precio mostrado 1891   (esperado 1626, buy_price_max)
```

La ganancia, el ROI y la ganancia por día de *Crianza* quedan mal en ambos modos. **Ningún test lo detecta** porque `tests/mounts.test.jsx` solo verifica que el campo no esté vacío, nunca qué cotización se elige.

**Corrección sugerida:** una línea (`'buy' : 'sell'`) + test que compare el valor mostrado con la cotización esperada en ambos modos.

---

### 5.2 🟠 P2 — Las peticiones a AODP no tienen timeout ni cancelación

**Archivo:** `src/services/api.js:77-132`

* `fetch(...)` sin `signal` ni `AbortSignal.timeout()`: si AODP no responde, la petición queda pendiente indefinidamente, `inFlight` retiene la entrada y la UI permanece en «Consultando precios…» con `busy = true` para siempre.
* No hay cancelación al desmontar ni al cambiar de ítem/módulo: los componentes siguen esperando y actualizan estado tras el desmontaje (silencioso en React 18, pero desperdicia cuota de API).
* El escáner no tiene botón «Cancelar»; `busyRef` evita doble ejecución, pero no permite abortar un escaneo de 250 ítems × 8 ciudades.
* No se respeta `Retry-After`; solo se informa el 429 (`friendlyError`). Con lotes de 30 IDs y `delay(120)` el riesgo de 429 es real en escaneos grandes.

**Sugerencia:** `signal: AbortSignal.timeout(15_000)` en `fetchPrices`, propagar un `AbortController` por vista (cleanup en `useEffect`), y reintento con *backoff* ante 429.

### 5.3 🟠 P2 — El servidor de desarrollo expone archivos fuera del proyecto

**Archivo:** `vite.config.js:34` → `server: { host: '0.0.0.0', allowedHosts: true, fs: { allow: ['..'] } }`

Con el puerto publicado en el preview (`https://{port}-{sandboxId}.e2b.app`) y `fs.allow: ['..']`, la raíz de archivos servibles pasa a ser `/home/user`, no el repositorio. Verificado en caliente:

```
/@fs/home/user/prueba-fs.txt        → 200  (archivo creado fuera del repo, contenido devuelto)
/@fs/home/user/.bashrc              → leído (falla solo al transformarlo como JS)
/@fs/home/user/Calculadora/.git/... → 403  (los dotfiles los bloquea Vite por defecto ✅)
```

No hay secretos en el repo y `.git` está bloqueado por la lista negra de Vite, así que el riesgo es **bajo pero real** (el preview es público y en una máquina de desarrollo el padre del repo es el *home*).

**Sugerencia:** quitar `fs.allow` (no hace falta: el catálogo está dentro del proyecto) o acotarlo a `['.']`. Mantener `allowedHosts: true` solo si es imprescindible para el proxy del preview.

### 5.4 🟠 P2 — Documentación desfasada respecto al código

| Documento | Afirma | Realidad |
|---|---|---|
| `docs/implementacion.md:41` | «**`NavDropdown`**: un `DropdownMenu` de Radix por grupo» | `NavDropdown.jsx` **fue eliminado** en `d063104`. |
| `docs/implementacion.md:48` | «La navegación lateral **contraíble** se mantuvo: el botón alterna `.shell.collapsed`» | `Sidebar.jsx` eliminado, no existe ninguna clase `collapsed` en `src/`; el test exige «*sin una barra lateral fija*». |
| `docs/implementacion.md:12,23` | Árbol/capa con `Sidebar` y «barra superior, menús, hoja móvil…» | El árbol real ya no tiene `Sidebar.jsx` ni `NavDropdown.jsx`. |
| `README.md:24` | «Escáner con **4** estrategias» | `scanner.js` define **5**: *Flip*, *Royal → BM*, **Mejora**, *Craft Trades*, *Refining Trades*. |
| `docs/analisis-albionmarkethub.md:46` | «✅ 4 estrategias» | Ídem: la quinta (*Mejora*) no está documentada en ningún sitio. |
| `README.md:71` | «`CalculatorView.jsx` — vista reutilizable de los **8** módulos de producción» | `registry.jsx` la usa en **7** (los otros 3 son Monturas, Flipping y Precios). |
| `settings/index.js:63` | `GROUPS = ['Producción', 'Mercado']` | `sidebar-data.js` usa **tres** grupos (Producción, Especialidades, Mercado); `MODULES[].group` tampoco incluye «Especialidades». `GROUPS` **no se usa en ningún lado**. |
| `README.md:11` | «10 módulos agrupados en Producción, Especialidades y Mercado» | Correcto para la barra lateral, pero inconsistente con `MODULES`/`GROUPS` (§ arriba). |

Además, la estrategia *Mejora* tampoco aparece en el menú lateral (`sidebar-data.js` lista solo 4 hijos de Flipping), así que está escondida: solo se descubre al entrar en la pestaña.

**Sugerencia:** actualizar `docs/implementacion.md` y `README.md`, añadir «Mejora» a la navegación y **eliminar `GROUPS`** o hacer que `MODULES` sea la única fuente de grupos.

### 5.5 🟠 P2 — Enlaces de «Soporte» rotos en producción

`sidebar-data.js:58-63` enlaza `Documentación` y `Análisis de mercado` a `/docs/implementacion.md` y `/docs/analisis-albionmarkethub.md`.

* En **desarrollo**: responden 200 (`text/markdown`).
* En **producción**: `dist/` solo contiene `index.html` y `assets/` → **404**.

**Sugerencia:** o se copian los `.md` a `dist` (plugin de Vite), o se renderizan dentro de la app (pestaña «Docs»), o se apunta a GitHub (`/blob/main/docs/...`). Con el `href` actual el usuario nuevo ve un enlace muerto.

### 5.6 🟠 P2 — No hay *error boundary*

No existe `ErrorBoundary` ni `componentDidCatch` en `src/`. Cualquier excepción de render (por ejemplo un ítem con datos incompletos del catálogo — hay 23 entradas sin `value` y 1.849 sin `journal`) desmonta toda la app y deja la pantalla en blanco, sin mensaje ni forma de recuperarse salvo recargar.

### 5.7 🟡 P3 — Bundle monolítico de 5,27 MB

* Un único `index-*.js` de **5.269,78 kB** (436,56 kB gzip). El catálogo (`data/catalog.js`, 5,24 MiB en **una sola línea**) se importa de forma estática desde `catalog.js` y `BreedingView.jsx`, así que entra completo en el chunk inicial.
* No hay `import()` dinámico, ni `manualChunks`, ni precarga intencionada. En móvil, el primer render bloquea hasta descargar y parsear ~5 MB de JS.
* Ya existe una optimización equivalente en el dev server (`catalog-static` en `vite.config.js`), pero no en el build.
* Coste de `catalog.search`: ~1,4–2,3 ms por consulta típica y **~10,9 ms** con un solo carácter (se puntúan miles de entradas). Aceptable, pero sin `debounce` en `GlobalSearch` cada tecla hace ese trabajo.

**Sugerencias:** `dynamic import` del catálogo con pantalla de carga, chunk separado (`manualChunks: { catalog: ['...catalog.js'] }`) precargado, `build.target` moderno y compresión Brotli en el hosting.

### 5.8 🟡 P3 — Detalles de la caché en IndexedDB

`src/services/price-cache.js`

* `writePriceRows` escribe todas las filas en **una única transacción**: si una sola fila falla, `transaction.abort()` revierte el lote completo y se marca el aviso de caché en **todas** las filas (`__cacheWarning`). Conviene tolerancia por fila o reintento.
* `openDatabase()` cachea la promesa: si la base se cierra por `onversionchange` (otra pestaña), la promesa sigue apuntando a una `IDBDatabase` cerrada y las transacciones posteriores fallarán con `InvalidStateError` hasta recargar.
* `clearPriceCache()` / `readPriceRows()` no capturan `onblocked`; con la pestaña duplicada el usuario ve un error genérico.
* No hay límite de tamaño (solo retención de 90 días y *prune* cada 24 h). En navegadores con cuota ajustada (Safari/iOS) puede llegar a `QuotaExceededError`; hoy se degrada a «aviso de caché», lo cual está bien, pero no se informa al usuario.
* Puntos bien resueltos: claves por servidor+ítem+ciudad+calidad, *merge* por lado (compra/venta con fechas independientes), retención explícita y controles de tamaño/borrado en la vista *Precios*.

### 5.9 🟡 P3 — Detalles del escáner

`src/modules/flipping/scanner.js`

* En la fila de resultado, `sellMode` aparece **dos veces** en el mismo objeto literal (`sellMode: citySellMode` en las líneas 274 y 276): el segundo gana; es código muerto y confunde.
* Estrategia de crafteo: `profit` se devuelve **por unidad** (`result.profit / outputQty`) pero `salesTax`, `setupFee` y `buyOrderFee` son del **lote completo**. Con `amount > 1` se mezclan unidades en la misma tabla. Hoy casi todos los ítems tienen `amount = 1`, así que el error está latente.
* Estrategia *Mejora*: no aplica **ninguna** tasa de estación/energía por encantar; si el juego cobra tarifa (como en la vista de Encantamiento, que sí la contempla), la ganancia está sobreestimada. **Verificar antes de publicitarla.**
* `bestPurchasePrice` con modo `buy` elige el **mayor** `buy_price_max` para "comprar": conceptualmente es el precio necesario para ganar la orden, pero no es el precio que se paga. Conviene explicitarlo en la UI.
* Buenas prácticas presentes: lotes por longitud real de URL, `delay(120)` entre lotes, cobertura de cotizaciones, `busyRef` para evitar doble escaneo, `age` máximo de los datos.

### 5.10 🟡 P3 — Accesibilidad

* `ItemSelector` implementa el autocompletado con `<div onClick>`: no hay `role="listbox"`, `aria-expanded`, `aria-activedescendant` ni `aria-selected`. Funciona con teclado (flechas + Enter en el input), pero un lector de pantalla no anuncia la lista ni la opción activa.
* Solo **7** `aria-label` en todo `src/`; los botones de icono del menú móvil y de la barra superior los tienen, pero los chips de encantamiento (`.0`–`.4`) dependen del texto.
* `Field` envuelve en `<label>` el control, así que la asociación label↔input es correcta ✅.
* Las imágenes de ítems usan `alt=""` (decorativas) ✅, pero en la ficha del ítem no tienen `width/height`, lo que provoca *layout shift*.

### 5.11 🟡 P3 — Calidad de código y housekeeping

* **9 imports sin usar:** `React` en `Field.jsx`, `sheet.jsx`, `main.jsx`, `registry.jsx` (necesario con el runtime automático? no: `jsx: automatic` ya está configurado); `Button` en `ApplicationShell.jsx`; `TAX` y `fmt1` en `CalculatorView.jsx`; `BLACK_MARKET` y `esc` en `ScannerView.jsx`.
* `DataTable.jsx:10` usa `key={i}`: inofensivo (encabezados estáticos) pero es el patrón a evitar.
* `key={index}` no aparece en listas dinámicas ✅; no hay `dangerouslySetInnerHTML` ni `innerHTML` ✅ (sin superficie de XSS).
* Sin **linter ni formatter** (`.eslintrc`, `eslint.config.js`, `.prettierrc` no existen) y con `// eslint-disable-line react-hooks/exhaustive-deps` en varios efectos: la deuda de dependencias no se está midiendo.
* **Sin CI:** 78 pruebas y un `check` de sintaxis que solo se ejecutan a mano. Un workflow mínimo (check + test + build) evitaría que el próximo commit grande rompa `main` — como ya pasó a estar a un pelo con `d063104`.
* Sin `LICENSE` (el README tiene aviso legal, pero GitHub no puede detectar licencia).
* `package.json` sin `engines`: Vite 6 / Vitest 4 piden Node ≥ 18/20. Node 22 funciona; conviene declararlo (`>=20`).
* Dos versiones de `esbuild` instaladas (`0.28.2` propia + `0.25.12` anidada de Vite): duplica peso en `node_modules` sin beneficio.
* `index.html` no declara `favicon`, lo que genera una petición 404 en cada carga.

### 5.12 🟡 P3 — Datos del catálogo

* 8.382 entradas, sin IDs duplicados, todas con receta ✅, cifra coherente con el README ✅.
* **23 entradas sin `value`** (`T2_SKILLBOOK_NONTRADABLE`, `T3_ALCHEMY_RARE_*`, …): con `itemValue = 0` la nutrición y, por lo tanto, la **tasa de estación** calculada es 0 → craftearlas parece gratis. Conviene marcarlas como «valor desconocido» en vez de 0.
* 1.849 entradas sin `journal` ✅ (correcto: no todas las recetas dan diario).
* `MOUNT_FOODS`: **8 de 171** con `es === id` (sin traducir, p. ej. `T8_MOUNT_ARMORED_HORSE_MORGANA`), y varios `T8_FARM_*_GROWN` sin nombre en español. *(Dimensionado y resuelto como se explica en 9.6.)*
* `tools/generate_catalog.py` usa `REF = "master"`: regenerar hoy puede producir un catálogo distinto sin dejar rastro de qué versión del dump se usó. **Recomendado fijar el SHA** del dump y escribirlo en la cabecera del archivo generado. *(Aplicado en 9.6.)*
* `data/catalog.js` es un artefacto generado de 5,5 MB en **una sola línea**: cualquier regeneración produce un diff de 5 MB ilegible y el repo `.git` ya pesa 1,5 MB. Alternativa a evaluar: generar JSON comprimido y cargarlo con `fetch` (permitiría *cache* HTTP y sacarlo del bundle).

---

## 6. Cobertura de pruebas

**7 archivos / 78 pruebas**, todas en verde:

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `app.test.jsx` | 28 | Flujos completos de UI en los 10 módulos, comparación de ciudades, faltantes, caché |
| `api.test.jsx` | 10 | Fechas por lado, validación, cobertura, batching, 429, CORS, fallback/expiración |
| `item-taxonomy.test.jsx` | 23 | Clasificación de ítems |
| `scanner.test.jsx` | 6 | Las 5 estrategias, filtros |
| `mounts.test.jsx` | 4 | Flujos crianza/ensillado, precio faltante |
| `mount-breeding.test.jsx` | 4 | Fórmulas de crianza |
| `transmutation.test.jsx` | 3 | Tarifas y cálculo |

**Huecos principales:**

1. Ningún test compara **qué cotización** se muestra en Monturas (de ahí el bug 5.1).
2. `engine.js` no tiene pruebas unitarias propias: `breakEven`, `relists`, diarios incompletos y comparativa Premium solo se cubren de forma indirecta desde la UI.
3. `price-cache.js` no tiene pruebas de `prunePriceCache`, cuota, ni del cierre por `versionchange`.
4. `package.json` → `test.include: ['tests/**/*.test.jsx']`: un archivo `.test.js` se ignoraría en silencio.
5. Sin medición de cobertura (`@vitest/coverage-v8` no está instalado).

---

## 7. Plan de acción sugerido

**Antes de cualquier otra mejora:**

1. 🔴 Corregir `sellPriceMode` en `BreedingView.jsx` y añadir test de ambos modos.
2. 🟠 Añadir `AbortSignal.timeout` + cancelación por vista en `api.js`.
3. 🟠 Quitar `fs.allow: ['..']` de `vite.config.js`.
4. 🟠 Actualizar `docs/implementacion.md` y `README.md` (NavDropdown/Sidebar eliminados, 5 estrategias, 7 módulos, grupos) y eliminar `GROUPS`.
5. 🟠 Resolver los enlaces a `/docs/*.md` en producción (copiar a `dist` o enlazar a GitHub).

**Corto plazo:**

6. `ErrorBoundary` de nivel superior con botón «reintentar».
7. Añadir «Mejora» a la navegación lateral y documentar la estrategia.
8. GitHub Actions: `check` + `test` + `build` en cada PR.
9. ESLint (con `react-hooks`) + Prettier, y limpiar los 9 imports sin usar.

**Mediano plazo:**

10. *Code splitting* del catálogo (import dinámico + chunk precargado) y compresión Brotli.
11. Endurecer `price-cache.js` (tolerancia por fila, reseteo de `databasePromise` tras `versionchange`).
12. Fijar el SHA del dump en `generate_catalog.py` y decidir si el catálogo sigue versionado como JS.
13. Añadir pruebas unitarias de `engine.js` y cobertura.

---

## 8. Anexo — Cómo reproducir esta revisión

```bash
git fetch --unshallow origin      # el clon inicial era superficial (1 commit)
npm ci
npm run check                     # 51/51
npm test                          # 78/78
npm run build                     # 5,27 MB JS / 436 kB gzip
npm run dev                       # http://localhost:8000

# Exposición del dev server (con el servidor levantado)
echo hola > /tmp/x.txt && cp /tmp/x.txt ~/prueba-fs.txt
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/@fs$HOME/prueba-fs.txt   # 200
```

Para reproducir el bug de Monturas: abrir *Monturas → Crianza*, elegir animal y alimento, alternar «Forma de vender» y observar que el precio mostrado **baja** al pasar a *orden de venta* y **sube** al pasar a *venta directa* (debería ser al revés).

---

## 9. Correcciones aplicadas

Todas las acciones del §7 se implementaron y se verificaron con la batería completa.

### 9.1 Correcciones funcionales

| # | Hallazgo | Corrección | Verificación |
|---|---|---|---|
| 1 | **P1** · `sellPriceMode` invertido en Crianza | `src/modules/mounts/BreedingView.jsx`: `'buy' : 'sell'`, con comentario de la convención AODP | Test nuevo en `tests/mounts.test.jsx` que compara el precio mostrado con `sell_price_min`/`buy_price_max` en ambos modos. Se comprobó que **falla con el código anterior** y pasa con el nuevo |
| 2 | **P2** · Sin timeout ni cancelación en AODP | `PRICE_REQUEST_TIMEOUT_MS = 15 s` + `AbortSignal` en `fetchPrices`; cancelación al cambiar de ítem, de filtros o al desmontar en CalculatorView, PricesView, BreedingView y el escáner; botón «Cancelar búsqueda»; la cancelación del usuario ya no se informa como error ni cae a la caché | 5 tests nuevos en `tests/api.test.jsx` (cancelación, timeout sin caché, timeout con caché, señal ya cancelada, liberación de la petición en vuelo) |
| 3 | **P2** · `fs.allow: ['..']` exponía el home | Eliminado de `vite.config.js`; el servidor solo sirve el proyecto | `curl /@fs/...` fuera del proyecto devuelve 403 |
| 4 | **P2** · Documentación desfasada | `docs/implementacion.md` y `README.md` reescritos en los puntos afectados (menú lateral, cinco estrategias, siete módulos, grupos); `GROUPS` eliminado; `MODULES[].group` alineado con la navegación; «Mejora» añadida al menú | `grep` sin referencias a `NavDropdown`, `Sidebar` ni «4 estrategias» |
| 5 | **P2** · `/docs/*.md` en 404 en producción | Plugin `copy-docs` en `vite.config.js`: `dist/docs/` contiene los `.md` | `ls dist/docs` en el build |
| 6 | **P2** · Sin barrera de errores | `ErrorBoundary` por módulo en `App.jsx` (se reinicia al navegar) y barrera global + pantalla de fallo del catálogo en `main.jsx` | `tests/error-boundary.test.jsx` |
| 7 | **P3** · «Mejora» escondida | Añadida a la navegación y documentada (incluida la aclaración de que no suma tasa de estación) | `docs/implementacion.md` §6 |
| 8 | **P3** · Sin CI | `.github/workflows/ci.yml`: `npm ci`, `lint`, `check`, `test`, `build` en push a `main` y en PR | YAML versionado |
| 9 | **P3** · Sin linter | `eslint.config.js` (flat config, `js.configs.recommended`, `react-hooks`, `react/jsx-uses-vars`) y `.prettierrc.json`; scripts `lint`, `lint:fix`, `format`; los 9 imports sin usar eliminados | `npm run lint` sin errores ni avisos |

### 9.2 Rendimiento

| Antes | Después |
|---|---|
| Un chunk JS de **5.269,78 kB** (436,56 kB gzip) | `index-*.js` de **350,98 kB** (112,06 kB gzip) + chunk `catalog-*.js` de **4.926,44 kB** (326,58 kB gzip) |
| El catálogo bloqueaba el primer render | `main.jsx` lo pide con `import()`; `index.html` muestra un estado de carga con estilos en línea y el CSS pinta antes |
| Catálogo cacheado junto a la app | Chunk separado: un cambio de la app no invalida los ~4,9 MB del catálogo |

### 9.3 Robustez de la caché y del escáner

- `writePriceRows`: una fila inválida ya no aborta el lote; se cuentan los fallos y solo se informa error si fallaron todas.
- `openDatabase`: la conexión cerrada por otra pestaña (`versionchange`/`close`) libera la promesa cacheada; un `InvalidStateError` fuerza reapertura.
- Escáner: eliminada la clave `sellMode` duplicada; impuestos y tarifas normalizados **por unidad** (antes se mezclaban con la ganancia por unidad cuando la receta produce más de una).
- Deduplicación de peticiones: al cancelar se libera la entrada de inmediato. **Esto destapó una carrera real** que los tests existentes no veían: la nueva consulta heredaba la promesa vieja a punto de rechazarse y la vista quedaba sin datos. Corregido y cubierto con un test.

### 9.4 Accesibilidad y detalles

- `ItemSelector`: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="listbox"`/`option` con `aria-selected`.
- `GlobalSearch`: `aria-expanded` y `aria-controls`.
- Aviso visible cuando el catálogo no trae `itemValue` (la estación quedaría en 0).
- Favicon SVG propio, `theme-color`, `engines.node >= 20`, `license: UNLICENSED`, `esbuild` unificado en una sola versión.
- `DataTable` ya no usa el índice como `key`.

### 9.5 Verificación final

| Comprobación | Resultado |
|---|---|
| `npm ci` | 0 vulnerabilidades (`overrides.minimatch` a 11.x evita el aviso de ESLint; era el único paquete afectado, de desarrollo) |
| `npm run format:check` | Todo el código con el estilo de Prettier |
| `npm run lint` | 0 errores, 0 avisos |
| `npm run check` | 55/55 archivos con sintaxis correcta |
| `npm test` | **102 pruebas en 10 archivos**, todas en verde |
| `npm run test:coverage` | 87,5 % sentencias · 79,3 % ramas · 82,9 % funciones · 90,2 % líneas |
| `npm run build` | 1.675 módulos, `dist/` con `index.html`, CSS, chunk de app, chunk de catálogo y `docs/` |
| `npm run dev` | Catálogo servido sin transformar por el middleware; `/favicon.svg` y `/docs/*.md` responden 200 |

### 9.6 Segunda tanda: formato, catálogo reproducible y nombres ausentes

Los tres pendientes técnicos del informe se resolvieron en un commit aparte, sin tocar la licencia.

**Formato.** Se aplicó Prettier a los 55 archivos de código (54 reformateados). Se añadió `npm run format:check` y el paso «Formato (Prettier)» al CI, antes del lint, para que el estilo no vuelva a divergir. `data/catalog.js` y `docs/` quedan fuera por `.prettierignore` (el primero es un artefacto generado; el segundo, prosa).

**Catálogo reproducible.** `tools/generate_catalog.py` ahora fija `REF = "0483dd97f1581dfaf02eed42f25f5ea2a3cb75e5"` (dump del 2026-11-02), acepta `--ref <sha>` y `--out <ruta>`, y escribe el commit en la cabecera de `data/catalog.js`. La validación fue concluyente: regenerado con ese SHA, el archivo sale **idéntico byte a byte** al versionado salvo la propia cabecera, así que el catálogo del repo ya venía de ese commit y el pin no cambia ningún dato.

**Nombres ausentes.** El dump no puede resolverlos: de 83 IDs sin nombre en español, **74 no existen** en `formatted/items.json` (todas las familias `T*_RANDOM_DUNGEON_*_TOKEN*` y sus variantes `_D1`–`_D4`) y **8 existen sin `<LocalizedNames>`** (`T8_*_PROTOTYPE`, `UNIQUE_MOUNT_RHINO_TELLAFRIEND`, `UNIQUE_MOUNT_PANDA_TELLAFRIEND`, monturas T8 de evento). Es decir, no es un fallo del generador: el dato no está en la fuente. En lugar de inventar traducciones, el generador marca esas entradas con `untranslated: true` (127 filas: 119 recetas y 8 alimentos de montura) y la interfaz:

- muestra la etiqueta «sin nombre en el dump» en la ficha del ítem (`ItemSelector`), y
- avisa en Crianza cuando la cría o el alimento elegido no tienen nombre oficial.

Queda cubierto por `tests/catalog.test.jsx` (4 pruebas: la bandera solo afecta a lo marcado, sobrevive al registro del catálogo y los nombres en español no se marcan). Si se quieren nombres en español para esos ítems, es una tabla curada a mano —las variantes de mapa no se distinguen entre sí en el dump—, y por eso se deja como decisión aparte.

**Otros ajustes de la tanda.** Los dos avisos de `react-hooks/exhaustive-deps` de `CalculatorView` desaparecieron reemplazando el `useMemo` de configuración inicial por una función `initialConfig(prefs)` usada como inicializador perezoso de `useState` (mismo comportamiento, sin `eslint-disable`).

### 9.7 Lo que sigue pendiente

- **Licencia**: se dejó `license: UNLICENSED`; elegir una licencia (MIT, GPL-3.0…) es una decisión del autor, no del revisor. Fuera de alcance por pedido del dueño.
- **Nombres de los 83 IDs sin dato**: si se quieren mostrar en español, hace falta una tabla curada en `tools/generate_catalog.py`. Hoy se muestran como ID con la etiqueta correspondiente.
