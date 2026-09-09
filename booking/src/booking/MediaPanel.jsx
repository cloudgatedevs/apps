import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, FolderOpen, ImageIcon, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { call } from './api';
import { CropImage } from './BrandingEditor';
import { listBookingImages, removeBookingImage } from './branding-media';
import { deletionCandidates, folderLabel, MEDIA_FOLDERS, mediaRows } from './media-model';
import { imageUrl } from './branding-model';
import { Button, ErrorBox, Field, Modal } from './ui';
import './media.css';

function Thumbnail({ file }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(file.thumbUrl || file.url);
  return <div className="media-thumbnail">{url && !failed ? <img src={url} alt={file.name} loading="lazy" onError={() => setFailed(true)}/> : <span><ImageIcon size={30}/><small>Preview unavailable</small></span>}</div>;
}
const createdLabel = value => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

export default function MediaPanel({ data, go }) {
  const [files, setFiles] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [references, setReferences] = useState(data);
  const [search, setSearch] = useState(''), [folder, setFolder] = useState('all'), [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set()), [confirm, setConfirm] = useState(null), [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false), [uploadFolder, setUploadFolder] = useState('booking/services'), [queue, setQueue] = useState([]), [uploaded, setUploaded] = useState(0);
  const generation = useRef(0), mutation = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const [next, current] = await Promise.all([listBookingImages(), call('admin-data', {}, true)]);
      if (request !== generation.current) return;
      setFiles(next); setReferences(current); setSelected(new Set());
    } catch (err) { if (request === generation.current) setError(err); }
    finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { refresh(); return () => { generation.current++; }; }, [refresh]);
  useEffect(() => { setReferences(data); }, [data]);
  const rows = useMemo(() => mediaRows(files, references), [files, references]);
  const folders = [...new Set(rows.map(row => row.path))].sort();
  const shown = rows.filter(row => (folder === 'all' || row.path === folder) && (filter === 'all' || row.inUse === (filter === 'used')) && (row.name + ' ' + folderLabel(row.path)).toLowerCase().includes(search.trim().toLowerCase()));
  const unused = rows.filter(row => !row.inUse), selectedRows = rows.filter(row => selected.has(row.id) && !row.inUse);
  const disabled = loading || deleting || !!error;
  const toggle = id => setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const copy = async file => {
    try { await navigator.clipboard.writeText(new URL(file.url, location.origin).href); setNotice('Image URL copied.'); }
    catch { setNotice('Unable to copy automatically. Open the image and copy its address.'); }
  };
  const remove = async () => {
    if (mutation.current) return;
    mutation.current = true; setDeleting(true); setError('');
    let deleted = 0;
    try {
      // Recheck the file scope and current service/team/branding references after confirmation.
      const [currentFiles, currentData] = await Promise.all([listBookingImages(), call('admin-data', {}, true)]);
      const candidates = deletionCandidates(confirm.map(file => file.id), currentFiles, currentData);
      const failures = [];
      for (const file of candidates) {
        try { await removeBookingImage(file.id); deleted++; }
        catch (err) { failures.push(`${file.name}: ${err.message || 'Delete failed.'}`); }
      }
      await refresh();
      if (failures.length) setError(`Deleted ${deleted} image${deleted === 1 ? '' : 's'}. ${failures.join(' ')}`);
      else setNotice(`Deleted ${deleted} image${deleted === 1 ? '' : 's'}.`);
    } catch (err) { setError(err); }
    finally { setConfirm(null); setSelected(new Set()); setDeleting(false); mutation.current = false; }
  };
  const chooseFiles = event => {
    const next = [...(event.target.files || [])]; event.target.value = '';
    if (!next.length) return;
    if (next.some(file => file.size > 20 * 1024 * 1024)) { setError('Choose images under 20 MB each.'); return; }
    setError(''); setUploaded(0); setQueue(next); setUploading(false);
  };

  return <section className="media-page" aria-label="Booking media library">
    <div className="panel media-intro"><div><span className="eyebrow">YOUR IMAGE LIBRARY</span><h2>A home for your business photos.</h2><p>Upload images once, then choose them from Library when editing a service, team member or your branding.</p><div className="media-counts"><span><ImageIcon size={15}/>{`${rows.length} image${rows.length === 1 ? '' : 's'}`}</span><span><Check size={15}/>{rows.length - unused.length} in use</span><span><FolderOpen size={15}/>{unused.length} unused</span></div></div><Button onClick={() => { setError(''); setUploading(true); }} disabled={loading || deleting}><Upload size={16}/> Upload images</Button></div>
    <div className="media-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Search media" placeholder="Search images…" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter media folder" value={folder} onChange={event => setFolder(event.target.value)}><option value="all">All folders</option>{folders.map(path => <option key={path} value={path}>{folderLabel(path)}</option>)}</select><select aria-label="Filter media usage" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All images</option><option value="used">In use</option><option value="unused">Unused</option></select><Button secondary busy={loading} disabled={deleting} onClick={refresh}><RefreshCw size={15}/> Refresh library</Button></div>
    <ErrorBox error={error}/>{notice && <div className="media-notice" role="status"><Check size={16}/>{notice}<button className="text-link" onClick={() => setNotice('')}>Dismiss</button></div>}
    <div className="media-list-head"><span>{loading ? 'Loading your library…' : `${shown.length} image${shown.length === 1 ? '' : 's'} shown`}</span><button className="text-link" disabled={disabled || !shown.some(row => !row.inUse)} onClick={() => setSelected(new Set(shown.filter(row => !row.inUse).map(row => row.id)))}>Select unused in this view</button></div>
    {!loading && !shown.length && <div className="panel media-empty"><ImageIcon size={38}/><h3>{rows.length ? 'No matching images' : 'Your library starts here'}</h3><p>{rows.length ? 'Try another search, folder or usage filter.' : 'Upload service photos, logos and banners. Uploaded images will appear here.'}</p>{!rows.length && <Button secondary onClick={() => { setError(''); setUploading(true); }}>Upload your first image</Button>}</div>}
    <div className="media-grid" aria-busy={loading}>{shown.map(file => <article key={file.id} className={'panel media-card ' + (selected.has(file.id) && !file.inUse ? 'selected' : '')}><Thumbnail file={file}/><label className="media-select" title={file.inUse ? 'Remove this image from its service, team member or branding setting before deleting it.' : undefined}><input type="checkbox" aria-label={'Select ' + file.name} disabled={disabled || file.inUse} checked={selected.has(file.id) && !file.inUse} onChange={() => toggle(file.id)}/><span>{file.inUse ? 'In use' : 'Unused'}</span></label><div className="media-card-body"><h3 title={file.name}>{file.name}</h3><p>{folderLabel(file.path)}{createdLabel(file.createdAt) && <> · {createdLabel(file.createdAt)}</>}</p>{file.inUse ? <details className="media-usage"><summary>Used in {file.usages.length} place{file.usages.length === 1 ? '' : 's'}</summary>{file.usages.map((use, index) => <button className="text-link" key={index} onClick={() => go(use.page)}>{use.label}<ExternalLink size={12}/></button>)}</details> : <p className="media-unused">Ready to use in your booking site</p>}<div className="media-card-actions">{imageUrl(file.url) && <><a className="icon-button" href={imageUrl(file.url)} target="_blank" rel="noreferrer" aria-label={'Open ' + file.name} title="Open image"><ExternalLink size={16}/></a><button className="icon-button" aria-label={'Copy URL for ' + file.name} title="Copy URL" onClick={() => copy(file)}><Copy size={16}/></button></>}<button className="icon-button media-delete" disabled={disabled || file.inUse} aria-label={'Delete ' + file.name} title={file.inUse ? 'Remove this image from its service, team member or branding setting first' : 'Delete image'} onClick={() => setConfirm([file])}><Trash2 size={16}/></button></div></div></article>)}</div>
    {!!selectedRows.length && <div className="media-selection" role="region" aria-label="Selected images"><strong>{selectedRows.length} selected</strong><button className="text-link" disabled={deleting} onClick={() => setSelected(new Set())}>Clear selection</button><Button className="media-danger" disabled={disabled} onClick={() => setConfirm(selectedRows)}><Trash2 size={16}/> Delete selected</Button></div>}
    <p className="media-footnote">This page manages images in the Booking folders. Usage reflects saved services, team members and branding in the current booking environment; deleted services release their photos for cleanup. Images bundled with the app are managed with its source files.</p>
    {uploading && <Modal title="Upload to media library" close={() => setUploading(false)}><p className="muted">Choose one or more images. You can crop each image or keep the entire photo before uploading.</p><Field label="Save in folder"><select value={uploadFolder} onChange={event => setUploadFolder(event.target.value)}>{Object.entries(MEDIA_FOLDERS).map(([path, label]) => <option key={path} value={path}>{label}</option>)}</select></Field><ErrorBox error={error}/><label className="button upload-button"><Upload size={16}/> Choose images<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" aria-label="Choose media images" onChange={chooseFiles}/></label><p className="muted spaced">PNG, JPEG, WebP, SVG or ICO · up to 20 MB each. Uploads are saved as PNG images.</p></Modal>}
    {!!queue.length && <CropImage key={queue.length} file={queue[0]} path={uploadFolder} aspect={1.5} title={`Prepare image · ${queue.length} remaining`} cancelAll={() => setQueue([])} close={() => setQueue(previous => previous.slice(1))} select={() => { setUploaded(count => count + 1); setNotice(`${uploaded + 1} image${uploaded ? 's' : ''} uploaded. Choose Library in a service, team or branding editor to use ${uploaded ? 'them' : 'it'}.`); refresh(); }}/> }
    {confirm && <Modal title={`Delete ${confirm.length === 1 ? 'this image' : confirm.length + ' images'}?`} close={() => { if (!deleting) setConfirm(null); }}><p>These files will be permanently removed from Cloudgate. Any copied links to them will stop working. This cannot be undone.</p><ul className="media-delete-list">{confirm.map(file => <li key={file.id}>{file.name}</li>)}</ul><p className="muted">We will check saved Booking services, team members and branding again before deleting.</p><div className="actions"><Button secondary disabled={deleting} onClick={() => setConfirm(null)}>Cancel</Button><Button className="media-danger" busy={deleting} onClick={remove}>Delete permanently</Button></div></Modal>}
  </section>;
}
