// Camera barcode scanner (ZXing). Reads EAN-13/8, UPC-A/E, Code 128/39, ITF and QR from the
// device camera and calls `onScan(code)` for each new code, debounced so a barcode held in front
// of the lens is not added ten times. Used by the till (continuous scanning) and the back
// office (capture a barcode while creating a product).
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

const HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
  ]],
  [DecodeHintType.TRY_HARDER, true],
]);

const DEVICE_KEY = 'pos.camera';

/**
 * <BarcodeScanner active onScan={(code) => …} cooldownMs={1500} className="…" />
 * `active` false releases the camera (the component stays mounted so the device choice sticks).
 */
const BarcodeScanner = ({ active = true, onScan, cooldownMs = 1500, className = '', compact = false }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const lastRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(() => { try { return localStorage.getItem(DEVICE_KEY) || ''; } catch { return ''; } });
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  // Enumerate cameras once permission exists; prefer the rear camera on phones.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        if (!deviceId || !list.some((d) => d.deviceId === deviceId)) {
          const back = list.find((d) => /back|rear|environment/i.test(d.label));
          setDeviceId((back ?? list[0])?.deviceId ?? '');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !videoRef.current) return undefined;
    let stopped = false;
    setError(null);
    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
      : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    reader.decodeFromConstraints(constraints, videoRef.current, (result) => {
      if (stopped || !result) return;
      const code = String(result.getText() ?? '').trim();
      if (!code) return;
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.at < cooldownMs) return;
      lastRef.current = { code, at: now };
      onScanRef.current?.(code, result.getBarcodeFormat?.());
    })
      .then((controls) => { if (stopped) controls.stop(); else { controlsRef.current = controls; setRunning(true); } })
      .catch((err) => {
        if (stopped) return;
        const msg = err?.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site and try again.'
          : err?.name === 'NotFoundError' ? 'No camera was found on this device.'
          : err?.message || 'The camera could not be started.';
        setError(msg);
        setRunning(false);
      });
    return () => {
      stopped = true;
      setRunning(false);
      try { controlsRef.current?.stop(); } catch { /* already stopped */ }
      controlsRef.current = null;
    };
  }, [active, deviceId, cooldownMs]);

  const pickDevice = (id) => {
    setDeviceId(id);
    try { localStorage.setItem(DEVICE_KEY, id); } catch { /* ignore */ }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 ${className}`}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className={`block w-full object-cover ${compact ? 'h-40' : 'aspect-[4/3] max-h-[60vh]'}`} muted playsInline autoPlay />
      {active && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`rounded-xl border-2 ${running ? 'border-emerald-400/90' : 'border-white/40'} ${compact ? 'h-20 w-48' : 'h-32 w-64'} shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]`} />
          <div className={`absolute left-1/2 h-0.5 ${compact ? 'w-44' : 'w-56'} -translate-x-1/2 bg-red-500/80 ${running ? 'pos-scanline' : ''}`} />
        </div>
      ) : null}
      {!active ? (
        <div className="absolute inset-0 grid place-items-center text-zinc-400"><CameraOff className="h-8 w-8" /></div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/90 p-4 text-center text-sm text-zinc-200">
          <CameraOff className="h-6 w-6 text-zinc-400" />
          <p>{error}</p>
          <button type="button" onClick={() => { setError(null); pickDevice(deviceId); }} className="btn-ghost btn-sm"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
        </div>
      ) : null}
      {devices.length > 1 && active ? (
        <select value={deviceId} onChange={(e) => pickDevice(e.target.value)} aria-label="Camera" className="absolute right-2 top-2 max-w-[60%] rounded-lg bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
        </select>
      ) : null}
      {active && !error ? <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white"><Camera className="h-3 w-3" /> {running ? 'Scanning' : 'Starting…'}</span> : null}
    </div>
  );
};

export { BarcodeScanner };
