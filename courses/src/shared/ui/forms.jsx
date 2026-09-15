// Form and dialog primitives shared by both apps. Styling comes from the component classes each
// app defines (.input, .label, .btn-*, .card); animation classes live in motion.css.
//
// Modal is built on Radix Dialog: focus trap, Escape, scroll lock, aria wiring and, through
// data-state, a real enter *and* exit animation (a dialog on a phone becomes a bottom sheet).
// `variant` switches the same primitive into a side drawer.
import { useReducer, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Field = ({ label, hint, error, htmlFor, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label ? (
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
    ) : null}
    {children}
    {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs opacity-60">{hint}</p> : null}
  </div>
);

export const Notice = ({ tone = 'info', children, className = '' }) => {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
  };
  if (!children) return null;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`ui-page rounded-lg border px-4 py-2.5 text-sm ${tones[tone] ?? tones.info} ${className}`}>{children}</div>;
};

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * <Modal open title onClose size="sm|md|lg|xl" footer variant="dialog|drawer-right|drawer-left" />
 * Pass `onClose={undefined}` to make it non-dismissable while busy.
 */
export const Modal = ({ open, title, description, onClose, children, footer, size = 'md', variant = 'dialog', hideHeader = false, className = '' }) => {
  const drawer = variant.startsWith('drawer');
  const side = variant === 'drawer-left' ? 'left' : 'right';
  const panelClass = drawer
    ? `ui-drawer-${side} fixed inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} z-50 flex h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl outline-none`
    : `ui-dialog ui-dialog-sheet card fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none shadow-pop outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-b-xl ${WIDTHS[size] ?? WIDTHS.md}`;

  return (
    <Dialog.Root open={!!open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={`${panelClass} ${className}`}
          onEscapeKeyDown={(e) => { if (!onClose) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (!onClose) e.preventDefault(); }}
          onInteractOutside={(e) => { if (!onClose || e.target?.closest?.('[data-sonner-toaster]')) e.preventDefault(); }}
        >
          {hideHeader ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-current/10 px-5 py-3">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-[15px] font-semibold">{title}</Dialog.Title>
                {description ? <Dialog.Description className="mt-0.5 text-xs opacity-60">{description}</Dialog.Description> : null}
              </div>
              {onClose ? (
                <Dialog.Close asChild>
                  <button type="button" aria-label="Close" className="btn-ghost btn-sm"><X className="h-4 w-4" aria-hidden="true" /></button>
                </Dialog.Close>
              ) : null}
            </div>
          )}
          {!description && !hideHeader ? <Dialog.Description className="sr-only">{title}</Dialog.Description> : null}
          <div className="min-h-0 grow overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-current/10 px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

/** Button that asks for confirmation on first click ("Delete" -> "Confirm delete?"). */
export const ConfirmButton = ({ onConfirm, children, confirmLabel = 'Confirm?', className = 'btn-danger', disabled }) => {
  const armedRef = useRef(false);
  const timerRef = useRef(null);
  const [, force] = useReducer((x) => x + 1, 0);
  const click = () => {
    if (armedRef.current) {
      clearTimeout(timerRef.current);
      armedRef.current = false;
      force();
      onConfirm?.();
      return;
    }
    armedRef.current = true;
    force();
    timerRef.current = setTimeout(() => {
      armedRef.current = false;
      force();
    }, 3000);
  };
  return (
    <button type="button" onClick={click} disabled={disabled} className={className}>
      {armedRef.current ? confirmLabel : children}
    </button>
  );
};
