const QtyStepper = ({ value, min = 1, max = Infinity, onChange, size = 'sm' }) => {
  const h = size === 'lg' ? 'h-11' : 'h-9';
  const clamp = (n) => Math.max(min === 0 ? 0 : 1, Math.min(Number.isFinite(max) ? max : Infinity, n));
  return (
    <div className={`inline-flex ${h} items-center rounded-xl border border-ink-600 bg-ink-850`}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} aria-label="Decrease" className="grid h-full w-9 place-items-center text-mist-muted hover:text-mist disabled:opacity-30" disabled={value <= (min === 0 ? 0 : 1)}>−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="h-full w-10 border-x border-ink-700 text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} aria-label="Increase" className="grid h-full w-9 place-items-center text-mist-muted hover:text-mist disabled:opacity-30" disabled={value >= max}>+</button>
    </div>
  );
};

export { QtyStepper };
