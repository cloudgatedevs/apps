import { useState } from 'react';
import { toast } from 'sonner';
import { Monitor } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal, ConfirmButton } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';

/** Registers are the physical tills; a teller opens a shift on one. */
const Registers = () => {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.registers.list(), []);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = (r) => setEditing(r ? { id: r.Id, name: r.Name, location: r.Location ?? '', isActive: r.IsActive !== 0 } : { name: '', location: '', isActive: true });
  const set = (k) => (e) => setEditing((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const run = async (fn, ok) => { setBusy(true); try { setData(await fn()); setEditing(null); toast.success(ok); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } };
  const save = (e) => { e.preventDefault(); const p = { name: editing.name, location: editing.location, isActive: editing.isActive }; return editing.id ? run(() => adminApi.registers.update(editing.id, p), 'Register updated.') : run(() => adminApi.registers.create(p), 'Register added.'); };
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Registers" subtitle="One per till. Tellers pick a register when they open a shift."><button onClick={reload} className="btn-ghost">Refresh</button><button onClick={() => open(null)} className="btn-primary">New register</button></PageHead>
      <ErrorNote error={error} />
      {loading && !data ? <SkeletonTable columns={4} rows={3} /> : (
        <Table rows={data ?? []} empty={<EmptyState icon={<Monitor className="h-5 w-5" />} title="No registers" text="Add a register for each till in the store." action={<button type="button" onClick={() => open(null)} className="btn-primary">New register</button>} />}
          columns={[
            { key: 'Name', label: 'Register', mobile: 'title', render: (r) => <button type="button" onClick={() => open(r)} className="font-medium text-mist hover:text-accent">{r.Name}</button> },
            { key: 'Location', label: 'Location', mobile: 'meta', render: (r) => <span className="text-mist-muted">{r.Location || '—'}</span> },
            { key: 'OpenShiftId', label: 'In use', render: (r) => (r.OpenShiftId ? <Badge tone="green" dot>{r.OpenShiftTeller}</Badge> : <span className="text-xs text-mist-dim">free</span>) },
            { key: 'IsActive', label: 'Status', render: (r) => <Badge tone={r.IsActive ? 'blue' : 'gray'}>{r.IsActive ? 'active' : 'retired'}</Badge> },
            { key: 'actions', label: '', mobile: 'actions', render: (r) => <button type="button" onClick={() => open(r)} className="btn-ghost btn-sm">Edit</button> },
          ]} />
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit register' : 'New register'} size="sm"
        footer={<>{editing?.id ? <ConfirmButton onConfirm={() => run(() => adminApi.registers.remove(editing.id), 'Register removed.')} confirmLabel="Remove?" disabled={busy}>Remove</ConfirmButton> : null}<span className="grow" /><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="submit" form="register-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
        {editing ? (
          <form id="register-form" onSubmit={save} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="r-name"><input id="r-name" value={editing.name} onChange={set('name')} className="input" required autoFocus placeholder="Till 1" /></Field>
            <Field label="Location" htmlFor="r-loc"><input id="r-loc" value={editing.location} onChange={set('location')} className="input" placeholder="Front counter" /></Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={editing.isActive} onChange={set('isActive')} className="accent-accent" /> Available to tellers</label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export { Registers };
