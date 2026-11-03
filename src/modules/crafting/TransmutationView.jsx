import * as React from 'react';
import { CITIES } from '../../settings/index.js';
import * as api from '../../services/api.js';
import * as catalog from '../../services/catalog.js';
import { ageFromDate, fmt, fmt2 } from '../../services/format.js';
import {
  buildTransmutationCandidates,
  calculateTransmutation,
  RESOURCE_TYPES,
} from '../../services/transmutation.js';
import { useApp } from '../../app/AppContext.jsx';
import { Select, NumberField } from '../../components/common/Field.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { cn } from '../../lib/utils.js';

const CITY_OPTIONS = CITIES.map(city => ({ value: city.value, label: city.label }));
const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los recursos' },
  ...Object.entries(RESOURCE_TYPES).map(([value, resource]) => ({ value, label: resource.label })),
];
const RESOURCE_QUALITY = 1;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function priceText(quote) {
  if (!quote) return 'No se registra precio';
  const age = ageFromDate(quote.date);
  return `${quote.source === 'cache' ? 'Cotización anterior · ' : ''}${quote.city} · ${age.label}`;
}

function MarketPrice({ id, label, quote, manualValue, manualActive, onChange, onClear }) {
  return (
    <div className="transmute-price">
      <img src={catalog.icon(id)} alt="" />
      <div>
        <input
          className={cn('row-price', manualActive && 'manual')}
          type="number"
          min="0"
          aria-label={label}
          value={manualValue ?? ''}
          placeholder={quote ? fmt(quote.price) : 'No se registra precio'}
          onChange={event => onChange(event.target.value)}
        />
        <small className={cn('age', quote ? ageFromDate(quote.date).tone : 'none')}>
          {manualActive ? 'precio manual' : priceText(quote)}
        </small>
        {manualActive && (
          <button type="button" className="btn ghost" onClick={onClear}>
            Usar precio AODP
          </button>
        )}
      </div>
    </div>
  );
}

export default function TransmutationView() {
  const { shared, prefs } = useApp();
  const candidates = React.useMemo(
    () => buildTransmutationCandidates(catalog.entries.filter(entry => entry.refine)),
    [],
  );
  const [city, setCity] = React.useState(prefs.buyCity || 'Martlock');
  const [type, setType] = React.useState('all');
  const [buyMode, setBuyMode] = React.useState('instant');
  const [sellMode, setSellMode] = React.useState('order');
  const [quantity, setQuantity] = React.useState(1);
  const [stationFee, setStationFee] = React.useState(0);
  const [manualPrices, setManualPrices] = React.useState({});
  const [marketPrices, setMarketPrices] = React.useState(new Map());
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const requestId = React.useRef(0);

  const priceIds = React.useMemo(
    () => [...new Set(candidates.flatMap(candidate => [candidate.source.id, candidate.target.id]))],
    [candidates],
  );

  async function loadPrices() {
    const currentRequest = ++requestId.current;
    setMarketPrices(new Map());
    setBusy(true);
    setStatus('Consultando precios de transmutación…');
    try {
      const rows = [];
      const chunks = api.chunkPriceIds({
        server: shared.server,
        quality: RESOURCE_QUALITY,
        cities: [city],
        ids: priceIds,
      });
      for (let index = 0; index < chunks.length; index += 1) {
        const batch = await api.fetchPrices({
          server: shared.server,
          quality: RESOURCE_QUALITY,
          cities: [city],
          ids: chunks[index],
        });
        rows.push(...batch);
        if (index < chunks.length - 1) await wait(120);
        if (currentRequest !== requestId.current) return;
      }
      if (currentRequest !== requestId.current) return;
      const map = api.indexRows(rows);
      setMarketPrices(map);
      const coverage = api.quoteCoverage(map, priceIds, [city], RESOURCE_QUALITY);
      setStatus(
        `✔ Precios actualizados · ${rows.length} registros recibidos · ${coverage.quoted}/${coverage.requested} cotizaciones AODP · ${coverage.missing} ausentes. Los valores ausentes se pueden cargar manualmente. ${api.cacheNotice(rows)}`,
      );
    } catch (error) {
      if (currentRequest === requestId.current) setStatus(`✖ ${error.message}`);
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    void loadPrices();
    return () => {
      requestId.current += 1;
    };
  }, [city, shared.server]); // eslint-disable-line react-hooks/exhaustive-deps

  const quoteFor = (id, mode) => api.priceAt(marketPrices, id, city, RESOURCE_QUALITY, mode);
  const manualKey = (id, mode) => [shared.server, city, RESOURCE_QUALITY, id, mode].join('|');
  const effectivePrice = (id, mode, quote) => {
    const key = manualKey(id, mode);
    const manual = Number(manualPrices[key]);
    return manual > 0 ? manual : quote?.price || null;
  };
  const setManualPrice = (id, mode, value) => {
    const key = manualKey(id, mode);
    setManualPrices(current => ({ ...current, [key]: value }));
  };
  const hasManualPrice = key => Object.prototype.hasOwnProperty.call(manualPrices, key);
  const clearManualPrice = key =>
    setManualPrices(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });

  const ranked = candidates
    .filter(candidate => type === 'all' || candidate.type === type)
    .map(candidate => {
      const inputMode = buyMode === 'instant' ? 'sell' : 'buy';
      const outputMode = sellMode === 'order' ? 'sell' : 'buy';
      const inputQuote = quoteFor(candidate.source.id, inputMode);
      const outputQuote = quoteFor(candidate.target.id, outputMode);
      const inputPrice = effectivePrice(candidate.source.id, inputMode, inputQuote);
      const outputPrice = effectivePrice(candidate.target.id, outputMode, outputQuote);
      const result = calculateTransmutation({
        quantity,
        inputPrice,
        outputPrice,
        transmutationFee: candidate.fee,
        stationFee,
        buyMode,
        sellMode,
        premium: shared.premium,
      });
      return { ...candidate, inputQuote, outputQuote, inputPrice, outputPrice, result };
    })
    .sort((a, b) => {
      if (a.result && b.result)
        return b.result.profitPerUnit - a.result.profitPerUnit || b.result.roi - a.result.roi;
      if (a.result) return -1;
      if (b.result) return 1;
      return 0;
    });
  const profitable = ranked.filter(row => row.result?.profit > 0).length;
  const priced = ranked.filter(row => row.result).length;

  const columns = [
    {
      label: 'Transmutación',
      render: row => (
        <div className="transmute-item">
          <img src={catalog.icon(row.source.id)} alt="" />
          <div>
            <strong>
              {RESOURCE_TYPES[row.type].label} · T{row.source.tier}.{row.source.level} → T{row.target.tier}.
              {row.target.level}
            </strong>
            <small>{row.kind === 'tier' ? 'Subir tier' : 'Subir encantamiento'}</small>
            <small>
              {row.source.id} → {row.target.id}
            </small>
          </div>
        </div>
      ),
    },
    { label: 'Tasa', align: 'right', render: row => `${fmt(row.fee)} p` },
    {
      label: 'Comprar',
      render: row => {
        const mode = buyMode === 'instant' ? 'sell' : 'buy';
        const key = manualKey(row.source.id, mode);
        return (
          <MarketPrice
            id={row.source.id}
            label={`Precio de compra ${row.source.es}`}
            quote={row.inputQuote}
            manualValue={manualPrices[key]}
            manualActive={hasManualPrice(key)}
            onChange={value => setManualPrice(row.source.id, mode, value)}
            onClear={() => clearManualPrice(key)}
          />
        );
      },
    },
    {
      label: 'Vender',
      render: row => {
        const mode = sellMode === 'order' ? 'sell' : 'buy';
        const key = manualKey(row.target.id, mode);
        return (
          <MarketPrice
            id={row.target.id}
            label={`Precio de venta ${row.target.es}`}
            quote={row.outputQuote}
            manualValue={manualPrices[key]}
            manualActive={hasManualPrice(key)}
            onChange={value => setManualPrice(row.target.id, mode, value)}
            onClear={() => clearManualPrice(key)}
          />
        );
      },
    },
    {
      label: 'Ganancia / u',
      align: 'right',
      render: row =>
        row.result ? (
          <strong
            className={
              row.result.profitPerUnit > 0 ? 'positive' : row.result.profitPerUnit < 0 ? 'negative' : ''
            }
          >
            {fmt(row.result.profitPerUnit)} p
          </strong>
        ) : (
          <span className="hint">Precios pendientes</span>
        ),
    },
    {
      label: 'Ganancia lote',
      align: 'right',
      render: row =>
        row.result ? (
          <span className={row.result.profit > 0 ? 'positive' : row.result.profit < 0 ? 'negative' : ''}>
            {fmt(row.result.profit)} p
          </span>
        ) : (
          '—'
        ),
    },
    { label: 'ROI', align: 'right', render: row => (row.result ? `${fmt2(row.result.roi)} %` : '—') },
  ];

  return (
    <div className="transmutation-view">
      <section className="card">
        <div className="card-head">
          <h2>Oportunidades de transmutación</h2>
          <span className="card-tag">
            {priced}/{ranked.length} con precios completos · {profitable} rentables
          </span>
        </div>
        <p className="hint">
          Se compara cada recurso con su siguiente tier o encantamiento. La tabla ordena por ganancia neta por
          unidad y usa únicamente cotizaciones del servidor y ciudad seleccionados.
        </p>
        <div className="transmute-controls">
          <Select
            id="transmute-city"
            label="Mercado"
            options={CITY_OPTIONS}
            value={city}
            onChange={setCity}
          />
          <Select
            id="transmute-type"
            label="Tipo de recurso"
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <Select
            id="transmute-buy-mode"
            label="Compra del recurso origen"
            options={[
              { value: 'instant', label: 'Compra inmediata · sell_price_min' },
              { value: 'order', label: 'Orden de compra · buy_price_max' },
            ]}
            value={buyMode}
            onChange={setBuyMode}
          />
          <Select
            id="transmute-sell-mode"
            label="Venta del recurso destino"
            options={[
              { value: 'order', label: 'Orden de venta · sell_price_min' },
              { value: 'instant', label: 'Venta inmediata · buy_price_max' },
            ]}
            value={sellMode}
            onChange={setSellMode}
          />
          <NumberField
            id="transmute-quantity"
            label="Unidades del lote"
            value={quantity}
            min={1}
            onChange={setQuantity}
          />
          <NumberField
            id="transmute-station-fee"
            label="Impuesto estación (plata)"
            value={stationFee}
            min={0}
            onChange={setStationFee}
          />
        </div>
        <div className="tax-box transmute-tax">
          <div>
            <span>Tasa de transmutación</span>
            <b>Fija en plata por unidad</b>
          </div>
          <div>
            <span>Impuesto de venta ({shared.premium ? 'Premium' : 'sin Premium'})</span>
            <b>{shared.premium ? '4 %' : '8 %'}</b>
          </div>
          <div>
            <span>Orden de venta / compra</span>
            <b>2,5 % cuando aplica</b>
          </div>
          <div>
            <span>Impuesto estación</span>
            <b>Editable · no incluido por defecto</b>
          </div>
        </div>
        <button
          type="button"
          className="btn primary"
          id="transmute-refresh"
          disabled={busy}
          onClick={() => void loadPrices()}
        >
          {busy ? 'Consultando…' : '↻ Actualizar precios'}
        </button>
        <p
          className={cn('status', /^✔/.test(status) && 'ok', /^✖/.test(status) && 'err')}
          id="transmute-status"
          aria-live="polite"
        >
          {status}
        </p>
      </section>

      <section className="card">
        <DataTable
          columns={columns}
          rows={ranked}
          className="transmute-table"
          empty="No hay transmutaciones disponibles para este recurso."
        />
        <p className="hint transmute-note">
          Las cotizaciones ausentes aparecen como «No se registra precio» y pueden completarse manualmente. El
          cálculo descuenta tasa de transmutación, impuesto de venta y tarifas de órdenes; no incluye
          transporte. Tarifas del juego:{' '}
          <a href="https://wiki.albiononline.com/wiki/Transmuting" target="_blank" rel="noreferrer">
            Albion Online Wiki · Transmuting
          </a>
          . Flujo y requisitos:{' '}
          <a href="https://albiononline.com/news/guide-refining" target="_blank" rel="noreferrer">
            guía oficial de Refinamiento
          </a>
          .
        </p>
      </section>
    </div>
  );
}
