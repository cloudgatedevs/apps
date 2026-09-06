import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { shopApi } from '@/storefront/services/shopApi';

// Store-wide public settings (name, currency, shipping rules) and the category
// tree — fetched once, shared everywhere.
const StoreContext = createContext(null);

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
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([shopApi.settings(), shopApi.categories(), shopApi.pages.nav().catch(() => ({ nav: [], footer: [] }))])
      .then(([s, c, p]) => {
        if (!alive) return;
        setSettings({ ...DEFAULTS, ...(s || {}) });
        applyTheme(s?.theme_primary || DEFAULTS.theme_primary, s?.theme_secondary || DEFAULTS.theme_secondary);
        setCategories(c || []);
        setPages({ nav: p?.nav ?? [], footer: p?.footer ?? [] });
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
      .catch((e) => alive && setError(e));
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
      social: Object.fromEntries(['instagram', 'facebook', 'x', 'tiktok'].map((k) => [k, String(settings[`social_${k}`] || '').trim()]).filter(([, v]) => v)),
      error,
    }),
    [settings, categories, pages, error],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
