# 🛡️ Calculadora Albion Online

Web propia de calculadoras para **Albion Online**, creada en español y adaptada a nuestras necesidades. Inspirada en herramientas como Albion Intel, Albion Market Online y Albion Codex, pero con las funciones que realmente usamos.

## 📦 ¿Qué incluye?

Calculadoras de una sola página, sin registro y sin dependencias externas (salvo la tipografía de Google Fonts):

| Calculadora | ¿Para qué sirve? |
|-------------|------------------|
| **Fabricación (Crafting)** | Ganancia neta por objeto: materiales, tasa de estación, impuesto ciudad, Return Rate y coste de focus. |
| **Refinado** | Lingotes/tabla/tela/cuero/piedra: coste de materia prima, devolución por RRR, tasas y ganancia por lote/unidad. |
| **Recursos** | Cuántos recursos crudos necesitas reunir/comprar para un objetivo de refinados, descontando el Return Rate. |
| **Mercado / Flip** | Compra barata, venta cara: margen real tras el impuesto de transacción, ganancia por unidad y ROI. |
| **Fama (Destiny Board)** | Estimación de fama necesaria para subir niveles de maestría, con bonificador opcional. |

## 🚀 Cómo usarla

1. Abre `index.html` en cualquier navegador moderno.
2. Elige una calculadora del menú superior o haz scroll hasta la sección.
3. Rellena los campos con valores del juego (plata, porcentajes, cantidades).
4. Pulsa **Calcular** (o Enter en cualquier campo) y lee el resultado con el veredicto (rentable / no rentable / punto muerto).

No hay servidor ni base de datos: todo se calcula en tu navegador y nada sale de tu equipo.

## 🧠 Conceptos clave (estilo Albion)

- **Return Rate (RRR):** probabilidad de recuperar materiales al fabricar o refinar. Cuanto más alta, menor el coste neto.
- **Focus:** puntos de enfoque que aumentan el Return Rate. Se puede valorar en plata por punto.
- **Tasa de estación:** comisión del taller/refinería donde trabajas.
- **Impuesto ciudad:** porcentaje que se queda la ciudad por la transacción/venta.
- **ROI:** retorno sobre la inversión, en porcentaje.

## 🗂️ Estructura del repositorio

```
Calculadora/
├── index.html   # Estructura de la web (una sola página)
├── style.css    # Estilos: tema oscuro fantástico, responsive
├── script.js    # Lógica de todas las calculadoras (vanilla JS)
└── README.md    # Este archivo
```

## 🛠️ Personalizar

- Añade más calculadoras en `index.html` repitiendo el bloque `<section class="panel" id="...">`.
- Implementa su lógica en `calc` dentro de `script.js`.
- Ajusta colores en `:root` de `style.css` (oro Albion por defecto: `#d4a017`).

## ⚠️ Aviso

Esta herramienta es educativa y de referencia. Los precios de mercado cambian constantemente en Albion Online; introdúcelos manualmente desde el juego o desde una fuente de precios actualizada. No estamos afiliados con Sandbox Interactive ni Albion Online.

---

Hecho con ❤️ para la comunidad de Albion Online.