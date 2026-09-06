import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Where the customer's phone lands after the hosted card payment. Public (no sign-in): the till
 * itself learns the outcome by polling the wallet, so this page only needs to say what happened.
 */
const PayDone = ({ kind }) => {
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const ok = kind === 'done';
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 p-6">
      <div className="card w-full max-w-sm p-8 text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {ok ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-mist">{ok ? 'Payment received' : 'Payment cancelled'}</h1>
        <p className="mt-2 text-sm text-mist-muted">
          {ok
            ? 'Thank you. The cashier will hand you your receipt.'
            : 'No payment was taken. Let the cashier know how you would like to pay.'}
        </p>
        {ref ? <p className="mt-4 font-mono text-xs text-mist-dim">Receipt {ref}</p> : null}
        <p className="mt-6 text-xs text-mist-dim">You can close this page.</p>
      </div>
    </div>
  );
};

export { PayDone };
