import React, { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, Upload, Leaf, ArrowUpRight } from 'lucide-react';
import { Button, ErrorBox, Field, Modal } from './ui';
import { imageUrl } from './branding-model';
import { getCroppedBlob, getResizedBlob } from './image-crop';
import { listBrandImages, saveBrandImage } from './branding-media';

function ImagePreview({ url, label }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <div className="brand-image-preview">{url && !failed ? <img src={url} alt={label} onError={() => setFailed(true)}/> : <span><ImagePlus size={25}/><small>{failed ? 'Image could not load' : 'No image selected'}</small></span>}</div>;
}

export function CropImage({ file, close, select, square, aspect: initialAspect, path, title = 'Prepare your image', cancelAll, saveImage = saveBrandImage }) {
  const [source] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 }), [zoom, setZoom] = useState(1), [area, setArea] = useState(null);
  const [aspect, setAspect] = useState(initialAspect || (square ? 1 : 3)), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  const upload = async original => {
    setBusy(true); setError('');
    try {
      const options = { type: 'image/png', maxSide: square ? 512 : 1600 };
      const blob = original ? await getResizedBlob(source, options) : await getCroppedBlob(source, area, options);
      const result = await saveImage(blob, file.name, path);
      if (!imageUrl(result.url)) throw new Error('The file service did not return a usable image URL.');
      select(result.url); close();
    } catch (err) { setError(err.message || 'Unable to upload this image. Try PNG, JPEG or WebP.'); }
    finally { setBusy(false); }
  };
  return <Modal title={title} wide close={() => { if (!busy) close(); }}>
    <p className="muted">Drag to position your image. Transparency is preserved.</p>
    <div className="brand-crop-stage"><Cropper image={source} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} mediaProps={{ onError: () => setError('This image could not be opened. Try PNG, JPEG or WebP.') }}/></div>
    <div className="form-grid"><Field label="Zoom"><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))}/></Field><Field label="Crop shape"><select value={aspect} onChange={e => setAspect(Number(e.target.value))}><option value="1">Square</option><option value="1.5">Landscape (3:2)</option><option value="3">Wide (3:1)</option><option value="2">Landscape (2:1)</option></select></Field></div>
    <ErrorBox error={error}/><div className="actions"><Button type="button" busy={busy} disabled={!area} onClick={() => upload(false)}>Upload cropped image</Button><Button type="button" secondary disabled={busy} onClick={() => upload(true)}>Use entire image</Button>{cancelAll && <Button type="button" secondary disabled={busy} onClick={cancelAll}>Cancel remaining uploads</Button>}</div>
  </Modal>;
}

function MediaLibrary({ close, select, path }) {
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async (skip = 0) => {
    setBusy(true); setError('');
    try { const result = await listBrandImages(skip, path); setItems(previous => skip ? [...previous, ...result.items] : result.items); setTotal(result.total ?? result.totalCount); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  return <Modal title="Choose from media library" wide close={close}><p className="muted">Reuse an image uploaded for this business.</p><ErrorBox error={error}/><div className="brand-media-grid">{items.map(item => <button type="button" key={item.id || item.fileId} onClick={() => { select(item.url); close(); }}><img src={item.thumbUrl || item.url} alt="" loading="lazy"/><span>{item.name}</span></button>)}</div>{!busy && !items.length && !error && <p>No images yet. Upload your first image.</p>}{(busy || error || items.length < total) && <Button type="button" secondary busy={busy} onClick={() => load(items.length)}>{error ? 'Try again' : 'Load more images'}</Button>}</Modal>;
}

export function Asset({ label, hint, value = '', change, square, aspect, path }) {
  const [file, setFile] = useState(null), [library, setLibrary] = useState(false), [error, setError] = useState('');
  return <div className="brand-asset"><h4>{label}</h4><p className="muted">{hint}</p><div className="brand-asset-body"><ImagePreview url={imageUrl(value)} label={label}/><div className="brand-asset-controls">
    <Field label={label + ' URL'}><input value={value} maxLength={2048} placeholder="https://… or /image.png" onChange={e => change(e.target.value)} aria-invalid={!!value.trim() && !imageUrl(value)}/></Field>
    <div className="brand-asset-actions"><label className="button secondary upload-button"><Upload size={14}/> Upload<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" aria-label={'Upload ' + label.toLowerCase()} onChange={e => { const next = e.target.files?.[0]; e.target.value = ''; setError(''); if (!next) return; if (next.size > 20 * 1024 * 1024) { setError('Choose an image under 20 MB.'); return; } setFile(next); }}/></label><Button type="button" secondary onClick={() => setLibrary(true)}>Library</Button>{value && <button type="button" className="text-link" onClick={() => change('')}>Remove {label.toLowerCase()}</button>}</div><ErrorBox error={error}/>
    </div></div>{file && <CropImage file={file} square={square} aspect={aspect} path={path} close={() => setFile(null)} select={change}/>}{library && <MediaLibrary path={path} close={() => setLibrary(false)} select={change}/>}
  </div>;
}
