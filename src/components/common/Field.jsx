import * as React from 'react';
import { cn } from '../../lib/utils.js';

export function Field({ label, children, hint, hidden, className }) {
  if (hidden) return null;
  return (
    <label className={cn('field', className)}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Select({ id, label, options, value, onChange, hint, hidden, className }) {
  return (
    <Field label={label} hint={hint} hidden={hidden} className={className}>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => {
          const val = typeof o === 'string' ? o : o.value;
          const text = typeof o === 'string' ? o : o.label;
          return <option key={String(val)} value={val}>{text}</option>;
        })}
      </select>
    </Field>
  );
}

export function NumberField({ id, label, value, onChange, min = 0, step = 1, hint, hidden, readOnly, className }) {
  return (
    <Field label={label} hint={hint} hidden={hidden} className={className}>
      <input id={id} type="number" value={value} min={min} step={step} readOnly={readOnly}
        onChange={e => onChange(e.target.value)} />
    </Field>
  );
}

export function Toggle({ id, label, checked, onChange, hint, hidden, disabled }) {
  if (hidden) return null;
  return (
    <label className="toggle">
      <input id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)} />
      <span className="switch" /><span>{label}</span>
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}
