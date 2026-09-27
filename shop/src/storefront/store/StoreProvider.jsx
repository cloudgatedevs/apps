import { useSettings } from '@cloudgatedevs/cloudgate-client-react/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { shopApi } from '@/storefront/services/shopApi';

// Store-wide public settings (name, currency, shipping rules), the category tree and the
// header/footer pages — fetched ONCE, in a single `catalog bootstrap` workflow call, and
// shared everywhere. When the app opens on the home page the featured / newest grids ride
// along in that same call (see `home` below), so the landing page paints after one round
// trip instead of five.
const StoreContext = createContext(null);

/** True when the app is being opened on the home page (the only route that shows the product grids). */
const opensOnHome = () => {
  try {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === (base || '/');
  } catch {
    return false;
  }
};

const DEFAULTS = { store_name: 'Shop', currency: 'ZAR', shipping_flat_cents: '0', free_shipping_threshold_cents: '0' };

export const StoreProvider = ({ children }) => {
  const [business, setSettings] = useState(DEFAULTS);
  const { settings: appearance } = useSettings();
  const settings = useMemo(() => ({ ...business, store_name: appearance.app_name, store_tagline: appearance.app_tagline, store_description: appearance.app_description, store_logo_url: appearance.app_logo_url, store_icon_url: appearance.app_icon_url, footer_note: appearance.footer_note }), [business, appearance]);
  const [categories, setCategories] = useState([]);
  const [pages, setPages] = useState({ nav: [], footer: [] });
  // Home-page grids preloaded by the bootstrap call: { featured: [...], newest: [...] } or null.
  // `loading` is true only while a bootstrap that includes them is in flight, so Home can show
  // skeletons instead of firing its own requests.
  const [home, setHome] = useState(() => ({ loading: opensOnHome(), featured: null, newest: null }));
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const withHome = opensOnHome();
    shopApi
      .bootstrap({ home: withHome })
      .then((b) => {
        if (!alive) return;
        const s = b?.settings || {};
        const c = b?.categories || [];
        const p = b?.pages || {};
        setSettings({ ...DEFAULTS, ...s });
        setCategories(c);
        setPages({ nav: p?.nav ?? [], footer: p?.footer ?? [] });
        setHome(withHome ? { loading: false, featured: b?.featured?.items ?? [], newest: b?.newest?.items ?? [] } : { loading: false, featured: null, newest: null });

      })
      .catch((e) => {
        if (!alive) return;
        setError(e);
        setHome({ loading: false, featured: null, newest: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      settings,
      currency: settings.currency || 'ZAR',
      storeName: settings.store_name || 'Shop',
      shippingFlatCents: Number(settings.shipping_flat_cents) || 0,
      freeShippingThresholdCents: Number(settings.free_shipping_threshold_cents) || 0,
      categories,
      pages,
      home,
      social: Object.fromEntries(['instagram', 'facebook', 'x', 'tiktok'].map((k) => [k, String(settings[`social_${k}`] || '').trim()]).filter(([, v]) => v)),
      error,
    }),
    [settings, categories, pages, home, error],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
