import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Tags } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal, ConfirmButton } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';

const SWATCHES = ['#2563eb', '#16a34a', '#ea580c', '#db2777', '#7c3aed', '#0891b2', '#ca8a04', '#475569'];
const empty = { name: '', color: SWATCHES[0], isActive: true };

/** Categories group the till's product grid; each gets a colour for tiles without an image. */
const Categories = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.categories.list(), []);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const list = rows ?? data ?? [];

  const open = (c) => setEditing(c ? { id: c.Id, name: c.Name ?? '', color: c.Color ?? '', isActive: c.IsActive !== 0 } : { ...empty });
  const set = (k) => (e) => setEditing((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const run = async (fn, okText) => {
    setBusy(true);
    try { setRows(await fn()); setEditing(null); if (okText) toast.success(okText); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const save = (e) => {
    e.preventDefault();
    const payload = { name: editing.name, color: editing.color || null, isActive: editing.isActive };
    return editing.id ? run(() => adminApi.categories.update(editing.id, payload), 'Category updated.') : run(() => adminApi.categories.create(payload), 'Category created.');
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    const previous = list;
    setRows(next);
    adminApi.categories.reorder(next.map((c) => c.Id)).then(setRows).catch((err) => { setRows(previous); toast.error(errorMessage(err)); });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Categories" subtitle="The tabs on the till. Order here is the order tellers see.">
        <button onClick={() => { setRows(null); reload(); }} className="btn-ghost">Refresh</button>
        <button onClick={() => open(null)} className="btn-primary">New category</button>
      </PageHead>
      <ErrorNote error={error} />
      {loading && !rows ? <SkeletonTable columns={4} rows={5} /> : (
        <Table rows={list} empty={<EmptyState icon={<Tags className="h-5 w-5" />} title="No categories yet" text="Group products so tellers can find them without scanning." action={<button type="button" onClick={() => open(null)} className="btn-primary">New category</button>} />}
          columns={[
            { key: 'Name', label: 'Category', mobile: 'title', render: (c) => <span className="flex items-center gap-3"><span className="h-4 w-4 rounded-full border border-black/10" style={{ background: c.Color || '#e5e8ee' }} /><button type="button" onClick={() => open(c)} className="font-medium text-mist hover:text-accent">{c.Name}</button></span> },
            { key: 'ProductCount', label: 'Active products', align: 'right', render: (c) => <span className="tabular-nums">{c.ProductCount}</span> },
            { key: 'IsActive', label: 'Status', render: (c) => <Badge tone={c.IsActive ? 'green' : 'gray'} dot>{c.IsActive ? 'shown' : 'hidden'}</Badge> },
            { key: 'actions', label: '', mobile: 'actions', render: (c) => { const i = list.findIndex((x) => x.Id === c.Id); return <span className="flex items-center gap-1"><button type="button" onClick={() => move(i, -1)} className="btn-ghost btn-sm" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => move(i, 1)} className="btn-ghost btn-sm" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => open(c)} className="btn-ghost btn-sm">Edit</button></span>; } },
          ]} />
      )}
      <Modal open={!!editing} title={editing?.id ? 'Edit category' : 'New category'} onClose={() => setEditing(null)} size="sm"
        footer={<>{editing?.id ? <ConfirmButton onConfirm={() => run(() => adminApi.categories.remove(editing.id), 'Category deleted.')} confirmLabel="Delete for real?" disabled={busy}>Delete</ConfirmButton> : null}<span className="grow" /><button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button><button type="submit" form="category-form" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button></>}>
        {editing ? (
          <form id="category-form" onSubmit={save} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="c-name"><input id="c-name" value={editing.name} onChange={set('name')} className="input" required autoFocus /></Field>
            <Field label="Colour" hint="Tiles without an image use this colour on the till.">
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((s) => <button key={s} type="button" onClick={() => setEditing((f) => ({ ...f, color: s }))} className={`h-8 w-8 rounded-full border-2 ${editing.color === s ? 'border-mist' : 'border-transparent'}`} style={{ background: s }} aria-label={s} />)}
                <input value={editing.color} onChange={set('color')} className="input w-28 font-mono" placeholder="#2563eb" />
              </div>
            </Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={editing.isActive} onChange={set('isActive')} className="accent-accent" /> Shown on the till</label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export { Categories };
