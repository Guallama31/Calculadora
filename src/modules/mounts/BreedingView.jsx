import * as React from 'react';
import { CITIES, TAX } from '../../settings/index.js';
import * as catalog from '../../services/catalog.js';
import * as api from '../../services/api.js';
import { ageFromDate, fmt, fmt1 } from '../../services/format.js';
import { useApp } from '../../app/AppContext.jsx';
import { Field, NumberField, Select, Toggle } from '../../components/common/Field.jsx';
import { ResultGrid } from '../../components/common/ResultCard.jsx';
import { calculateBreeding, foodPlan } from '../../services/mount-breeding.js';

const CITY_OPTIONS = CITIES.map(city => ({ value: city.value, label: city.label }));
const buyPriceMode = mode => mode === 'instant' ? 'sell' : 'buy';
/* Vender en el acto se cruza contra las órdenes de compra (`buy_price_max`);
   publicar una orden de venta usa `sell_price_min`. Igual que CalculatorView/scanner. */
const sellPriceMode = mode => mode === 'instant' ? 'buy' : 'sell';

function priceIsSet(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function PriceField({ id, label, record, onChange, onClear, city }) {
  const age = record?.manual ? null : ageFromDate(record?.date);
  return (
    <Field label={label} className="mount-price-field">
      <input id={id} type="number" min="0" step="1" value={record?.value ?? ''}
        placeholder={record?.missing ? 'No se registra precio' : 'Ingresar precio manual'}
        onChange={event => onChange(event.target.value)} />
      <small className="hint">
        {record?.manual ? 'Precio manual' : record?.value != null
          ? `${record.source === 'cache' ? 'Cotización anterior · ' : ''}${city} · ${age.label}`
          : record?.missing ? 'No se registra precio; podés ingresarlo manualmente.' : `${city} · esperando cotización`}
      </small>
      {record?.manual && <button type="button" className="btn ghost" onClick={onClear}>Usar precio AODP</button>}
    </Field>
  );
}

export default function BreedingView() {
  const { shared } = useApp();
  const [animalId, setAnimalId] = React.useState('');
  const [foodId, setFoodId] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [foodUnitsOverride, setFoodUnitsOverride] = React.useState('');
  const [buyCity, setBuyCity] = React.useState('Martlock');
  const [sellCity, setSellCity] = React.useState('Lymhurst');
  const [buyMode, setBuyMode] = React.useState('instant');
  const [sellMode, setSellMode] = React.useState('order');
  const [offspringMode, setOffspringMode] = React.useState('sell');
  const [prices, setPrices] = React.useState({});
  const [manualPrices, setManualPrices] = React.useState({});
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const requestId = React.useRef(0);
  const requestAbort = React.useRef(null);

  const breeding = catalog.mountBreeding();
  const allFoods = catalog.mountFoods();
  const animal = React.useMemo(() => breeding.find(entry => entry.id === animalId) || null,
    [animalId, breeding]);
  const foods = React.useMemo(() => animal
    ? allFoods.filter(food => animal.foodCategories.includes(food.category))
    : [], [animal, allFoods]);
  const favoriteFood = animal?.favoriteFoodId
    ? foods.find(entry => entry.id === animal.favoriteFoodId) || null
    : null;
  const food = React.useMemo(() => foods.find(entry => entry.id === foodId) || null, [foodId, foods]);
  const plan = React.useMemo(() => foodPlan(animal, food), [animal, food]);
  const foodUnits = foodUnitsOverride === '' ? plan.unitsPerAnimal : Math.max(0, Math.floor(Number(foodUnitsOverride) || 0));
  const expectedOffspringPerUnit = Number(animal?.offspringChance) * Number(animal?.offspringAmount);
  const requiresOffspringPrice = offspringMode === 'sell' && expectedOffspringPerUnit > 0;
  const priceContext = (key, city, mode) => {
    const itemId = key === 'babyBuy' || key === 'offspringSell' ? animal?.id
      : key === 'foodBuy' ? food?.id : animal?.grownId;
    return JSON.stringify([shared.server, shared.quality, itemId, city, mode]);
  };
  const manualKey = (key, city, mode) => `${key}|${priceContext(key, city, mode)}`;
  const priceRecord = (key, city, mode) => {
    const override = manualPrices[manualKey(key, city, mode)];
    return override === undefined ? prices[key] : {
      ...prices[key], value: override, manual: true, source: 'manual',
      date: null, city, missing: false,
    };
  };
  const buyModeFor = buyPriceMode(buyMode);
  const sellModeFor = sellPriceMode(sellMode);
  const requiredPriceKeys = [
    'babyBuy',
    ...(foodUnits > 0 ? ['foodBuy'] : []),
    'grownSell',
    ...(requiresOffspringPrice ? ['offspringSell'] : []),
  ];
  const pricesComplete = !!animal && !!food
    && requiredPriceKeys.every(key => priceIsSet(priceRecord(
      key, key === 'babyBuy' || key === 'foodBuy' ? buyCity : sellCity,
      key === 'babyBuy' || key === 'foodBuy' ? buyModeFor : sellModeFor,
    )?.value));
  const offspringPriceAvailable = priceIsSet(priceRecord('offspringSell', sellCity, sellModeFor)?.value);
  const calculation = animal && food ? calculateBreeding({
    animal,
    food,
    quantity,
    foodUnitsPerAnimal: foodUnits,
    babyPrice: Number(priceRecord('babyBuy', buyCity, buyModeFor)?.value) || 0,
    foodPrice: Number(priceRecord('foodBuy', buyCity, buyModeFor)?.value) || 0,
    grownPrice: Number(priceRecord('grownSell', sellCity, sellModeFor)?.value) || 0,
    offspringPrice: Number(priceRecord('offspringSell', sellCity, sellModeFor)?.value) || 0,
    buyMode,
    sellMode,
    offspringMode,
    premium: shared.premium,
  }) : null;

  function setPrice(key, value, city, mode) {
    setManualPrices(current => ({ ...current, [manualKey(key, city, mode)]: value }));
  }

  function clearManualPrice(key, city, mode) {
    const storageKey = manualKey(key, city, mode);
    setManualPrices(current => {
      const next = { ...current };
      delete next[storageKey];
      return next;
    });
  }

  React.useEffect(() => {
    if (!animal || !food) {
      setBusy(false);
      setStatus('');
      return undefined;
    }

    const currentRequest = ++requestId.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setPrices({});
    setBusy(true);
    setStatus('Consultando precios…');
    const cities = [...new Set([buyCity, sellCity])];
    const ids = [...new Set([animal.id, animal.grownId, food.id])];
    api.fetchPrices({ server: shared.server, quality: shared.quality, ids, cities, signal: controller.signal })
      .then(rows => {
        if (requestId.current !== currentRequest) return;
        const map = api.indexRows(rows);
        const quote = (id, city, mode) => api.priceFor(
          api.pick(map, id, city, shared.quality),
          mode,
        );
        const quoteRecord = (value, city) => value
          ? { value: value.price, city, date: value.date, manual: false, source: value.source, missing: false }
          : { value: '', city, date: null, manual: false, missing: true };
        setPrices({
          babyBuy: quoteRecord(quote(animal.id, buyCity, buyPriceMode(buyMode)), buyCity),
          foodBuy: quoteRecord(quote(food.id, buyCity, buyPriceMode(buyMode)), buyCity),
          grownSell: quoteRecord(quote(animal.grownId, sellCity, sellPriceMode(sellMode)), sellCity),
          offspringSell: quoteRecord(quote(animal.id, sellCity, sellPriceMode(sellMode)), sellCity),
        });
        setStatus(`Precios consultados. Las cotizaciones pueden no existir para todas las ciudades. ${api.cacheNotice(rows)}`);
        setBusy(false);
      })
      .catch(error => {
        if (requestId.current !== currentRequest || api.isAbortError(error)) return;
        setStatus(`No se pudieron consultar los precios: ${error.message}`);
        setBusy(false);
      });

    return () => {
      requestId.current += 1;
      controller.abort();
    };
  }, [animal, food, buyCity, sellCity, buyMode, sellMode, shared.server, shared.quality, refresh]);

  const marketSettings = (
    <>
      <div className="field-row">
        <Select id="mount-breeding-buy-city" label="Ciudad de compra" options={CITY_OPTIONS}
          value={buyCity} onChange={setBuyCity} />
        <Select id="mount-breeding-sell-city" label="Ciudad de venta" options={CITY_OPTIONS}
          value={sellCity} onChange={setSellCity} />
      </div>
      <div className="field-row">
        <Select id="mount-breeding-buy-mode" label="Modo de compra"
          options={[{ value: 'instant', label: 'Compra inmediata' }, { value: 'order', label: 'Orden de compra' }]}
          value={buyMode} onChange={setBuyMode} />
        <Select id="mount-breeding-sell-mode" label="Modo de venta"
          options={[{ value: 'order', label: 'Orden de venta' }, { value: 'instant', label: 'Venta inmediata' }]}
          value={sellMode} onChange={setSellMode} />
      </div>
      <Toggle id="mount-breeding-premium" label="Aplicar impuesto de venta con Premium"
        checked={shared.premium} disabled />
    </>
  );

  const resultCards = calculation ? [
    { id: 'mount-breeding-expected-offspring', label: 'Crías esperadas (promedio)', value: fmt1(calculation.expectedOffspring), sub: `${fmt1(calculation.offspringChance * 100)} % de probabilidad por animal` },
    { id: 'mount-breeding-cost', label: 'Costo total', value: pricesComplete ? `${fmt(calculation.totalCosts)} plata` : 'Faltan precios' },
    { id: 'mount-breeding-profit', label: 'Ganancia estimada', value: pricesComplete ? `${fmt(calculation.profit)} plata` : 'Faltan precios', tone: pricesComplete ? calculation.profit >= 0 ? 'positive' : 'negative' : '' },
    { id: 'mount-breeding-roi', label: 'ROI', value: pricesComplete ? `${fmt1(calculation.roi)} %` : '—' },
    { id: 'mount-breeding-profit-day', label: 'Ganancia estimada / día', value: pricesComplete ? `${fmt(calculation.profitPerDay)} plata` : '—', sub: `Ciclo de ${fmt1(calculation.growthDays)} días` },
    { id: 'mount-breeding-feed-total', label: 'Alimento total', value: `${fmt(calculation.totalFoodUnits)} unidades`, sub: `${fmt(calculation.foodUnitsPerAnimal)} por cría · ${fmt(calculation.nutritionRequiredPerAnimal)} nutrición estimada` },
    { id: 'mount-breeding-silver', label: 'Costo de crianza', value: `${fmt(calculation.silverCost)} plata` },
    { id: 'mount-breeding-retained', label: 'Valor de crías retenidas', value: offspringMode === 'keep'
      ? offspringPriceAvailable ? `${fmt(calculation.retainedOffspringValue)} plata` : 'No se registra precio'
      : '—', sub: offspringMode === 'keep' ? 'No se suma a la ganancia realizada' : 'Las crías se venden según el modo seleccionado' },
  ] : [
    { id: 'mount-breeding-expected-offspring', label: 'Crías esperadas (promedio)', value: '—' },
    { id: 'mount-breeding-cost', label: 'Costo total', value: '—' },
    { id: 'mount-breeding-profit', label: 'Ganancia estimada', value: '—' },
  ];

  return (
    <div className="work-grid mount-breeding">
      <div className="config-col">
        <section className="card">
          <div className="card-head"><h2>Plan de crianza</h2><span className="card-tag">Datos del juego</span></div>
          <Select id="mount-breeding-animal" label="Cría que querés criar"
            options={[{ value: '', label: 'Elegí una cría…' }, ...breeding.map(entry => ({
              value: entry.id,
              label: `T${entry.tier} · ${entry.es}`,
            }))]}
            value={animalId}
            onChange={value => {
              setAnimalId(value);
              setFoodId('');
              setFoodUnitsOverride('');
              setPrices({});
            }} />
          <Select id="mount-breeding-food" label="Alimento"
            options={[{ value: '', label: animal ? 'Elegí un alimento…' : 'Primero elegí una cría' },
              ...foods.map(entry => ({
                value: entry.id,
                label: `${entry.tier ? `T${entry.tier} · ` : ''}${entry.es} · ${fmt(entry.nutrition)} nutrición`,
              }))]}
            value={foodId} disabled={!animal}
            onChange={value => {
              setFoodId(value);
              setFoodUnitsOverride('');
              setPrices({});
            }} />
          {animal && (
            <p className="hint mount-data-note">
              {favoriteFood
                ? `Comida favorita indicada por el juego: ${favoriteFood.es}.`
                : animal.favoriteFoodEs
                  ? `Comida favorita indicada por el juego: ${animal.favoriteFoodEs}.`
                : `El dump del juego no indica una comida favorita para este animal. Elegí cualquier alimento aceptado (${animal.foodCategories.join(', ')}).`}
            </p>
          )}
          <NumberField id="mount-breeding-quantity" label="Cantidad de crías" min={1} step={1}
            value={quantity} onChange={setQuantity} />
          <NumberField id="mount-breeding-feed-per-animal" label="Alimento por cría"
            min={0} step={1} value={foodUnits} onChange={setFoodUnitsOverride}
            hint={food ? `Estimación editable: ${fmt(plan.nutritionRequired)} nutrición / ${fmt(food.nutrition)} por unidad.` : 'Se calcula al elegir cría y alimento.'} />
          <Select id="mount-breeding-offspring-mode" label="Qué hacer con las crías obtenidas"
            options={[{ value: 'sell', label: 'Vender las crías esperadas' }, { value: 'keep', label: 'Conservar las crías' }]}
            value={offspringMode} onChange={setOffspringMode} />
          <p className="hint mount-data-note">
            La cantidad de crías es un promedio estadístico, no una garantía por ciclo. El cálculo de alimento se estima con los datos del dump y queda editable. Focus no se aplica al promedio porque su efecto por ciclo requiere validación adicional.
          </p>
        </section>
        <section className="card">
          <div className="card-head"><h2>Mercado y venta</h2><span className="card-tag">{shared.server.toUpperCase()}</span></div>
          {marketSettings}
          <p className="hint">AODP consulta las ciudades elegidas. Si no registra un precio, ingresalo manualmente; no se completa con estimaciones.</p>
        </section>
      </div>

      <div className="results-col">
        <section className="card">
          <div className="card-head">
            <h2>Precios unitarios</h2>
            <div className="card-head-actions">
              <span className="card-tag">{busy ? 'Consultando…' : 'AODP + manual'}</span>
              <button type="button" className="btn tiny" disabled={!animal || !food || busy}
                onClick={() => setRefresh(value => value + 1)}>Actualizar precios</button>
            </div>
          </div>
          {!animal || !food
            ? <p className="empty-state">Elegí una cría y un alimento para consultar sus precios.</p>
            : <>
              <div className="field-row">
                <PriceField id="mount-breeding-baby-buy-price" label={`Comprar cría · ${buyCity}`}
                  record={priceRecord('babyBuy', buyCity, buyModeFor)}
                  onChange={value => setPrice('babyBuy', value, buyCity, buyModeFor)}
                  onClear={() => clearManualPrice('babyBuy', buyCity, buyModeFor)} city={buyCity} />
                <PriceField id="mount-breeding-food-buy-price" label={`Comprar alimento · ${buyCity}`}
                  record={priceRecord('foodBuy', buyCity, buyModeFor)}
                  onChange={value => setPrice('foodBuy', value, buyCity, buyModeFor)}
                  onClear={() => clearManualPrice('foodBuy', buyCity, buyModeFor)} city={buyCity} />
              </div>
              <div className="field-row">
                <PriceField id="mount-breeding-grown-sell-price" label={`Vender animal adulto · ${sellCity}`}
                  record={priceRecord('grownSell', sellCity, sellModeFor)}
                  onChange={value => setPrice('grownSell', value, sellCity, sellModeFor)}
                  onClear={() => clearManualPrice('grownSell', sellCity, sellModeFor)} city={sellCity} />
                <PriceField id="mount-breeding-offspring-sell-price" label={`Vender cría · ${sellCity}`}
                  record={priceRecord('offspringSell', sellCity, sellModeFor)}
                  onChange={value => setPrice('offspringSell', value, sellCity, sellModeFor)}
                  onClear={() => clearManualPrice('offspringSell', sellCity, sellModeFor)}
                  city={sellCity} />
              </div>
            </>}
          <p className={`mount-price-status ${busy ? 'loading' : ''}`} role="status">{status}</p>
        </section>

        <section className="card">
          <div className="card-head"><h2>Resultado por ciclo</h2><span className="card-tag">{quantity} animales</span></div>
          {animal && food && !pricesComplete && (
            <p className="mount-data-note" role="status">Completá los precios faltantes para calcular costos y ganancia. Las crías esperadas se muestran como promedio.</p>
          )}
          <ResultGrid cards={resultCards} />
          {calculation && pricesComplete && (
            <div className="mount-cost-summary">
              <span>Impuesto de venta: {fmt(calculation.salesTax)} plata</span>
              <span>Tarifas de órdenes: {fmt(calculation.setupFee + calculation.buyOrderFee)} plata</span>
              <span>Premium: {shared.premium ? `sí (${fmt1(TAX.salesPremium * 100)} %)` : `no (${fmt1(TAX.salesNoPremium * 100)} %)`}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
