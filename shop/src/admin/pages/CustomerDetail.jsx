import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, StatCard, EmptyState, fmtDate, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonStats, SkeletonTable, Skeleton, SkeletonText } from '@/shared/ui/skeleton';
import { fmtCents } from '@/shared/lib/money';
import { orderStatusTone, paymentStatusTone } from '@/admin/pages/Orders';
import { customerName } from '@/admin/pages/Customers';

const Address = ({ a }) => {
  if (!a || typeof a !== 'object') return <span className="text-mist-dim">—</span>;
  const lines = [a.line1, a.line2, [a.city, a.region].filter(Boolean).join(', '), [a.postalCode, a.country].filter(Boolean).join(' ')].filter(Boolean);
  return <span className="whitespace-pre-line text-mist-muted">{lines.join('\n') || '—'}</span>;
};

const CustomerDetail = () => {
  const { id } = useParams();
  const { data: c, loading, error } = useAsync(() => adminApi.customers.get(Number(id)), [id]);
  if (loading && !c) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2"><Skeleton className="h-6 w-48 rounded" /><Skeleton className="h-3.5 w-64 rounded" /></div>
        <SkeletonStats count={3} className="sm:grid-cols-3 lg:grid-cols-3" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SkeletonTable columns={6} rows={4} />
          <div className="flex flex-col gap-6">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="card flex flex-col gap-3 p-4"><Skeleton className="h-4 w-24 rounded" /><SkeletonText lines={2} widths={[70, 45]} /></div>)}</div>
        </div>
      </div>
    );
  }
  if (error && !c) return <ErrorNote error={error} />;
  if (!c) return null;
  const currency = c.Currency || 'ZAR';
  const orders = c.Orders ?? [];
  const open = orders.filter((o) => ['paid', 'processing'].includes(String(o.Status).toLowerCase())).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={customerName(c)} subtitle={<span className="inline-flex flex-wrap items-center gap-2">Customer since {fmtDate(c.CreatedAt)} {c.IdpUserId ? <Badge tone="blue">account #{c.IdpUserId}</Badge> : <Badge tone="gray">guest</Badge>}{c.MarketingOptIn ? <Badge tone="green">marketing opt-in</Badge> : null}</span>}>
        <Link to="/customers" className="btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back</span></Link>
        <a href={`mailto:${c.Email}`} className="btn-ghost">Email</a>
      </PageHead>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Paid orders" value={c.OrderCount ?? 0} sub={open ? `${open} awaiting fulfilment` : 'nothing outstanding'} />
        <StatCard label="Lifetime value" value={fmtCents(c.SpentCents ?? 0, currency)} sub="paid orders, incl. refunded" />
        <StatCard label="Last order" value={c.LastOrderAt ? fmtDateShort(c.LastOrderAt) : '—'} sub={orders[0]?.Reference ? `latest ${orders[0].Reference}` : 'no orders yet'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-mist">Orders</h2>
          <Table
            rowHref={(r) => `/orders/${r.Id}`}
            columns={[
              { key: 'Reference', label: 'Order', mobile: 'title', render: (r) => <Link to={`/orders/${r.Id}`} className="whitespace-nowrap font-mono text-[13px] font-medium text-mist hover:text-accent">{r.Reference}</Link> },
              { key: 'Items', label: 'Items', mobile: 'hide', align: 'right', render: (r) => <span className="tabular-nums">{r.Items}</span> },
              { key: 'TotalCents', label: 'Total', align: 'right', render: (r) => <span className="font-semibold tabular-nums text-mist">{fmtCents(r.TotalCents, r.Currency)}</span> },
              { key: 'PaymentStatus', label: 'Payment', render: (r) => <Badge tone={paymentStatusTone(r.PaymentStatus)}>{r.PaymentStatus}</Badge> },
              { key: 'Status', label: 'Status', render: (r) => <Badge tone={orderStatusTone(r.Status)} dot>{r.Status}</Badge> },
              { key: 'CreatedAt', label: 'Placed', mobile: 'meta', render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.CreatedAt)}</span> },
            ]}
            rows={orders}
            empty={<EmptyState compact title="No orders for this customer yet" />}
          />
        </section>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-mist">Contact</h2>
            <p className="break-all text-mist">{c.Email}</p>
            {c.Phone ? <p className="text-mist-muted">{c.Phone}</p> : <p className="text-mist-dim">No phone number</p>}
          </section>
          <section className="card flex flex-col gap-3 p-4 text-sm">
            <h2 className="text-sm font-semibold text-mist">Default address</h2>
            <Address a={c.DefaultAddress} />
          </section>
        </div>
      </div>
    </div>
  );
};

export { CustomerDetail };
