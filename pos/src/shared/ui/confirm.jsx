import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './forms';

/**
 * In-app confirmation instead of window.confirm / window.prompt.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Close shift?', text: '…', confirmLabel: 'Close shift', tone: 'danger' }))) return;
 *
 * With `input` the dialog asks for a short text and resolves with the string (or null when
 * cancelled):
 *   const reason = await confirm({ title: 'Void sale', input: { label: 'Reason', required: true } });
 */
const ConfirmContext = createContext(null);

const EMPTY = { open: false, title: '', text: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', tone: 'primary', input: null, resolve: null };

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(EMPTY);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setValue(opts?.input?.initial ?? '');
    setState({ ...EMPTY, ...opts, open: true, resolve });
  }), []);

  const finish = (result) => {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };
  const cancel = () => finish(state.input ? null : false);
  const accept = () => finish(state.input ? value.trim() : true);

  useEffect(() => {
    if (state.open && state.input) setTimeout(() => inputRef.current?.focus(), 50);
  }, [state.open, state.input]);

  const disabled = Boolean(state.input?.required) && !value.trim();
  const ctx = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={ctx}>
      {children}
      <Modal
        open={state.open}
        onClose={cancel}
        title={state.title}
        description={state.description}
        size="sm"
        footer={(
          <>
            <button type="button" onClick={cancel} className="btn-ghost">{state.cancelLabel}</button>
            <button type="button" onClick={accept} disabled={disabled} className={state.tone === 'danger' ? 'btn-danger' : 'btn-primary'} autoFocus={!state.input}>{state.confirmLabel}</button>
          </>
        )}
      >
        {state.text ? <p className="text-sm text-mist-muted">{state.text}</p> : null}
        {state.input ? (
          <form className={state.text ? 'mt-3' : ''} onSubmit={(e) => { e.preventDefault(); if (!disabled) accept(); }}>
            {state.input.label ? <label htmlFor="cg-confirm-input" className="mb-1 block text-xs font-medium uppercase tracking-wide text-mist-dim">{state.input.label}</label> : null}
            <input id="cg-confirm-input" ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={state.input.placeholder} maxLength={state.input.maxLength ?? 200} className="input" />
          </form>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs a <ConfirmProvider> above it.');
  return confirm;
};
