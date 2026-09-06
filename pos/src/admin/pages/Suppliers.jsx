import { useState } from 'react';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal, ConfirmButton } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';

const Suppliers = () => {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.suppliers.list(), []);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = (s) => setEditing(s ? { id: s.Id, name: s.Name, contactName: s.ContactName ?? '', email: s.Email ?? '', phone: s.Phone ?? '', notes: s.Notes ?? '', isActive: s.IsActive !== 0 } : { name: '', contactName: '', email: '', phone: '', notes: '', isActive: true });
  const set = (k) => (e) => setEditing((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const run = async (fn, ok) => { setBusy(true); try { setData(await fn()); setEditing(null); toast.success(ok); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } };
  const save = (e) => { e.preventDefault(); const { id, ...p } = editing; return id ? run(() => adminApi.suppliers.update(id, p), 'Supplier updated.') : run(() => adminApi.suppliers.create(p), 'Supplier added.'); };
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Suppliers" subtitle="Who you buy from. Deliveries are booked in against a supplier."><button onClick={reload} className="btn-ghost">Refresh</button><button onClick={() => open(null)} className="btn-primary">New supplier</button></PageHead>
      <ErrorNote error={error} />
      {loading && !data ? <SkeletonTable columns={5} rows={4} /> : (
        <Table rows={data ?? []} empty={<EmptyState icon={<Truck className="h-5 w-5" />} title="No suppliers" text="Optional, but handy for goods-received notes and reordering." action={<button type="button" onClick={() => open(null)} className="btn-primary">New supplier</button>} />}
          columns={[
            { key: 'Name', label: 'Supplier', mobile: 'title', render: (s) => <button type="button" onClick={() => open(s)} className="font-medium text-mist hover:text-accent">{s.Name}</button> },
            { key: 'ContactName', label: 'Contact', mobile: 'meta', render: (s) => <span className="text-mist-muted">{[s.ContactName, s.Phone].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'Email', label: 'E-mail', mobile: 'hide', render: (s) => <span className="text-mist-muted">{s.Email || '—'}</span> },
            { key: 'ProductCount', label: 'Products', align: 'right' },
            { key: 'ReceiptCount', label: 'Deliveries', align: 'right' },
            { key: 'IsActive', label: 'Status', render: (s) => <Badge tone={s.IsActive ? 'green' : 'gray'} dot>{s.IsActive ? 'active' : 'inactive'}</Badge> },
            { key: 'actions', label: '', mobile: 'actions', render: (s) => <button type="button" onClick={() => open(s)} className="btn-ghost btn-sm">Edit</button> },
          ]} />
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit supplier' : 'New supplier'} size="sm"
        footer={<>{editing?.id ? <ConfirmButton onConfirm={() => run(() => adminApi.suppliers.remove(editing.id), 'Supplier deleted.')} confirmLabel="Delete?" disabled={busy}>Delete</ConfirmButton> : null}<span className="grow" /><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="submit" form="supplier-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
        {editing ? (
          <form id="supplier-form" onSubmit={save} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="s-name"><input id="s-name" value={editing.name} onChange={set('name')} className="input" required autoFocus /></Field>
            <Field label="Contact person" htmlFor="s-contact"><input id="s-contact" value={editing.contactName} onChange={set('contactName')} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="E-mail" htmlFor="s-email"><input id="s-email" type="email" value={editing.email} onChange={set('email')} className="input" /></Field><Field label="Phone" htmlFor="s-phone"><input id="s-phone" value={editing.phone} onChange={set('phone')} className="input" /></Field></div>
            <Field label="Notes" htmlFor="s-notes"><textarea id="s-notes" value={editing.notes} onChange={set('notes')} className="textarea" rows={2} /></Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={editing.isActive} onChange={set('isActive')} className="accent-accent" /> Active</label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export { Suppliers };
