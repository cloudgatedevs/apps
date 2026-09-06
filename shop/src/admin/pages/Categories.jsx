import { useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState, Img } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Field, Modal, ConfirmButton } from '@/shared/ui/forms';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { MediaPicker } from '@/shared/ui/MediaPicker';
import { errorMessage } from '@/shared/lib/errors';
import { IconCategories } from '@/admin/components/navConfig';
import { ArrowDown, ArrowUp, CornerDownRight } from 'lucide-react';

const empty = { name: '', slug: '', description: '', parentId: '', imageUrl: '', isActive: true };

const Categories = () => {
  const { data, loading, error, reload } = useAsync(() => adminApi.categories.list(), []);
  const [editing, setEditing] = useState(null); // null | { id?, ...fields }
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const list = rows ?? data ?? [];

  const open = (c) => setEditing(c ? { id: c.Id, name: c.Name ?? '', slug: c.Slug ?? '', description: c.Description ?? '', parentId: c.ParentId ?? '', imageUrl: c.ImageUrl ?? '', isActive: c.IsActive !== 0 } : { ...empty });
  const set = (k) => (e) => setEditing((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const items = await fn();
      setRows(items);
      setEditing(null);
      if (okText) toast.success(okText);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    const payload = { name: editing.name, slug: editing.slug || undefined, description: editing.description, parentId: editing.parentId ? Number(editing.parentId) : null, imageUrl: editing.imageUrl, isActive: editing.isActive };
    return editing.id
      ? run(() => adminApi.categories.update(editing.id, payload), 'Category updated.')
      : run(() => adminApi.categories.create(payload), 'Category created.');
  };

  // Optimistic reorder: swap locally, then persist; snap back on failure.
  const move = (idx, dir) => {
    const top = list.filter((c) => !c.ParentId);
    const i = top.findIndex((c) => c.Id === list[idx].Id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= top.length) return;
    const ids = top.map((c) => c.Id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const previous = list;
    const order = new Map(ids.map((id, n) => [id, n]));
    setRows([...list].sort((a, b) => (order.get(a.ParentId || a.Id) ?? 0) - (order.get(b.ParentId || b.Id) ?? 0) || (a.ParentId ? 1 : 0) - (b.ParentId ? 1 : 0)));
    adminApi.categories.reorder(ids).then(setRows).catch((err) => { setRows(previous); toast.error(errorMessage(err)); });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Categories" subtitle="How the catalogue is organised. Products can live without a category.">
        <button onClick={() => { setRows(null); reload(); }} className="btn-ghost">Refresh</button>
        <button onClick={() => open(null)} className="btn-primary">New category</button>
      </PageHead>

      <ErrorNote error={error} />
      {loading && !rows ? (
        <SkeletonTable columns={5} rows={5} />
      ) : (
        <Table
          columns={[
            {
              key: 'Name', label: 'Category', mobile: 'title',
              render: (c) => (
                <span className="flex items-center gap-3 text-mist">
                  {c.ImageUrl ? <Img src={c.ImageUrl} alt="" wrapClassName="h-9 w-9 shrink-0 rounded-lg border border-ink-700" className="h-9 w-9 object-cover" /> : null}
                  <span>
                    {c.ParentId ? <CornerDownRight className="mr-2 inline h-3.5 w-3.5 text-mist-dim" aria-hidden="true" /> : null}
                    <button type="button" onClick={() => open(c)} className="font-medium hover:text-accent">{c.Name}</button>
                    <span className="ml-2 font-mono text-xs text-mist-dim">/{c.Slug}</span>
                  </span>
                </span>
              ),
            },
            { key: 'Description', label: 'Description', mobile: 'meta', render: (c) => <span className="text-mist-muted">{c.Description || '—'}</span> },
            { key: 'ProductCount', label: 'Products', align: 'right', render: (c) => <span className="tabular-nums">{c.ProductCount}</span> },
            { key: 'IsActive', label: 'Status', render: (c) => <Badge tone={c.IsActive ? 'green' : 'gray'} dot>{c.IsActive ? 'active' : 'hidden'}</Badge> },
            {
              key: 'actions', label: '', mobile: 'actions',
              render: (c) => {
                const idx = list.findIndex((x) => x.Id === c.Id);
                return (
                  <span className="flex items-center gap-1">
                    {!c.ParentId ? (
                      <>
                        <button type="button" onClick={() => move(idx, -1)} className="btn-ghost btn-sm" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => move(idx, 1)} className="btn-ghost btn-sm" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => open(c)} className="btn-ghost btn-sm">Edit</button>
                  </span>
                );
              },
            },
          ]}
          rows={list}
          empty={<EmptyState icon={<IconCategories className="h-5 w-5" />} title="No categories yet" text="Group products so customers can browse by type. Categories show in the store's navigation." action={<button type="button" onClick={() => open(null)} className="btn-primary">New category</button>} />}
        />
      )}

      <Modal open={!!editing} title={editing?.id ? 'Edit category' : 'New category'} onClose={() => setEditing(null)}
        footer={(
          <>
            {editing?.id ? <ConfirmButton onConfirm={() => run(() => adminApi.categories.remove(editing.id), 'Category deleted.')} confirmLabel="Delete for real?" disabled={busy}>Delete</ConfirmButton> : null}
            <span className="grow" />
            <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
            <button type="submit" form="category-form" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </>
        )}
      >
        {editing ? (
          <form id="category-form" onSubmit={save} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="c-name"><input id="c-name" value={editing.name} onChange={set('name')} className="input" required autoFocus /></Field>
            <Field label="Slug" hint="Leave blank to generate from the name." htmlFor="c-slug"><input id="c-slug" value={editing.slug} onChange={set('slug')} className="input font-mono" /></Field>
            <Field label="Parent" htmlFor="c-parent">
              <select id="c-parent" value={editing.parentId ?? ''} onChange={set('parentId')} className="select">
                <option value="">Top level</option>
                {list.filter((c) => !c.ParentId && c.Id !== editing.id).map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
              </select>
            </Field>
            <Field label="Description" htmlFor="c-desc"><textarea id="c-desc" value={editing.description} onChange={set('description')} className="textarea" rows={3} /></Field>
            <Field label="Image" hint="Shown on the category tile. Choose an existing image or upload one (opens the crop tool)." htmlFor="c-img">
              <div className="flex items-center gap-3">
                {editing.imageUrl ? <Img src={editing.imageUrl} alt="" wrapClassName="h-14 w-14 shrink-0 rounded-lg border border-ink-700" className="h-14 w-14 object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-ink-600 text-[10px] text-mist-dim">none</span>}
                <div className="flex min-w-0 grow flex-col gap-2">
                  <input id="c-img" value={editing.imageUrl} onChange={set('imageUrl')} className="input" placeholder="https://… or upload" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setChoosing(true)} className="btn-ghost btn-sm">Choose…</button>
                    <button type="button" onClick={() => setUploading(true)} className="btn-ghost btn-sm">Upload…</button>
                    {editing.imageUrl ? <button type="button" onClick={() => setEditing((f) => ({ ...f, imageUrl: '' }))} className="btn-ghost btn-sm">Remove</button> : null}
                  </div>
                </div>
              </div>
            </Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={editing.isActive} onChange={set('isActive')} className="accent-accent" /> Visible in the store</label>
          </form>
        ) : null}
      </Modal>

      <MediaPicker open={choosing} onClose={() => setChoosing(false)} preferFolder="shop/categories" title="Choose category image" onUploadInstead={() => setUploading(true)}
        onPick={(files) => { const f = files[0]; if (f?.url) { setEditing((e) => (e ? { ...e, imageUrl: f.url } : e)); toast.success('Image selected.'); } }} />
      <ImageUploader open={uploading} onClose={() => setUploading(false)} path="shop/categories" aspect={3 / 2} maxFiles={1} title="Category image"
        onUploaded={(done) => { const f = done[0]; if (f?.url) { setEditing((e) => (e ? { ...e, imageUrl: f.url } : e)); toast.success('Image uploaded.'); } setUploading(false); }} />
    </div>
  );
};

export { Categories };
