import { useEffect } from 'react';
import { useSettings } from '@cloudgatedevs/cloudgate-client-react/react';
import { useStore } from '../store/StoreProvider';

/** Apply route titles after the SDK's asynchronous branding update, then restore it on exit. */
export function usePageTitle(label) {
  const { settings, loading } = useSettings();
  const { storeName } = useStore();
  useEffect(() => {
    if (loading || label === undefined) return;
    const title = [label, storeName].filter(Boolean).join(' · ');
    let active = true;
    let previousTitle;
    queueMicrotask(() => {
      if (!active) return;
      previousTitle = document.title;
      document.title = title;
    });
    return () => {
      active = false;
      if (previousTitle !== undefined && document.title === title) document.title = previousTitle;
    };
  }, [label, storeName, settings, loading]);
}
