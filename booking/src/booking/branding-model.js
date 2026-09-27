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
export function brandIdentity(settings = {}) {
  const name = String(settings.app_name || settings.name || 'Booking').trim() || 'Booking';
  const logo = imageUrl(settings.logo_url), icon = imageUrl(settings.icon_url), favicon = imageUrl(settings.favicon_url);
  return { name, shortName: String(settings.app_short_name || name), logo,
    icon: icon || favicon || logo || '/booking-icon.svg', favicon: favicon || icon || logo || '/booking-icon.svg',
    showName: settings.logo_show_name !== '0' || !logo };
}
