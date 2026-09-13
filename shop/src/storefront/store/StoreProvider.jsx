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

const DEFAULTS = { store_name: 'Shop', currency: 'ZAR', shipping_flat_cents: '0', free_shipping_threshold_cents: '0', theme_primary: '#18181b', theme_secondary: '#4f46e5' };

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// Black or white text for a background, by WCAG relative luminance.
const foregroundFor = ([r, g, b]) => {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.4 ? [24, 24, 27] : [255, 255, 255];
};
/** Writes the store's theme colours to CSS variables consumed by Tailwind's primary/secondary colours. */
export const applyTheme = (primaryHex, secondaryHex) => {
  const root = document.documentElement.style;
  const set = (name, hex, fallback) => {
    const rgb = hexToRgb(hex) ?? fallback;
    root.setProperty(`--c-${name}`, rgb.join(' '));
    root.setProperty(`--c-${name}-fg`, foregroundFor(rgb).join(' '));
  };
  set('primary', primaryHex, [24, 24, 27]);
  set('secondary', secondaryHex, [79, 70, 229]);
};

export const StoreProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULTS);
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
        applyTheme(s?.theme_primary || DEFAULTS.theme_primary, s?.theme_secondary || DEFAULTS.theme_secondary);
        setCategories(c);
        setPages({ nav: p?.nav ?? [], footer: p?.footer ?? [] });
        setHome(withHome ? { loading: false, featured: b?.featured?.items ?? [], newest: b?.newest?.items ?? [] } : { loading: false, featured: null, newest: null });
        if (s?.store_name) document.title = s.store_name;
        // Favicon and meta description come from the back office too.
        const icon = s?.store_icon_url || s?.store_logo_url;
        if (icon) {
          let link = document.querySelector('link[rel="icon"]');
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
          link.href = icon;
          let touch = document.querySelector('link[rel="apple-touch-icon"]');
          if (!touch) { touch = document.createElement('link'); touch.rel = 'apple-touch-icon'; document.head.appendChild(touch); }
          touch.href = icon;
        }
        if (s?.store_description) {
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
          meta.content = s.store_description;
        }
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
