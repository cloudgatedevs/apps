import { useEffect, useRef } from 'react';

/**
 * USB / Bluetooth barcode scanners act as keyboards: they type the code very fast and finish
 * with Enter. This hook watches key presses anywhere on the page and, when a burst of
 * characters arrives faster than a human types and ends with Enter, hands the code to
 * `onScan`. Typing in a text field is ignored unless the burst looks like a scan too, so the
 * search box keeps working normally.
 */
export function useScannerInput(onScan, { minLength = 4, maxGapMs = 45, enabled = true } = {}) {
  const buffer = useRef('');
  const last = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      const gap = now - last.current;
      last.current = now;
      if (gap > maxGapMs && buffer.current.length > 0 && e.key !== 'Enter') buffer.current = '';
      if (e.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= minLength && gap <= maxGapMs * 2) {
          e.preventDefault();
          e.stopPropagation();
          cb.current?.(code);
        }
        return;
      }
      if (e.key.length === 1) {
        buffer.current += e.key;
        // A human never reaches this length inside the gap window; a scanner does.
        if (buffer.current.length > 64) buffer.current = buffer.current.slice(-64);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, minLength, maxGapMs]);
}
