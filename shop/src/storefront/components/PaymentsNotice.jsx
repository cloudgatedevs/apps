import { useEffect, useState } from 'react';
import { shopApi } from '@/storefront/services/shopApi';

let pending; // one request per page load, shared by every notice on the page
let cached;

/** Resolves the store's payment readiness once per page load. Null while unknown or when the check fails. */
export const usePaymentsReady = () => {
  const [state, setState] = useState(cached ?? null);
  useEffect(() => {
    if (cached !== undefined) return undefined;
    pending ??= shopApi.paymentsStatus().then((r) => { cached = r; return r; });
    let live = true;
    pending.then((r) => { if (live) setState(r); });
    return () => { live = false; };
  }, []);
  return state;
};

/** Amber notice shown wherever a customer is about to pay, when the wallet is not active. */
const PaymentsNotice = ({ className = '' }) => {
  const status = usePaymentsReady();
  if (!status || status.ready !== false) return null;
  return (
    <div role="status" className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      <p className="font-semibold">This store is not accepting payments yet.</p>
      <p className="mt-0.5 text-amber-800">You can still fill your cart; checkout opens as soon as card payments are switched on. Sorry for the wait.</p>
    </div>
  );
};

export { PaymentsNotice };
