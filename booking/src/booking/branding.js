import { useEffect, useSyncExternalStore } from 'react';
import { brandIdentity, brandSettings, themeTokens } from './branding-model';
import { preview } from './api';

const key = 'booking.branding:' + (preview ? 'local-preview' : (import.meta.env.VITE_CLOUDGATE_API_URL || '') + ':' + (import.meta.env.VITE_CLOUDGATE_API_PROJECT || 'booking') + ':' + (import.meta.env.VITE_CLOUDGATE_API_ENV || 'sbx'));
let current = null;
try { const raw = localStorage.getItem(key); if (raw) current = brandSettings(JSON.parse(raw)); } catch { /* use server settings */ }
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => current;
export function publishBranding(settings) {
  const next = brandSettings(settings);
  if (JSON.stringify(current) === JSON.stringify(next)) return;
  current = next;
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* branding still works in memory */ }
  listeners.forEach(listener => listener());
}
window.addEventListener('storage', event => {
  if (event.key !== key || !event.newValue) return;
  try { current = brandSettings(JSON.parse(event.newValue)); listeners.forEach(listener => listener()); } catch { /* ignore invalid cache */ }
});
export function useBranding() { return useSyncExternalStore(subscribe, snapshot, () => null); }
function meta(name, content) {
  let node = document.querySelector(`meta[name="${name}"]`);
  if (!node) { node = document.createElement('meta'); node.name = name; document.head.appendChild(node); }
  node.content = content;
}
function link(rel, href) {
  let node = document.querySelector(`link[rel="${rel}"]`);
  if (!node) { node = document.createElement('link'); node.rel = rel; document.head.appendChild(node); }
  node.removeAttribute('type'); node.href = href;
}
export function useDocumentBranding(workspace = false) {
  const settings = useBranding();
  useEffect(() => {
    if (!settings) return;
    const brand = brandIdentity(settings);
    document.title = [brand.name, workspace ? 'Workspace' : settings.tagline].filter(Boolean).join(' · ');
    meta('application-name', brand.name); meta('apple-mobile-web-app-title', brand.shortName);
    meta('description', settings.description); meta('theme-color', settings.theme_primary);
    link('icon', brand.favicon); link('apple-touch-icon', brand.icon);
    for (const [property, value] of Object.entries(themeTokens(settings))) document.documentElement.style.setProperty(property, value);
    const manifest = { name: brand.name, short_name: brand.shortName, description: settings.description, start_url: location.origin + '/', scope: location.origin + '/', display: 'standalone', theme_color: settings.theme_primary, background_color: settings.theme_background, icons: [{ src: new URL(brand.icon, location.href).href, sizes: 'any', purpose: 'any' }] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    link('manifest', url);
    return () => URL.revokeObjectURL(url);
  }, [settings, workspace]);
}
