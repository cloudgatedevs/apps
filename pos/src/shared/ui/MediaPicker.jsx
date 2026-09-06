// Pick images that are already in the tenant's media library (IdP file store) instead of
// uploading again. Used wherever an image is set in the back office: store logo and icon,
// category tiles and product photos. Lists every folder ("*"), with folder chips and a name
// search; single or multi select; "Upload new…" hands over to the crop uploader.
import { useEffect, useMemo, useState } from 'react';
import { Search, Upload, Check } from 'lucide-react';
import { Modal } from '@/shared/ui/forms';
import { Img, ErrorNote } from '@/shared/ui/ui';
import { SkeletonTiles } from '@/shared/ui/skeleton';
import { listImages } from '@/shared/services/files';

const PAGE = 200;
const FOLDER_LABEL = { 'pos/products': 'Products', 'pos/branding': 'Branding', uploads: 'Uploads' };
const folderLabel = (p) => FOLDER_LABEL[p] ?? (p || 'Other');

/**
 * <MediaPicker open onClose onPick(files) multiple preferFolder onUploadInstead />
 * onPick receives an array of { id, url, thumbUrl, name, path } (one item unless `multiple`).
 */
export const MediaPicker = ({ open, onClose, onPick, multiple = false, preferFolder = '', title = 'Choose from media', onUploadInstead }) => {
  const [state, setState] = useState({ items: null, loading: false, error: null });
  const [folder, setFolder] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Map());

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setPicked(new Map());
    setQ('');
    setState({ items: null, loading: true, error: null });
    listImages({ path: '*', take: PAGE })
      .then((r) => {
        if (!live) return;
        const items = r?.items ?? [];
        setState({ items, loading: false, error: null });
        // Start on the caller's folder when it has anything, otherwise show everything.
        setFolder(preferFolder && items.some((f) => f.path === preferFolder) ? preferFolder : '');
      })
      .catch((error) => live && setState({ items: [], loading: false, error }));
    return () => { live = false; };
  }, [open, preferFolder]);

  const folders = useMemo(() => [...new Set((state.items ?? []).map((f) => f.path || ''))].sort(), [state.items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.items ?? []).filter((f) => (!folder || f.path === folder) && (!needle || String(f.name ?? '').toLowerCase().includes(needle)));
  }, [state.items, folder, q]);

  const toggle = (f) => {
    setPicked((m) => {
      const next = multiple ? new Map(m) : new Map();
      if (m.has(f.id)) next.delete(f.id); else next.set(f.id, f);
      return next;
    });
  };
  const confirm = () => { if (picked.size) { onPick([...picked.values()]); onClose?.(); } };

  return (
    <Modal open={open} onClose={onClose} title={title} description={multiple ? 'Pick one or more images already in your library.' : 'Pick an image already in your library.'} size="xl"
      footer={(
        <>
          {onUploadInstead ? <button type="button" onClick={() => { onClose?.(); onUploadInstead(); }} className="btn-ghost mr-auto"><Upload className="h-4 w-4" aria-hidden="true" />Upload new…</button> : null}
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="button" onClick={confirm} disabled={!picked.size} className="btn-primary">{multiple && picked.size > 1 ? `Use ${picked.size} images` : 'Use image'}</button>
        </>
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setFolder('')} className={`chip ${!folder ? 'chip-active' : ''}`} aria-pressed={!folder}>All</button>
          {folders.map((p) => <button key={p} type="button" onClick={() => setFolder(p)} className={`chip ${folder === p ? 'chip-active' : ''}`} aria-pressed={folder === p}>{folderLabel(p)}</button>)}
        </div>
        <label className="relative ml-auto block w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-dim" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name" aria-label="Search images" className="input pl-8" />
        </label>
      </div>
      <ErrorNote error={state.error} />
      {state.loading ? (
        <SkeletonTiles count={12} />
      ) : shown.length ? (
        <div className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
          {shown.map((f) => {
            const on = picked.has(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f)} aria-pressed={on} title={f.name} className={`group relative overflow-hidden rounded-xl border bg-white text-left transition ${on ? 'border-accent ring-2 ring-accent' : 'border-ink-700 hover:border-ink-500'}`}>
                <Img src={f.thumbUrl || f.url} alt={f.name} wrapClassName="aspect-square w-full" className="aspect-square w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-[11px] text-mist-muted">{f.name}</span>
                {on ? <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-white"><Check className="h-3 w-3" aria-hidden="true" /></span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-600 px-4 py-10 text-center text-sm text-mist-muted">{state.items?.length ? 'No images match.' : 'No images in the library yet. Upload one to get started.'}</p>
      )}
    </Modal>
  );
};
