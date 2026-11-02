# Calculadora

**Calculadora** es una web **HTML + CSS + JavaScript nativo** (módulos ES, sin build, sin frameworks y sin registro) para calcular la rentabilidad real de producir, encantar, refinar o revender ítems de Albion Online, y para encontrar oportunidades de mercado entre ciudades.

Trabaja con **8.302 recetas reales del juego**, los **precios del Albion Online Data Project**, los **bonus de producción por ciudad** y **todos los impuestos** que se pagan al vender. Para servidor **Américas (West)** por defecto; también Asia (East) y Europa.

## Diseño

- Fondo blanco / gris muy claro, tarjetas con bordes suaves y **azul** como color principal; **dorado** para acentos y precios manuales.
- **Navegación lateral** con 10 módulos agrupados en *Producción* y *Mercado*, **contraíble** (el estado se guarda en `localStorage`).
- **Pestañas horizontales** dentro de cada módulo.
- Distribución en dos columnas: **configuración a la izquierda, resultados a la derecha**.
- Botones principales azules y **ganancias positivas en verde**.
- Cabecera con servidor, calidad y Premium compartidos por todos los módulos.

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

- **Ítem y encantamiento**: buscador con autocompletado (nombre ES/EN o ID, tolerante a acentos) y chips `.0`–`.4`.
- **Dónde craftear / refinar**: la ciudad aplica su bonus real (base 0,18; +0,40 para refinado; +0,15 por categoría; Focus +0,59; bonus diario) y calcula el RRR automáticamente. También existe modo *Automática*.
- **Dónde comprar** los materiales y **dónde vender** el ítem, con compra inmediata / orden de compra y venta directa / orden de venta.
- **Precios manuales** para materiales, venta, diarios y tarifa de estación (introducida a mano). «Cargar precios del mercado» completa los datos desde AODP y **respeta los valores manuales** salvo que se active «Sobrescribir».
- **Impuestos**: 4 % con Premium / 8 % sin Premium, tarifa de orden de venta 2,5 % (más republicaciones), tarifa de orden de compra opcional y comparativa lado a lado con/sin Premium.
- **Diarios de crafteo** con fama, diarios vacíos y llenos.
- **Resultado**: desglose completo, ganancia neta, ROI, ganancia por ítem, precio de equilibrio y comparación de ganancia por ciudad.
- **Escáner**: filtros de categoría, tier, encantamiento, ciudad de compra, ciudades de venta, rutas seguras, RRR, Focus, bonus diario, tasa de estación, ganancia mínima, ROI mínimo, antigüedad máxima, orden y límite de filas. Cada fila se puede **abrir en la calculadora** con el ítem, las ciudades y los precios precargados.

## Cómo ejecutarla

Necesitás un servidor estático porque la app usa módulos ES (no funciona abriendo `index.html` con `file://`):

```bash
npm run dev          # servidor estático sin dependencias en http://localhost:8000
npm run check        # verifica la sintaxis de todos los archivos JS
npm run catalog      # regenera el catálogo desde ao-bin-dumps (requiere Python 3)
```

`npm run dev` no instala nada: `tools/serve.mjs` sirve el repo con Node. También podés usar `python3 -m http.server 8000`.

## Estructura

```
Calculadora/
├── index.html                          # punto de entrada: #app + CSS + módulo
├── package.json                        # scripts dev / start / check / catalog
├── data/
│   └── catalog.js                      # módulo ES con 8.302 recetas generadas
├── src/
│   ├── main.js                         # navegación, preferencias y estado compartido
│   ├── components/
│   │   ├── layout/{Header,Sidebar,MainLayout}.js
│   │   ├── common/{Tabs,Select,DataTable,ResultCard,ItemSelector}.js
│   │   └── charts/PriceBars.js
│   ├── modules/
│   │   ├── crafting/                   # CalculatorView: vista reutilizable
│   │   ├── flipping/                   # scanner.js + vista de 4 estrategias
│   │   ├── prices/                     # matriz de ciudades y calidades
│   │   ├── enchanting/ refining/ farming/ animals/ mounts/ alchemy/ cooking/
│   │   └── index.js                    # registro de módulos
│   ├── settings/index.js               # ciudades, impuestos, módulos, defaults
│   ├── services/                       # catalog, api, engine, bonus, format, storage
│   └── styles/main.css                 # tema claro, azul/dorado, responsive
├── tools/
│   ├── serve.mjs                       # servidor estático sin dependencias
│   ├── check.mjs                       # node --check sobre src/tools/data
│   └── generate_catalog.py             # regenera data/catalog.js
└── docs/
    ├── analisis-albion-analytics.md    # análisis del repositorio de referencia (WPF)
    ├── analisis-albionmarkethub.md     # revisión de Albion Market Hub
    └── implementacion.md               # arquitectura, fórmulas y decisiones
```

Todo el estado se guarda en `localStorage` (`calculadora-prefs-v1`): ciudad de crafteo, compra/venta, Focus, bonus diario, colapso de la barra, Premium, servidor y calidad.

## Fuentes y créditos

- Recetas, `itemValue`, bonuses por ciudad, nombres localizados y materiales de encantamiento: [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps).
- Precios: [Albion Online Data Project](https://www.albion-online-data.com/api/) (datos subidos por la comunidad).
- Iconos: Albion Render Service.
- Reglas de impuestos: [Albion Online Wiki – Marketplace](https://wiki.albiononline.com/wiki/Marketplace) y [Margin](https://wiki.albiononline.com/wiki/Margin).
- Lógica y modelo de datos inspirados en [Triky313/AlbionOnline-StatisticsAnalysis](https://github.com/Triky313/AlbionOnline-StatisticsAnalysis) (GPL-3.0), **reimplementados en JavaScript**.
- Funciones y filtros del escáner inspirados en [Albion Market Hub](https://albionmarkethub.com/trades); ver `docs/analisis-albionmarkethub.md`.

> Sin backend: el escáner consulta la API pública directamente y analiza un subconjunto acotado de ítems por búsqueda. No hay auto-refresh; si la API responde `429`, reducí el número de ítems o esperá. La app ofrece precios manuales y un proxy CORS opcional.

## Aviso

Herramienta educativa y de referencia, no afiliada a Sandbox Interactive ni a Albion Online. Los precios cambian constantemente: verificá siempre en el juego antes de invertir plata.
