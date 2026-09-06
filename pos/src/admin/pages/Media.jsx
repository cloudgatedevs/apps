import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { listImages, deleteImage } from '@/shared/services/files';
import { useAsync, ErrorNote, Badge, PageHead, EmptyState, Img, SelectionBar, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTiles } from '@/shared/ui/skeleton';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { errorMessage } from '@/shared/lib/errors';
import { IconMedia } from '@/admin/components/navConfig';

const PAGE = 200;
const FOLDER_LABEL = { 'pos/products': 'Products', 'pos/branding': 'Branding', uploads: 'Uploads' };

// Every stored image next to what the POS still references, so images left behind by
// deleted products or replaced photos can be removed without touching anything in use.
const Media = () => {
  const [filter, setFilter] = useState('all'); // all | unused | used
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [folder, setFolder] = useState('');
  const files = useAsync(() => listImages({ path: '*', take: PAGE }), []);
  const refs = useAsync(() => adminApi.products.imageRefs(), []);

  const rows = useMemo(() => {
    const items = files.data?.items ?? [];
    const fileIds = new Set(refs.data?.fileIds ?? []);
    const urls = new Set(refs.data?.urls ?? []);
    // "In use" is only tracked for product photos; branding and category images are always kept.
    return items.map((f) => ({ ...f, product: (f.path || '') === 'pos/products', inUse: (f.path || '') !== 'pos/products' || fileIds.has(String(f.id)) || urls.has(f.url) || urls.has(f.thumbUrl) }));
  }, [files.data, refs.data]);
  const folders = useMemo(() => [...new Set(rows.map((r) => r.path || ''))].sort(), [rows]);
  const shown = rows.filter((r) => (!folder || (r.path || '') === folder) && (filter === 'unused' ? !r.inUse : filter === 'used' ? r.inUse : true));
  const unusedCount = rows.filter((r) => !r.inUse).length;

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllUnused = () => setSelected(new Set(rows.filter((r) => !r.inUse).map((r) => r.id)));

  const remove = async (ids) => {
    if (!ids.length) return;
    setBusy(true);
    const tid = toast.loading(`Deleting 0 / ${ids.length}…`);
    let ok = 0;
    const failed = [];
    for (const [i, id] of ids.entries()) {
      try { await deleteImage(id); ok += 1; } catch (err) { failed.push(errorMessage(err)); }
      toast.loading(`Deleting ${i + 1} / ${ids.length}…`, { id: tid });
    }
    setSelected(new Set());
    files.reload();
    if (failed.length) toast.error(`Deleted ${ok}; ${failed.length} failed (${failed[0]}).`, { id: tid, duration: 6000 });
    else toast.success(`Deleted ${ok} image${ok === 1 ? '' : 's'}.`, { id: tid });
    setBusy(false);
  };

  const loading = files.loading || refs.loading;
  const selectedUnused = [...selected].filter((id) => rows.find((r) => r.id === id && !r.inUse));

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Media" subtitle={`Every image the store has uploaded to Cloudgate: product photos and branding. ${rows.length ? `${rows.length} file${rows.length === 1 ? '' : 's'}, ${unusedCount} product photo${unusedCount === 1 ? '' : 's'} not used by any product.` : ''}`}>
        {folders.length > 1 ? (
          <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
            <button type="button" onClick={() => setFolder('')} className={`rounded-md px-3 py-1 text-sm ${!folder ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={!folder}>All folders</button>
            {folders.map((p) => <button key={p} type="button" onClick={() => setFolder(p)} className={`rounded-md px-3 py-1 text-sm ${folder === p ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={folder === p}>{FOLDER_LABEL[p] ?? p}</button>)}
          </div>
        ) : null}
        <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
          {[['all', 'All'], ['used', 'In use'], ['unused', 'Unused']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setFilter(v)} className={`rounded-md px-3 py-1 text-sm ${filter === v ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={filter === v}>{label}</button>
          ))}
        </div>
        {unusedCount ? <button type="button" onClick={selectAllUnused} className="btn-ghost">Select unused</button> : null}
        <button onClick={() => { files.reload(); refs.reload(); }} className="btn-ghost">Refresh</button>
        <button type="button" onClick={() => setUploading(true)} className="btn-primary">Upload</button>
      </PageHead>

      <ErrorNote error={files.error || refs.error} />
      {loading ? (
        <SkeletonTiles count={12} />
      ) : shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {shown.map((f) => (
            <label key={f.id} className={`card group relative flex cursor-pointer flex-col overflow-hidden transition ${selected.has(f.id) ? 'ring-2 ring-accent' : 'hover:border-ink-500'}`}>
              <Img src={f.thumbUrl} alt={f.name} wrapClassName="aspect-square w-full" className="aspect-square w-full object-cover" />
              <div className="flex flex-col gap-1 p-2.5">
                <p className="truncate text-xs font-medium text-mist" title={f.name}>{f.name}</p>
                <div className="flex items-center justify-between gap-2">
                  {f.product ? <Badge tone={f.inUse ? 'green' : 'amber'}>{f.inUse ? 'in use' : 'unused'}</Badge> : <Badge tone="blue">{FOLDER_LABEL[f.path] ?? f.path}</Badge>}
                  <span className="text-[11px] text-mist-dim">{fmtDateShort(f.createdAt)}</span>
                </div>
              </div>
              {!f.inUse ? (
                <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="absolute left-2 top-2 h-4 w-4 accent-accent" aria-label={`Select ${f.name}`} />
              ) : null}
              <a href={f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-mist-muted opacity-0 shadow-panel transition group-hover:opacity-100">Open</a>
            </label>
          ))}
        </div>
      ) : filter === 'unused' ? (
        <EmptyState compact title="Every stored image is in use" text="Nothing to clean up." />
      ) : (
        <EmptyState icon={<IconMedia className="h-5 w-5" />} title="No images yet" text="Upload product photos here or from a product page. Each one opens in the crop tool first." action={<><button type="button" onClick={() => setUploading(true)} className="btn-primary">Upload images</button><Link to="/products" className="btn-ghost">Go to products</Link></>} />
      )}

      <SelectionBar count={selectedUnused.length} onClear={() => setSelected(new Set())}>
        <button type="button" disabled={busy} onClick={() => remove(selectedUnused)} className="btn-danger btn-sm">{busy ? 'Deleting…' : 'Delete selected'}</button>
      </SelectionBar>

      <ImageUploader open={uploading} onClose={() => setUploading(false)} path="pos/products" aspect={1} title="Upload to media" note="Uploaded here, images are stored but not attached to a product yet; attach them from the product editor."
        onUploaded={(done) => { toast.success(`${done.length} image${done.length === 1 ? '' : 's'} uploaded.`); files.reload(); }} />
    </div>
  );
};

export { Media };
