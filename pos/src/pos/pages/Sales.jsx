import { useCallback, useState } from 'react';
import { Receipt as ReceiptIcon, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, EmptyState, fmtRelative, Spinner, useAsync } from '@/shared/ui/ui';
import { Modal } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { posApi } from '@/pos/services/posApi';
import { useTill } from '@/pos/state/TillProvider';
import { Receipt } from '@/pos/components/Receipt';
import { useLiveEvents } from '@/admin/services/live';

const TONE = { completed: 'green', refunded: 'amber', partially_refunded: 'amber', voided: 'red', open: 'blue', held: 'gray', discarded: 'gray' };

/** Recent sales on this till, reprint or e-mail a receipt. */
const Sales = () => {
  const { currency } = useTill();
  const { data, loading, error, reload } = useAsync(() => posApi.sale.recent(50), []);
  const [ref, setRef] = useState('');
  const [sale, setSale] = useState(null);
  useLiveEvents(useCallback(() => reload(), [reload]), ['sale.completed', 'sale.refunded', 'sale.voided']);

  const open = async (id, reference) => {
    try { setSale(reference ? await posApi.sale.byReference(reference) : await posApi.sale.get(id)); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-3 sm:p-5">
      <form onSubmit={(e) => { e.preventDefault(); if (ref.trim()) open(null, ref.trim().toUpperCase()); }} className="relative mb-4 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" />
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Find a receipt by number (R-100001) or scan it" className="input h-11 pl-9 font-mono" />
      </form>
      <div className="card min-h-0 grow overflow-y-auto">
        {loading ? <Spinner /> : error ? <p className="p-4 text-sm text-red-600">{errorMessage(error)}</p>
          : !data?.length ? <EmptyState icon={<ReceiptIcon className="h-6 w-6" />} title="No sales yet" text="Completed sales from this till appear here." />
          : (
            <ul className="divide-y divide-ink-700">
              {data.map((s) => (
                <li key={s.Id}>
                  <button type="button" onClick={() => open(s.Id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-900">
                    <div className="min-w-0 grow">
                      <p className="font-mono text-sm font-medium text-mist">{s.Reference}</p>
                      <p className="text-xs text-mist-dim">{fmtRelative(s.CompletedAt || s.CreatedAt)} · {s.ItemCount} item{s.ItemCount === 1 ? '' : 's'} · {String(s.Methods || "").replace(",", " + ")}{s.CustomerName ? ` · ${s.CustomerName}` : ''}</p>
                    </div>
                    <Badge tone={TONE[s.Status] ?? 'gray'}>{String(s.Status).replace('_', ' ')}</Badge>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-mist">{fmtCents(s.TotalCents, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
      <Modal open={!!sale} onClose={() => setSale(null)} title={sale?.Reference} description={sale ? String(sale.Status).replace('_', ' ') : ''} size="sm">
        <Receipt sale={sale} />
      </Modal>
    </div>
  );
};

export { Sales };
