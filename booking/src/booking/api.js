import { api } from '../shared/services/api';
export const preview = import.meta.env.DEV && (import.meta.env.MODE === 'preview' || !import.meta.env.VITE_CLOUDGATE_API_URL);
export async function call(op, data = {}, admin = false, route = 'booking') {
  const body = { ...data, op };
  if (!preview) return api.post('/' + route, body);
  const res = await fetch('/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Preview': '1', ...(admin ? { 'X-Preview-Role': 'admin' } : {}) }, body: JSON.stringify(body) });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || 'Something went wrong. Please try again.');
  return value;
}
export function requireOnlineCheckout(settings) {
  if (!preview && !String(settings.website_url || '').startsWith('https://')) throw new Error('Online payment is not available yet. Please contact the studio to arrange your booking.');
}
export const money = (n, currency = 'ZAR') => new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: n % 100 ? 2 : 0 }).format((n || 0) / 100);
export const dateLabel = (n, tz = 'Africa/Johannesburg', opts = {}) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...opts }).format(new Date(n * 1000));
export function localDay(offset = 0, tz = 'Africa/Johannesburg') { const d = new Date(Date.now() + offset * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
export function savePass(reference, token) { const passes = JSON.parse(localStorage.getItem('studio.passes') || '{}'); passes[reference] = token; localStorage.setItem('studio.passes', JSON.stringify(passes)); }
export function getPass(reference) { try { return JSON.parse(localStorage.getItem('studio.passes') || '{}')[reference] || ''; } catch { return ''; } }
export function csv(rows, name) { if (!rows.length) return; const keys = Object.keys(rows[0]); const escape = (v) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"'; const blob = new Blob(['\ufeff' + [keys, ...rows.map(r => keys.map(k => r[k]))].map(r => r.map(escape).join(',')).join('\r\n')], { type: 'text/csv' }); download(blob, name + '.csv'); }
export function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function calendarFile(b, business) { const stamp = n => new Date(n * 1000).toISOString().replace(/[-:]/g, '').replace('.000', ''); const safe = v => String(v).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;'); download(new Blob([['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Still Studio//Bookings//EN','BEGIN:VEVENT','UID:' + b.reference + '@booking','DTSTAMP:' + stamp(Date.now()/1000),'DTSTART:' + stamp(b.starts),'DTEND:' + stamp(b.ends),'SUMMARY:' + safe(b.items.map(i => i.service_name).join(' + ')),'LOCATION:' + safe(business.address),'DESCRIPTION:' + safe('Appointment at ' + business.name + '. Reference ' + b.reference),'END:VEVENT','END:VCALENDAR'].join('\r\n')], { type: 'text/calendar' }), b.reference + '.ics'); }
