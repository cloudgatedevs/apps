// Image upload with cropping, the same way the Cloudgate hub does it: an Uppy Dashboard for
// picking files (drag and drop, multiple files, webcam, progress), a react-easy-crop step for
// each picture before it is sent, and Uppy's XHR plugin posting to the IdP files endpoint.
//
//   <ImageUploader open={open} onClose={() => setOpen(false)} onUploaded={(files) => …}
//                  path="pos/products" aspect={1} maxFiles={10} />
//
// `onUploaded` receives the endpoint's JSON for every successful file
// ({ id, fileId, url, thumbUrl, name, size }). Cropping is optional per file ("Use original").
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import Webcam from '@uppy/webcam';
import Cropper from 'react-easy-crop';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import '@uppy/webcam/dist/style.min.css';
import 'react-easy-crop/react-easy-crop.css';
import { Modal } from '@/shared/ui/forms';
import { uploadEndpoint, authHeaders } from '@/shared/services/files';
import { getCroppedBlob, getResizedBlob } from '@/shared/lib/imageCropExport';

const ASPECTS = [
  { key: 'square', label: 'Square', value: 1 },
  { key: 'portrait', label: 'Portrait 4:5', value: 4 / 5 },
  { key: 'landscape', label: 'Landscape 3:2', value: 3 / 2 },
  { key: 'free', label: 'Free', value: null },
];

const unwrap = (raw) => (raw && typeof raw === 'object' && 'result' in raw ? raw.result : raw);

/** Crop dialog for one file. Resolves with a Blob (cropped or resized original) or null when cancelled. */
const CropStep = ({ file, aspect: initialAspect, onDone, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectKey, setAspectKey] = useState(() => ASPECTS.find((a) => a.value === initialAspect)?.key ?? (initialAspect == null ? 'free' : 'square'));
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const src = useMemo(() => (file ? URL.createObjectURL(file.data) : null), [file]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => { setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); }, [file?.id]);

  const onCropComplete = useCallback((_, px) => setArea(px), []);
  const aspect = ASPECTS.find((a) => a.key === aspectKey)?.value ?? null;

  const finish = async (useOriginal) => {
    if (!src) return;
    setBusy(true);
    try {
      // PNG sources stay PNG so transparent logos keep their transparency; anything else becomes JPEG.
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = useOriginal || !area ? await getResizedBlob(src, { type }) : await getCroppedBlob(src, area, { type });
      onDone(blob);
    } catch (err) {
      onDone(null, err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!file} title={`Crop ${file?.name ?? 'image'}`} onClose={busy ? undefined : onCancel} size="lg"
      footer={(
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost">Skip this file</button>
          <span className="grow" />
          <button type="button" onClick={() => finish(true)} disabled={busy} className="btn-ghost">Use original</button>
          <button type="button" onClick={() => finish(false)} disabled={busy || !area} className="btn-primary">{busy ? 'Preparing…' : 'Crop & add'}</button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {ASPECTS.map((a) => (
            <button key={a.key} type="button" onClick={() => setAspectKey(a.key)} className={`chip ${aspectKey === a.key ? 'chip-active' : ''}`} aria-pressed={aspectKey === a.key}>{a.label}</button>
          ))}
        </div>
        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-zinc-900 sm:h-96">
          {src ? (
            <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect ?? undefined} showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} objectFit="contain" />
          ) : null}
        </div>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 opacity-70">Zoom</span>
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="grow accent-current" aria-label="Zoom" />
          <span className="w-10 text-right tabular-nums opacity-70">{Math.round(zoom * 100)}%</span>
        </label>
        <p className="text-xs opacity-70">Drag to position, scroll or use the slider to zoom. Images are resized to 1600px on the long side and saved as JPEG.</p>
      </div>
    </Modal>
  );
};

export const ImageUploader = ({ open, onClose, onUploaded, path = 'uploads', aspect = 1, maxFiles = 10, title = 'Upload images', note }) => {
  const [pending, setPending] = useState([]); // files waiting for a crop decision
  const [error, setError] = useState(null);
  const resultsRef = useRef([]);

  const uppy = useMemo(() => {
    const u = new Uppy({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: { maxNumberOfFiles: maxFiles, allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxFileSize: 25 * 1024 * 1024 },
    })
      .use(XHRUpload, {
        id: 'XHRUpload',
        endpoint: uploadEndpoint(path),
        fieldName: 'file',
        formData: true,
        headers: () => authHeaders(),
        limit: 2,
        getResponseData: (xhr) => {
          try { return unwrap(JSON.parse(xhr.responseText)); } catch { return {}; }
        },
        getResponseError: (responseText) => {
          try {
            const j = JSON.parse(responseText);
            return new Error(j?.error?.message || j?.Message || j?.message || 'Upload failed');
          } catch { return new Error('Upload failed'); }
        },
      })
      .use(Webcam, { id: 'Webcam', modes: ['picture'], mirror: true, showVideoSourceDropdown: true });
    return u;
  }, [path, maxFiles]);

  // Every added file gets queued for the crop step unless it came from the crop step itself.
  useEffect(() => {
    const onAdded = (file) => {
      if (file.meta?.cropped || file.source === 'crop') return;
      setPending((q) => [...q, file]);
    };
    const onSuccess = (file, response) => {
      const body = response?.body || {};
      resultsRef.current.push({ ...body, uppyId: file.id, name: body.name || file.name });
    };
    const onComplete = () => {
      const done = resultsRef.current.splice(0);
      if (done.length) onUploaded?.(done);
    };
    const onError = (file, err) => setError(err?.message || 'Upload failed');
    uppy.on('file-added', onAdded);
    uppy.on('upload-success', onSuccess);
    uppy.on('complete', onComplete);
    uppy.on('upload-error', onError);
    return () => {
      uppy.off('file-added', onAdded);
      uppy.off('upload-success', onSuccess);
      uppy.off('complete', onComplete);
      uppy.off('upload-error', onError);
    };
  }, [uppy, onUploaded]);

  useEffect(() => () => uppy.destroy(), [uppy]);
  useEffect(() => { if (!open) { uppy.cancelAll(); setPending([]); setError(null); } }, [open, uppy]);

  const current = pending[0] ?? null;
  const cropDone = (blob, err) => {
    if (err) setError(err.message || 'Could not prepare the image.');
    if (blob && current) {
      const base = current.name.replace(/\.[^.]+$/, '') || 'image';
      try {
        uppy.removeFile(current.id);
        const png = blob.type === 'image/png';
        uppy.addFile({ name: `${base}.${png ? 'png' : 'jpg'}`, type: png ? 'image/png' : 'image/jpeg', data: blob, source: 'crop', meta: { cropped: true } });
      } catch (e) { setError(e?.message || 'Could not add the image.'); }
    }
    setPending((q) => q.slice(1));
  };
  const cropCancel = () => {
    if (current) { try { uppy.removeFile(current.id); } catch { /* already gone */ } }
    setPending((q) => q.slice(1));
  };

  return (
    <>
      <Modal open={open} title={title} onClose={onClose} size="lg">
        <div className="flex flex-col gap-3">
          {note ? <p className="text-xs opacity-70">{note}</p> : null}
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <Dashboard uppy={uppy} inline width="100%" height={380} proudlyDisplayPoweredByUppy={false} showProgressDetails note="JPEG, PNG, WebP or GIF. Each picture opens in the crop tool first." plugins={['Webcam']} />
        </div>
      </Modal>
      <CropStep file={current} aspect={aspect} onDone={cropDone} onCancel={cropCancel} />
    </>
  );
};
