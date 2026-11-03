# Cobertura de precios: propuesta adaptada a Calculadora

> Propuesta y seguimiento de cobertura de precios, contrastada con el estado del proyecto al 2 de noviembre de 2026. La sección «Implementación vigente» distingue los cambios ya realizados del trabajo aún opcional; la caché local de cotizaciones ya está implementada, mientras que la base de datos compartida e infraestructura siguen fuera de alcance.

## 1. Resumen ejecutivo

La aplicación obtiene precios directamente de la API REST del [Albion Online Data Project (AODP)](https://www.albion-online-data.com/api/). No se confirmó una API pública de mercado de Sandbox Interactive ni una segunda fuente comunitaria independiente que mejore de forma verificable las cotizaciones de AODP. La cobertura de AODP depende de las observaciones que aportan sus clientes y usuarios; que una combinación no aparezca no significa que el precio sea cero.

El objetivo de Calculadora no es llenar todas las celdas con números. Es:

1. Solicitar las cotizaciones reales necesarias para el cálculo seleccionado.
2. Aprovechar mejor esas solicitudes y comunicar su fecha y ciudad.
3. Decir **«No se registra precio»** cuando AODP no devuelve una cotización positiva.
4. Permitir que el usuario ingrese un precio manual, distinguiéndolo del dato de AODP.
5. No producir ni presentar precios estimados como si fueran precios del mercado.

La recomendación es mejorar primero el cliente y la experiencia actual, sin agregar todavía un backend, una base de datos de mercado, un crawler permanente ni una integración NATS.

## 2. Estado actual verificado

| Área | Estado del proyecto |
|---|---|
| Catálogo | `data/catalog.js` exporta 8.382 recetas/entradas seleccionables, generadas desde los dumps de `ao-data/ao-bin-dumps`. Hay datos adicionales para crianza de monturas. El universo de IDs consultables incluye materiales y otros recursos; no debe inferirse contando solo las recetas. |
| Servidores | West, East y Europe, definidos en `src/settings/index.js`. |
| Ubicaciones | Ocho opciones en `CITIES`: siete ciudades y Mercado Negro. |
| Calidades | Cinco calidades configurables. |
| Fuente | `src/services/api.js` consulta directamente `/api/v2/stats/prices/{ids}.json` en los servidores de AODP. |
| Caché de red | Se deduplican solicitudes idénticas en curso. Las cotizaciones positivas con fecha válida se guardan en IndexedDB local por servidor, ítem, ciudad y calidad; solo se usan si AODP falla, con retención máxima de 90 días. |
| Cotización válida | `priceFor()` exige precio positivo y fecha válida. El indexado elige por separado la observación más reciente de compra y venta. |
| Faltantes | Crafteo, Refinamiento, Encantamiento, Monturas y Precios muestran los faltantes y ofrecen entrada manual donde aplica. No se convierte un cero o una ausencia en una cotización. |
| Valores manuales | Se guardan en el estado de la vista activa, separados de las respuestas AODP y con contexto de servidor, calidad, ciudad, ítem y lado donde aplica. Actualizar no los reemplaza; las vistas de Crafteo, Crianza y Transmutación permiten volver explícitamente a AODP. No hay persistencia durable en IndexedDB/backend. |
| Histórico | No se consulta ni almacena histórico de precios. Las vistas muestran la fecha que devuelve AODP para la cotización cargada. |
| Escáner | `src/modules/flipping/scanner.js` obtiene candidatos del catálogo y usa el batching compartido de `api.js`: hasta 30 IDs y máximo local de 3.500 caracteres calculado sobre la URL codificada completa, con pausa de 120 ms entre lotes. Expone cobertura de las claves solicitadas; el umbral local no afirma ser un límite vigente de AODP. No usa una base de datos ni un book de órdenes propio. |
| Backend | No hay servidor de precios, worker, base compartida, Redis ni proxy de aplicación. La caché permanece en el perfil local del navegador y no se sincroniza. |

La selección global de servidor/calidad y la carga manual son comportamientos existentes; la procedencia se explicita ahora en las cotizaciones y vistas modificadas, pero no existe persistencia durable de precios manuales.

## 2.1 Implementación vigente

Se implementaron estas mejoras del plan:

- Compra y venta se validan y se indexan por separado, conservando para cada lado su observación válida más reciente. Las cotizaciones normalizadas indican `source: 'aodp'`; precio no positivo o fecha inválida se trata como ausencia.
- Los manuales se mantienen fuera del resultado AODP. Actualizar precios no los pisa; están aislados por contexto y se puede volver explícitamente a la cotización de AODP en Crafteo, Crianza y Transmutación. Continúan siendo temporales al navegar/cerrar la vista.
- El escáner y Transmutación usan el mismo divisor de lotes, que cuenta la longitud de la URL final codificada y falla explícitamente si un solo ID supera el umbral local.
- El resumen del escáner distingue solicitudes HTTP iniciadas de llamadas deduplicadas en curso y muestra las cotizaciones AODP válidas, las solicitadas, las ausentes y su porcentaje. La cobertura cuenta por ítem × ciudad × calidad × lado y no suma manuales.
- Las respuestas AODP válidas se almacenan en IndexedDB local. Solo se consulta la caché si falla la petición en vivo; los resultados recuperados se etiquetan como «cotización anterior» y se conservan las fechas de observación.
- La caché separa buy/sell y contexto de servidor, ítem, ciudad y calidad; tiene retención de 90 días, limpieza al consultar AODP y un botón para borrarla desde Precios. No persiste los valores manuales ni consulta mercado en segundo plano.
- `tests/api.test.jsx` cubre fechas independientes, validación de precio/fecha, cobertura, batching, servidor inválido, respuesta HTTP incorrecta, aislamiento y fallback/expiración de caché. `tests/app.test.jsx` prueba el fallback visible y el control para borrarla.

El máximo local de 30 IDs/3.500 caracteres es una salvaguarda de la aplicación basada en el comportamiento previo; debe verificarse contra documentación vigente de AODP antes de tratarlo como límite del servicio o aumentarlo.

La retención local es de 90 días desde la última observación válida guardada, no desde una respuesta vacía. La cuota y persistencia real dependen del navegador; incógnito, borrado de datos o expulsión por presión de almacenamiento pueden eliminar la base. La app sigue consultando AODP primero y no etiqueta una observación guardada como precio en vivo.

## 3. Reglas de producto

### 3.1 La ausencia no es un precio

- Una respuesta vacía, cero, negativa o inválida equivale a **sin cotización**, no a plata cero.
- La UI muestra «No se registra precio» y deja el valor editable cuando el flujo admite edición manual.
- Si faltan precios necesarios, la app no debe mostrar una ganancia o ROI como si fueran un resultado completo.
- Ninguna operación de cobertura debe completar automáticamente una cotización con precio de otra ciudad, otra calidad o servidor sin pedirlo y etiquetarlo explícitamente.

### 3.2 Observado, manual e histórico son categorías distintas

- **AODP**: valor observado que devuelve la API, con ciudad, calidad, servidor y fecha de cada lado del mercado.
- **Manual**: valor escrito por la persona usuaria. Debe conservar esa procedencia y no ser reemplazado silenciosamente por una actualización automática.
- **Histórico**: una observación pasada, si se incorpora en una fase futura. Debe llevar su fecha y presentarse como histórica, nunca como precio actual.
- **Estimado**: no se usa para completar precios de mercado ni alimentar cálculos o el escáner. Los costos de receta que la app calcula a partir de precios ingresados son cálculos, no una cotización inferida.

### 3.3 No prometer cobertura total

La UI puede medir qué proporción de las combinaciones **solicitadas** tuvo una respuesta utilizable. No puede garantizar que todas las combinaciones servidor × ítem × ciudad × calidad tengan una observación reciente: depende de los datos enviados por la comunidad.

Una métrica de cobertura solo es significativa si define su universo. No debe calcularse sobre todas las combinaciones teóricas del catálogo y presentarse como si fueran precios disponibles en el mercado.

## 4. Arquitectura recomendada

### Etapa actual: aplicación cliente

```text
Vistas de producción / Flipping / Precios
                    │
                    ▼
       src/services/api.js
       - construir consulta AODP
       - deduplicar solicitudes en curso
       - validar respuesta y errores
       - exponer cotización + fecha
                    │
                    ▼
       REST pública de AODP
```

Mantener a `api.js` como única capa de acceso a precios. Las vistas no deben construir URLs ni llamar a servidores AODP por separado. La lógica de cálculo continúa en los servicios existentes y no debe rellenar precios ausentes.

### Arquitectura local vigente

```text
Vistas ── api.js/adaptador ── AODP
                │
                ├── IndexedDB local como respaldo si falla AODP
                └── overrides manuales en el estado de la vista, separados de AODP
```

La caché local mejora la continuidad, pero no actualiza el mercado ni sustituye una respuesta exitosa de AODP. Solo se usa si falla la petición en vivo; la UI la identifica como **cotización anterior** y conserva su fecha. Los overrides manuales no se persisten en IndexedDB.

### Backend: fuera del alcance inicial

Un backend solo se justifica si se necesita compartir observaciones entre usuarios, recolectar datos de forma continua o consultar un histórico centralizado. Antes de iniciarlo hacen falta una decisión de despliegue, costos operativos, retención, monitoreo, seguridad y límites de uso. No se recomienda añadir una base de datos, Redis o NATS solo para resolver cotizaciones faltantes de una app local.

## 5. Contrato de cotización

El adaptador debería normalizar una fila de AODP sin cambiar el significado de sus campos. El precio de compra y el precio de venta tienen fechas independientes:

```js
{
  itemId,
  city,
  quality,
  server,
  sell: { price, observedAt } | null,
  buy: { price, observedAt } | null,
  source: 'aodp'
}
```

Este esquema representa datos observados; `null` representa ausencia. Los valores manuales deben residir en un estado/registro distinto con `source: 'manual'`, sin sustituir el registro observado.

`priceFor()` conserva en `row` la fila indexada; esta puede combinar la observación buy y sell más reciente de respuestas distintas. Al ampliar el adaptador:

- Mantener compatibilidad con `indexRows`, `pick`, `priceAt`, `bestPrice` y las vistas existentes mientras se migra.
- No escoger una fila únicamente por la fecha de venta si eso puede descartar una fecha de compra más nueva. Resolver ambos lados de forma independiente.
- Validar que la respuesta sea un arreglo y que los precios sean positivos antes de tratarlos como cotizaciones.
- Propagar errores de conexión, HTTP y rate limit para que la UI no dé una respuesta exitosa falsa.

## 6. Medición que sí sirve

La medición debe registrar solo consultas hechas por la aplicación, no inventar un universo de precios. Para una consulta se cuentan claves únicas:

```text
clave = servidor × item_id × ciudad × calidad × lado (buy | sell)
```

Indicadores recomendados:

| Métrica | Definición |
|---|---|
| Solicitudes | Cantidad de requests AODP iniciados, separados de las consultas deduplicadas. |
| Claves solicitadas | Claves únicas de servidor/ítem/ciudad/calidad/lado requeridas por la acción del usuario. |
| Cotizaciones recibidas | Claves con precio mayor que cero y fecha válida. |
| Cobertura de la consulta | Cotizaciones recibidas ÷ claves solicitadas. Mostrar el denominador y el contexto de la consulta. |
| Cotizaciones ausentes | Claves solicitadas que no tienen un precio utilizable. |
| Antigüedad | Edad calculada por el timestamp correspondiente al lado buy/sell, nunca usando la fecha del otro lado. |
| Overrides manuales | Contarlos aparte; no sumarlos a las cotizaciones AODP ni a cobertura observada. |

Las métricas pueden comenzar como instrumentación de desarrollo o pruebas. No es necesario añadir telemetría remota ni identificar usuarios para conocer cuántas filas devolvió una solicitud.

## 7. Plan de trabajo propuesto

### Fase 0 — Confirmar el comportamiento de AODP

1. Mantener el endpoint documentado de precios como fuente de mercado.
2. Verificar en la documentación vigente los límites, formatos de `qualities`, longitud de URL y encabezados aceptados antes de fijarlos en código.
3. Guardar pruebas de contrato con respuestas reales anonimizadas o fixtures representativos; no depender de una captura puntual para asegurar cobertura futura.
4. Aclarar por prueba qué consulta hace cada flujo y cuántos IDs, ciudades y calidades envía.

**Aceptación:** ningún límite numérico de un documento anterior se trata como vigente si no está confirmado por documentación actual de AODP.

### Fase 1 — Corregir procedencia y prioridad manual

1. Centralizar la normalización de cotizaciones en `src/services/api.js`.
2. Representar explícitamente cotización AODP, precio manual y ausencia.
3. Asegurar que un refresh no sobrescriba silenciosamente un precio manual. La UI debe ofrecer una acción explícita para volver al dato de AODP o limpiar el manual.
4. Mantener servidor, ciudad, calidad y lado buy/sell en la identidad del precio manual.
5. Mostrar las fechas de buy y sell por separado cuando ambas estén disponibles.

**Aceptación:** pruebas cubren precio válido, cero/ausente, buy/sell con fechas diferentes, refresh con manual, limpiar manual y cálculo bloqueado cuando faltan valores requeridos.

### Fase 2 — Medir y optimizar consultas existentes

1. Registrar IDs, ciudades, calidades, filas devueltas y cotizaciones válidas por operación.
2. Evitar pedir varias veces la misma combinación dentro de una misma operación.
3. Revisar el tamaño de lotes actual del escáner (30 IDs, URL proyectada de 3.500 caracteres) con la URL realmente codificada, sin subir el lote a un supuesto máximo teórico.
4. Ajustar lotes solo después de comprobar el límite vigente y probar respuestas grandes, errores 429 y URLs largas.
5. Mantener una política de solicitudes serializadas o limitada; no disparar barridos globales desde cada vista.

**Aceptación:** la app reporta progreso y errores; las pruebas garantizan que el total solicitado se divide en lotes válidos, sin perder IDs ni duplicar resultados.

### Fase 3 — Persistencia local (implementada)

La aplicación guarda cotizaciones válidas de AODP en IndexedDB, separadas por servidor, ítem, ciudad y calidad, con observaciones buy/sell independientes. La retención máxima es de 90 días desde la última observación válida; Precios permite consultar el tamaño y borrar la caché. Los overrides manuales permanecen separados y temporales.

Reglas:

- AODP siempre se consulta primero; solo un fallo de la petición en vivo activa el fallback local.
- La caché muestra la observación como cotización anterior y conserva su fecha AODP, nunca como precio en vivo.
- La lectura descarta observaciones vencidas y las consultas exitosas depuran la caché; el usuario puede borrarla desde Precios.
- Si IndexedDB no está disponible, los precios en vivo siguen funcionando y el error de almacenamiento se comunica.

**Verificación:** pruebas cubren fallback visible, expiración, aislamiento por servidor/calidad, persistencia y borrado de la caché.

### Fase 4 — Histórico o fuente adicional, solo con evidencia

- El endpoint de histórico de AODP puede investigarse para una función explícita de tendencias, si su contrato y límites vigentes lo permiten. Un histórico no es una cotización actual.
- Albion Online Tools y otras webs comunitarias no se agregan como adaptadores hasta verificar una API pública documentada, permisos, formato, límites y fuente original de sus datos.
- No hacer scraping de páginas ni depender de endpoints internos no documentados.
- No integrar NATS/order book en esta etapa: requiere un servicio siempre activo y reglas de expiración/reconciliación que la aplicación actual no necesita.

**Aceptación:** cada fuente nueva tiene documentación pública verificable y se identifica en pantalla; los datos históricos o manuales no se mezclan con cotizaciones AODP actuales.

### Fase 5 — Backend, solo si cambia el alcance del producto

Si en el futuro se necesita compartir o acumular observaciones para varias personas:

- Diseñar primero API y despliegue; el cliente sigue consumiendo el adaptador `api.js`.
- Persistir observaciones originales y sus marcas temporales, sin sobrescribirlas con estimaciones.
- Implementar límites, reintentos, retención y monitoreo conforme a la documentación vigente de AODP.
- Separar una caché de lecturas de cualquier book de órdenes y no modelar órdenes como ventas confirmadas.
- Mantener la app funcional cuando el backend no esté disponible, con degradación explícita y sin sustituir cotizaciones ausentes por números inventados.

El stack de backend (SQLite/Postgres, Redis, worker) se decide en esa fase según los requisitos reales; no queda fijado por este documento.

## 8. Alcance explícitamente descartado por ahora

- Cobertura garantizada del 100 % de todo el catálogo, servidores, ciudades y calidades.
- Generar precios desde `itemValue`, receta, precios de otras ciudades/calidades o ratios aprendidos.
- Incluir valores estimados en el escáner o presentarlos como oportunidades verificadas.
- Crawler permanente que consulta los 8.382 productos y todas sus dependencias sin una demanda de usuario.
- NATS, libro de órdenes propio, Redis, PostgreSQL, servidor de producción y endpoints de sincronización de precios manuales.
- Afirmar límites exactos de AODP sin verificación de su documentación vigente.
- Reportar que el precio manual persiste después de navegar/cerrar, hasta que exista una política de almacenamiento probada.

## 9. Criterios de terminado

- Todo resultado de precio tiene procedencia identificable: AODP, manual o ausencia.
- Una cotización faltante se muestra como «No se registra precio»; nunca como cero ni como una estimación sin consentimiento.
- El cálculo de rentabilidad y las oportunidades del escáner solo usan entradas requeridas y valores de precio explícitos.
- Un refresh no pisa sin aviso los precios manuales.
- Las fechas de compra y venta se conservan y comparan de forma independiente.
- La cobertura se calcula sobre la consulta concreta y distingue observaciones de valores manuales.
- Los errores HTTP, 429, respuesta inválida y conectividad quedan visibles para el usuario.
- `npm test`, `npm run check` y `npm run build` pasan tras cambios de implementación.

## 10. Referencias y archivos del proyecto

- [AODP API](https://www.albion-online-data.com/api/) — documentación pública de la API de precios. Verificar allí límites y parámetros antes de fijarlos.
- [Albion Data Client](https://github.com/ao-data/albiondata-client/releases) — cliente comunitario que aporta observaciones al proyecto de datos.
- [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) — datos de catálogo del juego; fuente de recetas e IDs, no de precios de mercado.
- [`src/services/api.js`](../src/services/api.js) — solicitudes y normalización de respuestas AODP.
- [`src/modules/flipping/scanner.js`](../src/modules/flipping/scanner.js) — batching y evaluación de oportunidades.
- [`src/modules/prices/PricesView.jsx`](../src/modules/prices/PricesView.jsx) — matriz por ciudad y calidad.
- [`src/modules/crafting/CalculatorView.jsx`](../src/modules/crafting/CalculatorView.jsx) — precios requeridos, ingreso manual y cálculo.
- [`src/settings/index.js`](../src/settings/index.js) — servidores, ciudades y calidades disponibles.
- [`docs/implementacion.md`](implementacion.md) — arquitectura y comportamiento actual de la app.
