/* ============================================================
   Calculadora Albion Online — Lógica
   Todas las fórmulas son orientativas y están en español.
   ============================================================ */

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

const pct = (n) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + " %";

const get = (id, def = 0) => {
  const el = document.getElementById(id);
  if (!el) return def;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : def;
};

const show = (id) => {
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const veredicto = (id, texto, tipo = "neutro") => {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = texto;
    el.className = "veredicto " + tipo;
  }
};

const calc = {
  // ---------- Fabricación ----------
  crafting() {
    const sell = get("craft-sell");
    const matCost = get("craft-mat");
    const stationPct = get("craft-station");
    const taxPct = get("craft-tax");
    const rrrPct = get("craft-rrr");
    const focusPts = get("craft-focus");
    const focusValue = get("craft-focus-value");

    // Los materiales recuperados (RRR) reducen el costo neto de materiales
    const matReturn = matCost * (rrrPct / 100);
    const netMatCost = matCost - matReturn;

    const stationFee = sell * (stationPct / 100);
    const tax = sell * (taxPct / 100);
    const focusCost = focusPts * focusValue;

    const profit = sell - netMatCost - stationFee - tax - focusCost;
    const roi = netMatCost + stationFee + tax + focusCost > 0
      ? (profit / (netMatCost + stationFee + tax + focusCost)) * 100
      : 0;

    show("crafting-result");
    setText("res-craft-gross", fmt(sell) + " plata");
    setText("res-craft-mat", "-" + fmt(netMatCost) + " plata  (recuperados: " + fmt(matReturn) + ")");
    setText("res-craft-station", "-" + fmt(stationFee) + " plata");
    setText("res-craft-tax", "-" + fmt(tax) + " plata");
    setText("res-craft-focus", "-" + fmt(focusCost) + " plata");
    setText("res-craft-profit", fmt(profit) + " plata");
    setText("res-craft-roi", pct(roi));

    const tipo = profit > 0 ? "positivo" : profit < 0 ? "negativo" : "neutro";
    const texto =
      profit > 0
        ? "¡Rentable! Fabricar te deja ganancia neta."
        : profit < 0
        ? "No rentable: mejor comprar el objeto en el mercado."
        : "Punto muerto: no ganas ni pierdes plata.";
    veredicto("crafting-veredicto", texto, tipo);
  },

  // ---------- Refinado ----------
  refining() {
    const inputQty = get("ref-input-qty");
    const inputPrice = get("ref-input-price");
    const outputQty = get("ref-output-qty");
    const outputPrice = get("ref-output-price");
    const stationPct = get("ref-station");
    const taxPct = get("ref-tax");
    const rrrPct = get("ref-rrr");

    const rawCost = inputQty * inputPrice;
    const returned = rawCost * (rrrPct / 100);
    const netCost = rawCost - returned;
    const revenue = outputQty * outputPrice;
    const fees = revenue * ((stationPct + taxPct) / 100);
    const profit = revenue - netCost - fees;
    const perUnit = outputQty > 0 ? profit / outputQty : 0;

    show("refining-result");
    setText("res-ref-cost", fmt(rawCost) + " plata");
    setText("res-ref-return", "+ " + fmt(returned) + " plata (RRR)");
    setText("res-ref-net-cost", fmt(netCost) + " plata");
    setText("res-ref-revenue", fmt(revenue) + " plata");
    setText("res-ref-fees", "-" + fmt(fees) + " plata");
    setText("res-ref-profit", fmt(profit) + " plata");
    setText("res-ref-per-unit", fmt(perUnit) + " plata/unidad");

    const tipo = profit > 0 ? "positivo" : profit < 0 ? "negativo" : "neutro";
    const texto =
      profit > 0
        ? "Refinar es rentable con estos parámetros."
        : profit < 0
        ? "Refinar a estos precios genera pérdida."
        : "Punto muerto en el refinado.";
    veredicto("refining-veredicto", texto, tipo);
  },

  // ---------- Recursos ----------
  resources() {
    const target = get("res-target");
    const perItem = get("res-per-item");
    const rrrPct = get("res-rrr");

    const raw = target * perItem;
    const returned = raw * (rrrPct / 100);
    const net = raw - returned;
    const saved = raw - net;

    show("resources-result");
    setText("res-res-raw", fmt(raw) + " unidades");
    setText("res-res-return", fmt(returned) + " unidades (RRR)");
    setText("res-res-net", fmt(net) + " unidades");
    setText("res-res-saved", fmt(saved) + " unidades ahorradas");
  },

  // ---------- Mercado / Flip ----------
  market() {
    const buy = get("mkt-buy");
    const sell = get("mkt-sell");
    const qty = get("mkt-qty");
    const taxPct = get("mkt-tax");

    const cost = buy * qty;
    const grossRevenue = sell * qty;
    const tax = grossRevenue * (taxPct / 100);
    const netRevenue = grossRevenue - tax;
    const profit = netRevenue - cost;
    const perUnit = qty > 0 ? profit / qty : 0;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;

    show("market-result");
    setText("res-mkt-cost", fmt(cost) + " plata");
    setText("res-mkt-tax", "-" + fmt(tax) + " plata");
    setText("res-mkt-revenue", fmt(netRevenue) + " plata");
    setText("res-mkt-profit", fmt(profit) + " plata");
    setText("res-mkt-per-unit", fmt(perUnit) + " plata/unidad");
    setText("res-mkt-roi", pct(roi));

    const tipo = profit > 0 ? "positivo" : profit < 0 ? "negativo" : "neutro";
    const texto =
      profit > 0
        ? "Flip rentable: hay margen tras el impuesto."
        : profit < 0
        ? "No rentable: el impuesto se come la ganancia."
        : "Punto muerto en el flip.";
    veredicto("market-veredicto", texto, tipo);
  },

  // ---------- Fama ----------
  fame() {
    const current = get("fame-current");
    const target = get("fame-target");
    const perLevel = get("fame-per-level");
    const bonusPct = get("fame-bonus");

    const levels = target - current;
    const base = levels > 0 ? levels * perLevel : 0;
    const total = base * (1 + bonusPct / 100);

    show("fame-result");
    setText("res-fame-levels", fmt(levels) + " niveles");
    setText("res-fame-base", fmt(base) + " fama");
    setText("res-fame-total", fmt(total) + " fama");
  },

  // ---------- Reset ----------
  reset(section) {
    const result = document.getElementById(section + "-result");
    if (result) result.style.display = "none";
    const ver = document.getElementById(section + "-veredicto");
    if (ver) ver.textContent = "";
  }
};

// Navegación por teclado: Entrar en un input numérico calcula al pulsar Enter
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  const id = el.id || "";
  if (id.startsWith("craft-")) calc.crafting();
  else if (id.startsWith("ref-")) calc.refining();
  else if (id.startsWith("res-")) calc.resources();
  else if (id.startsWith("mkt-")) calc.market();
  else if (id.startsWith("fame-")) calc.fame();
});

// Resaltar enlace activo según el panel visible (hash)
const links = document.querySelectorAll(".nav-link");
links.forEach((link) => {
  link.addEventListener("click", () => {
    links.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

if (location.hash) {
  const active = document.querySelector('.nav-link[data-section="' + location.hash.slice(1) + '"]');
  if (active) {
    links.forEach((l) => l.classList.remove("active"));
    active.classList.add("active");
  }
}
