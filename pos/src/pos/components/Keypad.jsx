import { Delete } from 'lucide-react';

/**
 * Touch keypad that edits a decimal string. `onChange(nextString)`; `onEnter()` on the ✓ key.
 * Keeps a single decimal point and at most `decimals` places.
 */
const Keypad = ({ value = '', onChange, onEnter, decimals = 2, enterLabel = 'OK', className = '' }) => {
  const press = (k) => {
    let v = String(value ?? '');
    if (k === 'back') v = v.slice(0, -1);
    else if (k === 'clear') v = '';
    else if (k === '.') { if (decimals > 0 && !v.includes('.')) v = (v || '0') + '.'; }
    else {
      const [, frac] = v.split('.');
      if (frac !== undefined && frac.length >= decimals) return;
      v = v === '0' ? k : v + k;
      if (v.length > 12) return;
    }
    onChange?.(v);
  };
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`}>
      {keys.map((k) => <button key={k} type="button" className="pos-key" onClick={() => press(k)}>{k}</button>)}
      <button type="button" className="pos-key row-span-2 !h-auto text-mist-muted" onClick={() => press('back')} aria-label="Backspace"><Delete className="h-5 w-5" /></button>
      <button type="button" className="pos-key text-mist-muted" onClick={() => press('clear')}>C</button>
      <button type="button" className="pos-key" onClick={() => press('0')}>0</button>
      <button type="button" className="pos-key" onClick={() => press('.')} disabled={decimals === 0}>.</button>
      <button type="button" className="pos-key col-span-4 !h-12 pos-accent-bg border-transparent" onClick={onEnter}>{enterLabel}</button>
    </div>
  );
};

export { Keypad };
