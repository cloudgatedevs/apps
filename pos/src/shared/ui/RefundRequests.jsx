import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { refundApi, refundMessage } from '@/shared/services/refunds';
import { errorMessage } from '@/shared/lib/errors';
import { fmtCents } from '@/shared/lib/money';

export function RefundRequests({ id, onResolved }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => refundApi.list(id).then((r) => { if (active) { setItems(r); setError(''); } }).catch((e) => { if (active) setError(errorMessage(e)); });
    load();
    window.addEventListener('refunds-changed', load);
    return () => { active = false; window.removeEventListener('refunds-changed', load); };
  }, [id]);
  const recover = async (row, retry) => {
    setBusy(true);
    try {
      const result = retry === 'discard' ? await refundApi.discardUnsent(id) : await refundApi.recover(id, row, retry);
      toast[ result.request?.Status === 'succeeded' ? 'success' : 'info' ](refundMessage(result.request));
      if (['succeeded', 'failed'].includes(result.request?.Status)) {
        await onResolved?.();
        refundApi.acknowledge(id, result.request.RequestKey);
      }
      setItems(await refundApi.list(id));
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  if (!items.length && !error) return null;
  return <section className="card p-4" aria-label="Refund requests">
    <h3 className="mb-2 font-semibold">Refund requests</h3>
    {error ? <p role="alert" className="mb-2 text-sm text-red-600">{error}</p> : null}
    <ul className="divide-y divide-ink-700">{items.map((r) => <li key={r.RequestKey} className="py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><strong>{r.AmountCents ? fmtCents(r.AmountCents, r.Currency) : 'Refund'}</strong><span>{r.Method} · {r.Status.replaceAll('_', ' ')}</span></div>
      {r.ProviderRefundId ? <p className="break-all font-mono text-xs text-mist-dim">{r.ProviderRefundId}</p> : null}
      {!['succeeded', 'failed'].includes(r.Status) || r.requiresRefresh ? <>
        <p className="my-2 text-mist-muted">{r.requiresRefresh ? 'Refresh the order or sale to finish this request before starting another refund.' : 'Confirmation is outstanding. Totals and stock will update when the refund succeeds.'}</p>
        <div className="flex flex-wrap gap-2">
          {!r.localOnly ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => recover(r, false)}>{r.requiresRefresh ? 'Finish refresh' : 'Check status'}</button> : null}
          {!r.requiresRefresh ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => recover(r, true)}>Retry same request</button> : null}
          {r.localOnly ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => recover(r, 'discard')}>Discard unsent request</button> : null}
        </div>
      </> : null}
    </li>)}</ul>
  </section>;
}
