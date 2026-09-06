// The store's identity (name, logo, icon) for the back office chrome: sidebar brand, tab title
// and favicon. Loaded once per session from the settings API and refreshed the moment the
// Settings page saves, so a new logo shows up in the sidebar without a reload.
import { useEffect, useState } from 'react';
import { adminApi } from '@/admin/services/adminApi';

const EVENT = 'admin:settings-changed';
let cached = null;
let pending = null;

const pick = (s) => ({
  name: String(s?.store_name ?? '').trim() || 'Shop',
  logo: String(s?.store_logo_url ?? '').trim(),
  icon: String(s?.store_icon_url ?? '').trim(),
});

const load = () => {
  pending ??= adminApi.settings.get().then((s) => { cached = pick(s); return cached; }).catch(() => cached ?? pick(null)).finally(() => { pending = null; });
  return pending;
};

/** Call after a successful settings save with the values the API returned. */
export const announceSettingsChanged = (values) => {
  cached = pick(values);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cached }));
};

const applyDocument = (brand) => {
  document.title = `${brand.name} · Back office`;
  const href = brand.icon || brand.logo;
  if (!href) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = href;
};

export const useStoreBrand = () => {
  const [brand, setBrand] = useState(cached);
  useEffect(() => {
    let live = true;
    if (!cached) load().then((b) => { if (live) setBrand(b); });
    const onChange = (e) => setBrand(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => { live = false; window.removeEventListener(EVENT, onChange); };
  }, []);
  useEffect(() => { if (brand) applyDocument(brand); }, [brand]);
  return brand;
};
