import React, { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, Upload, Leaf, ArrowUpRight } from 'lucide-react';
import { Brand, Button, ErrorBox, Field, Modal } from './ui';
import { BRAND_DEFAULTS, brandIdentity, imageUrl, themeTokens } from './branding-model';
import { getCroppedBlob, getResizedBlob } from '../shared/lib/imageCropExport';
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

function MediaLibrary({ close, select }) {
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async (skip = 0) => {
    setBusy(true); setError('');
    try { const result = await listBrandImages(skip); setItems(previous => skip ? [...previous, ...result.items] : result.items); setTotal(result.total); }
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
    </div></div>{file && <CropImage file={file} square={square} aspect={aspect} path={path} close={() => setFile(null)} select={change}/>}{library && <MediaLibrary close={() => setLibrary(false)} select={change}/>}
  </div>;
}

function Colour({ label, value, change }) {
  return <div className="brand-colour"><label>{label}<span className="colour-input"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={e => change(e.target.value)} aria-label={label + ' picker'}/><input aria-label={label + ' hex'} value={value} onChange={e => change(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} required spellCheck="false"/></span></label></div>;
}

export default function BrandingEditor({ value, change }) {
  const brand = brandIdentity(value);
  return <>
    <section className="panel settings-group"><h3>Branding</h3><p className="muted">Your identity across the booking site, workspace and browser tab.</p><div className="form-grid"><Field label="App name" hint="Leave blank to use your business name."><input value={value.app_name} maxLength={120} placeholder={value.name || 'Booking'} onChange={e => change('app_name', e.target.value)}/></Field><Field label="Short name" hint="Used when customers add the site to their home screen."><input value={value.app_short_name} maxLength={30} placeholder={brand.name} onChange={e => change('app_short_name', e.target.value)}/></Field></div>
    <div className="brand-assets"><Asset label="Logo" hint="A wide or square logo for the site and workspace." value={value.logo_url} change={v => change('logo_url', v)}/><Asset label="App icon" hint="A square image for home-screen shortcuts. 512 × 512 recommended." square value={value.icon_url} change={v => change('icon_url', v)}/><Asset label="Favicon" hint="A simple square image for browser tabs. Falls back to your app icon." square value={value.favicon_url} change={v => change('favicon_url', v)}/></div>
    <label className="checkbox"><input type="checkbox" checked={value.logo_show_name !== '0'} onChange={e => change('logo_show_name', e.target.checked ? '1' : '0')}/> Show app name beside the logo</label></section>
    <section className="panel settings-group"><h3>Theme colours</h3><p className="muted">The default palette is black, white and grey. Choose your own colours below; button labels and body text adapt to keep them readable.</p><div className="brand-colours"><Colour label="Primary colour" value={value.theme_primary} change={v => change('theme_primary', v)}/><Colour label="Accent colour" value={value.theme_accent} change={v => change('theme_accent', v)}/><Colour label="Page background" value={value.theme_background} change={v => change('theme_background', v)}/></div><button type="button" className="text-link" onClick={() => ['theme_primary', 'theme_accent', 'theme_background'].forEach(key => change(key, BRAND_DEFAULTS[key]))}>Restore default colours</button>
    <div className="branding-preview" style={themeTokens(value)} aria-label="Branding preview"><div className="brand-browser-tab"><img src={brand.favicon} alt=""/><span>{brand.name}</span><small>Preview</small></div><div className="brand-preview-body"><Brand settings={value} small/><span className="eyebrow">A LITTLE TIME FOR YOU</span><h2>{value.tagline || 'Your next good moment.'}</h2><p>{value.description || 'Make room for a little care.'}</p><div className="actions"><span className="button">Book an appointment <ArrowUpRight size={15}/></span><span className="brand-preview-tag"><Leaf size={15}/> Your moment awaits</span></div></div></div><p className="muted brand-preview-note">Preview only. Save business settings to apply your changes.</p></section>
  </>;
}
