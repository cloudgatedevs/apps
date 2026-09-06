import { Link } from 'react-router-dom';
import { ExternalLink, UserRound } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState, fmtRelative } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Notice } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';

const HUB_URL = String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim().replace(/\/$/, '');

/** Tellers are IdP users with the Teller role; this lists everyone who has worked a shift. */
const Tellers = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.tellers.list(), []);
  const settings = useAsync(() => adminApi.settings.get(), []);
  const currency = settings.data?.currency || 'ZAR';
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Tellers" subtitle="Staff who have signed in to the till. Accounts and roles are managed in the Cloudgate hub.">
        <button onClick={reload} className="btn-ghost">Refresh</button>
        {HUB_URL ? <a href={`${HUB_URL}/identity/users`} target="_blank" rel="noreferrer" className="btn-primary"><ExternalLink className="h-4 w-4" /> Manage users</a> : null}
      </PageHead>
      <Notice tone="info">To add a teller, create the user in the Cloudgate hub (Identity → Users) and give them the <b>Teller</b> role. Administrators use the back office only; they cannot ring up sales.</Notice>
      <ErrorNote error={error} />
      {loading ? <SkeletonTable columns={6} rows={4} /> : (
        <Table rows={data ?? []} rowKey={(t) => t.TellerUserId} empty={<EmptyState icon={<UserRound className="h-5 w-5" />} title="No tellers yet" text="A teller appears here after their first shift." />}
          columns={[
            { key: 'TellerName', label: 'Teller', mobile: 'title', render: (t) => <span><span className="block font-medium text-mist">{t.TellerName}</span><span className="block text-xs text-mist-dim">{t.TellerEmail}</span></span> },
            { key: 'LastShiftStatus', label: 'Now', render: (t) => (t.LastShiftStatus === 'open' ? <Badge tone="green" dot>on shift</Badge> : <span className="text-xs text-mist-dim">off</span>) },
            { key: 'LastShiftAt', label: 'Last shift', mobile: 'meta', render: (t) => <span className="text-mist-muted">{fmtRelative(t.LastShiftAt)}</span> },
            { key: 'ShiftCount', label: 'Shifts', align: 'right' },
            { key: 'SalesCount', label: 'Sales', align: 'right' },
            { key: 'SalesTotalCents', label: 'Takings', align: 'right', render: (t) => <span className="tabular-nums font-medium">{fmtCents(t.SalesTotalCents, currency)}</span> },
            { key: 'RefundsCents', label: 'Refunds', align: 'right', render: (t) => <span className="tabular-nums text-mist-muted">{fmtCents(t.RefundsCents, currency)}</span> },
            { key: 'actions', label: '', mobile: 'actions', render: (t) => <Link to={`/sales?teller=${t.TellerUserId}`} className="btn-ghost btn-sm">Sales</Link> },
          ]} />
      )}
    </div>
  );
};

export { Tellers };
