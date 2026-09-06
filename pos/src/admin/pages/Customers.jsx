import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, Pager, SearchBar, EmptyState, fmtDate } from '@/shared/ui/ui';
import { SkeletonTable, SkeletonDetail } from '@/shared/ui/skeleton';
import { Field, Modal, ConfirmButton } from '@/shared/ui/forms';
import { fmtCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { SALE_TONE } from '@/admin/pages/Dashboard';

const PAGE = 50;
const useCurrency = () => { const s = useAsync(() => adminApi.settings.get(), []); return s.data?.currency || 'ZAR'; };

const CustomerForm = ({ editing, setEditing, busy, onSave, onDelete }) => (
  <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit customer' : 'New customer'} size="sm"
    footer={<>{editing?.id && onDelete ? <ConfirmButton onConfirm={onDelete} confirmLabel="Delete?" disabled={busy}>Delete</ConfirmButton> : null}<span className="grow" /><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="submit" form="customer-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
    {editing ? (
      <form id="customer-form" onSubmit={onSave} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="c-name"><input id="c-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" required autoFocus /></Field>
        <Field label="E-mail" htmlFor="c-email"><input id="c-email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="input" /></Field>
        <Field label="Phone" htmlFor="c-phone"><input id="c-phone" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="input" /></Field>
        <Field label="Notes" htmlFor="c-notes"><textarea id="c-notes" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="textarea" rows={2} /></Field>
      </form>
    ) : null}
  </Modal>
);

const Customers = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 0);
  const search = params.get('q') || '';
  const [draft, setDraft] = useState(search);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const currency = useCurrency();
  const navigate = useNavigate();
  const setParam = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v)))); if (!('page' in patch)) next.delete('page'); setParams(next); };
  const { data, loading, error, reload } = useAsync(() => adminApi.customers.list({ search, skip: page * PAGE, take: PAGE }), [search, page]);
  const total = data?.total ?? 0;
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const c = await adminApi.customers.create({ name: editing.name, email: editing.email, phone: editing.phone, notes: editing.notes }); toast.success('Customer added.'); setEditing(null); navigate(`/customers/${c.Id}`); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Customers" subtitle="People tellers attach to a sale, for e-mailed receipts and purchase history."><button onClick={reload} className="btn-ghost">Refresh</button><button onClick={() => setEditing({ name: '', email: '', phone: '', notes: '' })} className="btn-primary">New customer</button></PageHead>
      <SearchBar value={draft} onChange={(e) => setDraft(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: draft.trim() }); }} onClear={() => { setDraft(''); setParam({ q: '' }); }} placeholder="Name, e-mail or phone…" />
      <ErrorNote error={error} />
      {loading && !data ? <SkeletonTable columns={5} rows={8} /> : (
        <Table rows={data?.items ?? []} rowHref={(c) => `/customers/${c.Id}`} empty={<EmptyState icon={<Users className="h-5 w-5" />} title="No customers yet" text="Customers are created here or when a teller adds a name to a sale." />}
          columns={[
            { key: 'Name', label: 'Customer', mobile: 'title', render: (c) => <Link to={`/customers/${c.Id}`} className="font-medium text-mist hover:text-accent">{c.Name}</Link> },
            { key: 'Email', label: 'E-mail', mobile: 'meta', render: (c) => <span className="text-mist-muted">{c.Email || '—'}</span> },
            { key: 'Phone', label: 'Phone', mobile: 'hide', render: (c) => <span className="text-mist-muted">{c.Phone || '—'}</span> },
            { key: 'SalesCount', label: 'Sales', align: 'right' },
            { key: 'SpentCents', label: 'Spent', align: 'right', render: (c) => <span className="tabular-nums font-medium">{fmtCents(c.SpentCents, currency)}</span> },
          ]} />
      )}
      {total > PAGE ? <Pager page={page} pages={Math.ceil(total / PAGE)} total={total} from={page * PAGE + 1} to={Math.min(total, (page + 1) * PAGE)} noun="customers" onPage={(p) => setParam({ page: p })} /> : null}
      <CustomerForm editing={editing} setEditing={setEditing} busy={busy} onSave={save} />
    </div>
  );
};

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useCurrency();
  const { data: c, loading, error, setData } = useAsync(() => adminApi.customers.get(Number(id)), [id]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <SkeletonDetail />;
  if (error) return <ErrorNote error={error} />;
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { setData(await adminApi.customers.update(c.Id, { name: editing.name, email: editing.email, phone: editing.phone, notes: editing.notes })); toast.success('Saved.'); setEditing(null); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => { try { await adminApi.customers.remove(c.Id); toast.success('Customer deleted.'); navigate('/customers'); } catch (err) { toast.error(errorMessage(err)); } };
  return (
    <div className="flex flex-col gap-5">
      <PageHead title={c.Name} subtitle={[c.Email, c.Phone].filter(Boolean).join(' · ') || 'No contact details'}><Link to="/customers" className="btn-ghost">Back</Link><button type="button" onClick={() => setEditing({ id: c.Id, name: c.Name, email: c.Email ?? '', phone: c.Phone ?? '', notes: c.Notes ?? '' })} className="btn-primary">Edit</button></PageHead>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-mist-dim">Sales</p><p className="text-xl font-semibold text-mist">{c.SalesCount}</p></div>
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-mist-dim">Spent</p><p className="text-xl font-semibold tabular-nums text-mist">{fmtCents(c.SpentCents, currency)}</p></div>
        <div className="card p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-mist-dim">Since</p><p className="text-xl font-semibold text-mist">{fmtDate(c.CreatedAt)}</p></div>
      </div>
      {c.Notes ? <section className="card p-4 text-sm text-mist-muted">{c.Notes}</section> : null}
      <section className="card overflow-hidden">
        <h2 className="px-4 py-3 text-[15px] font-semibold text-mist">Recent sales</h2>
        <Table rows={c.Sales ?? []} rowHref={(s) => `/sales/${s.Id}`} empty="No sales yet."
          columns={[
            { key: 'Reference', label: 'Receipt', mobile: 'title', render: (s) => <span className="font-mono text-mist">{s.Reference}</span> },
            { key: 'CompletedAt', label: 'When', mobile: 'meta', render: (s) => <span className="text-mist-muted">{fmtDate(s.CompletedAt)}</span> },
            { key: 'Status', label: 'Status', render: (s) => <Badge tone={SALE_TONE[s.Status] ?? 'gray'} dot>{String(s.Status).replace('_', ' ')}</Badge> },
            { key: 'TotalCents', label: 'Total', align: 'right', render: (s) => <span className="tabular-nums font-medium">{fmtCents(s.TotalCents, currency)}</span> },
          ]} />
      </section>
      <CustomerForm editing={editing} setEditing={setEditing} busy={busy} onSave={save} onDelete={remove} />
    </div>
  );
};

export { Customers, CustomerDetail };
