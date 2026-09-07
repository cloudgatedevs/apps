import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { listImages, deleteImage } from '@/shared/services/files';
import { useAsync, ErrorNote, Badge, PageHead, EmptyState, Img, SelectionBar, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTiles } from '@/shared/ui/skeleton';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { errorMessage } from '@/shared/lib/errors';
import { ConfirmButton } from '@/shared/ui/forms';
import { IconMedia } from '@/admin/components/navConfig';

const PAGE = 200;
const FOLDER_LABEL = { 'pos/products': 'Products', 'pos/branding': 'Branding', uploads: 'Uploads' };
const APP_FOLDER_PREFIX = 'pos/';
const folderLabel = (p) => FOLDER_LABEL[p] ?? p.slice(APP_FOLDER_PREFIX.length);

// Every stored image next to what the POS still references, so images left behind by
// deleted products or replaced photos can be removed without touching anything in use.
const Media = () => {
  const [filter, setFilter] = useState('all'); // all | unused | used
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Tile whose trash button is armed ("Delete?"); disarms on its own after a moment.
  const [armedId, setArmedId] = useState(null);
  useEffect(() => {
    if (armedId === null) return undefined;
    const t = setTimeout(() => setArmedId(null), 3500);
    return () => clearTimeout(t);
  }, [armedId]);

  // null = every folder.
  const [folder, setFolder] = useState(null);
  const files = useAsync(() => listImages({ path: '*', take: PAGE }), []);
  const refs = useAsync(() => adminApi.products.imageRefs(), []);

  const rows = useMemo(() => {
    // Only this app's folders (pos/...). Files at the root or in other apps' folders belong to the
    // tenant's wider library and are never listed here.
    const items = (files.data?.items ?? []).filter((f) => String(f.path || '').startsWith(APP_FOLDER_PREFIX));
    const fileIds = new Set(refs.data?.fileIds ?? []);
    const urls = new Set(refs.data?.urls ?? []);
    const texts = refs.data?.texts ?? [];
    // A file is in use when a product, category, page or setting still points at it (by file id
    // or URL), whatever folder it was uploaded to. Anything else can be cleaned up.
    const referenced = (f) => fileIds.has(String(f.id)) || urls.has(f.url) || urls.has(f.thumbUrl) || texts.some((t) => (f.url && t.includes(f.url)) || (f.thumbUrl && t.includes(f.thumbUrl)));
    return items.map((f) => ({ ...f, folder: f.path || '', inUse: referenced(f) }));
  }, [files.data, refs.data]);
  const folders = useMemo(() => [...new Set(rows.map((r) => r.folder))].sort(), [rows]);
  const shown = rows.filter((r) => (folder === null || r.folder === folder) && (filter === 'unused' ? !r.inUse : filter === 'used' ? r.inUse : true));
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
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedInUse = selectedRows.filter((r) => r.inUse).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Media" subtitle={`Every image the store has uploaded to Cloudgate: product photos and branding. ${rows.length ? `${rows.length} file${rows.length === 1 ? '' : 's'}, ${unusedCount} not used anywhere.` : ''}`}>
        {folders.length > 1 ? (
          <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
            <button type="button" onClick={() => setFolder(null)} className={`rounded-md px-3 py-1 text-sm ${folder === null ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={folder === null}>All folders</button>
            {folders.map((p) => <button key={p} type="button" onClick={() => setFolder(p)} className={`rounded-md px-3 py-1 text-sm ${folder === p ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={folder === p}>{folderLabel(p)}</button>)}
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
                <p className="text-[11px] text-mist-dim">{fmtDateShort(f.createdAt)}</p>
                <div className="flex flex-wrap items-center gap-1"><Badge tone="blue">{folderLabel(f.folder)}</Badge>{f.inUse ? null : <Badge tone="amber">unused</Badge>}</div>
              </div>
              <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className={`absolute left-2 top-2 h-4 w-4 accent-accent transition ${selected.has(f.id) ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label={`Select ${f.name}`} />
              <span className={`absolute right-2 top-2 flex items-center gap-1 transition ${armedId === f.id ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                <a href={f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-mist-muted shadow-panel">Open</a>
                {armedId === f.id ? (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArmedId(null); remove([f.id]); }} className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-panel" title={f.inUse ? 'This image is still in use' : undefined}>{f.inUse ? 'In use, delete?' : 'Delete?'}</button>
                ) : (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArmedId(f.id); }} className="grid h-6 w-6 place-items-center rounded-md bg-white/90 text-red-700 shadow-panel transition hover:bg-white" aria-label={`Delete ${f.name}`} title="Delete image"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                )}
              </span>
            </label>
          ))}
        </div>
      ) : filter === 'unused' ? (
        <EmptyState compact title="Every stored image is in use" text="Nothing to clean up in this folder." />
      ) : (
        <EmptyState icon={<IconMedia className="h-5 w-5" />} title="No images yet" text="Upload product photos here or from a product page. Each one opens in the crop tool first." action={<><button type="button" onClick={() => setUploading(true)} className="btn-primary">Upload images</button><Link to="/products" className="btn-ghost">Go to products</Link></>} />
      )}

      <SelectionBar count={selectedRows.length} onClear={() => setSelected(new Set())}>
        <ConfirmButton
          onConfirm={() => remove(selectedRows.map((r) => r.id))}
          confirmLabel={selectedInUse ? `${selectedInUse} still in use. Delete anyway?` : 'Delete?'}
          className="btn-danger btn-sm"
          disabled={busy}
        >
          {busy ? 'Deleting…' : 'Delete selected'}
        </ConfirmButton>
      </SelectionBar>

      <ImageUploader open={uploading} onClose={() => setUploading(false)} path="pos/products" aspect={1} title="Upload to media" note="Uploaded here, images are stored but not attached to a product yet; attach them from the product editor."
        onUploaded={(done) => { toast.success(`${done.length} image${done.length === 1 ? '' : 's'} uploaded.`); files.reload(); }} />
    </div>
  );
};

export { Media };
