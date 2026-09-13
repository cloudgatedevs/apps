export const BRAND_DEFAULTS = { app_name: '', app_short_name: '', logo_url: '', icon_url: '', favicon_url: '', logo_show_name: '1', theme_primary: '#153d35', theme_accent: '#a7cf70', theme_background: '#ffffff' };
const fields = [...Object.keys(BRAND_DEFAULTS), 'name', 'tagline', 'description'];
export function imageUrl(value) {
  const url = String(value || '').trim();
  if (!url || url.length > 2048 || /[\s\\<>]/.test(url)) return '';
  if (/^\/(?!\/)/.test(url)) return url;
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.hostname.endsWith('.localhost');
    return !parsed.username && !parsed.password && (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local)) ? url : '';
  } catch { return ''; }
}
export function brandSettings(settings = {}) {
  const result = Object.fromEntries(fields.map(key => [key, String(settings[key] ?? BRAND_DEFAULTS[key] ?? '')]));
  for (const key of ['logo_url', 'icon_url', 'favicon_url']) result[key] = imageUrl(result[key]);
  for (const key of ['theme_primary', 'theme_accent', 'theme_background']) if (!/^#[0-9a-f]{6}$/i.test(result[key])) result[key] = BRAND_DEFAULTS[key];
  return result;
}
export function brandIdentity(settings = {}) {
  const s = brandSettings(settings);
  return { name: s.app_name.trim() || s.name.trim() || 'Jobs', shortName: s.app_short_name.trim() || s.app_name.trim() || s.name.trim() || 'Jobs', logo: s.logo_url, icon: s.icon_url || s.favicon_url || s.logo_url || '/jobs-icon.svg', favicon: s.favicon_url || s.icon_url || s.logo_url || '/jobs-icon.svg', showName: s.logo_show_name !== '0' || !s.logo_url };
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function readableText(hex) {
  const l = luminance(hex);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff';
}
export function themeTokens(settings = {}) {
  const s = brandSettings(settings), best = readableText(s.theme_background), soft = best === '#000000' ? '#202020' : '#f5f5f5';
  const contrast = (Math.max(luminance(soft), luminance(s.theme_background)) + .05) / (Math.min(luminance(soft), luminance(s.theme_background)) + .05);
  const ink = contrast >= 4.5 ? soft : best;
  return { '--green': s.theme_primary, '--on-primary': readableText(s.theme_primary), '--brand-accent': s.theme_accent, '--cream': s.theme_background, '--ink': ink,
    '--surface': `color-mix(in srgb, ${s.theme_background} 96%, ${ink})`, '--muted': `color-mix(in srgb, ${ink} 68%, ${s.theme_background})`,
    '--line': `color-mix(in srgb, ${ink} 18%, ${s.theme_background})`, '--sage': `color-mix(in srgb, ${s.theme_accent} 16%, ${s.theme_background})`, '--color-scheme': best === '#000000' ? 'light' : 'dark' };
}
