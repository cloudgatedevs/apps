export const ANALYTICS_PERIODS = [[6, 'Last hour'], [5, 'Today'], [4, 'Yesterday'], [3, 'Last week'], [2, 'Last month'], [1, 'Last 3 months'], [0, 'All time']];
export const count = value => value == null ? '—' : Number(value).toLocaleString();
export const duration = value => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const seconds = Math.max(0, Math.round(Number(value) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
export const percent = value => value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`;
export function comparison(current, previous) {
  if (current == null || previous == null) return { text: 'No comparison for this period', direction: '' };
  if (previous === 0) return { text: current > 0 ? 'New activity this period' : 'No change from previous period', direction: current > 0 ? 'up' : '' };
  const change = (current - previous) / previous * 100;
  return { text: `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs previous period`, direction: change > 0 ? 'up' : change < 0 ? 'down' : '' };
}
export function countryName(code) {
  if (!code) return 'Unknown';
  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(String(code).toUpperCase()) || code; } catch { return code; }
}
export function visitorName(row) {
  return [row.idpUserName, row.idpUserSurname].filter(Boolean).join(' ').trim() || row.idpUserEmailAddress || 'Anonymous visitor';
}
export function analyticsDateRange(period, now = new Date()) {
  const end = new Date(now), start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (period === 0) return {};
  if (period === 6) start.setTime(now.getTime() - 3600000);
  if (period === 3) start.setUTCDate(start.getUTCDate() - 6);
  if (period === 2 || period === 1) {
    // .NET AddMonths clamps the day rather than rolling into the next month.
    const day = start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - (period === 2 ? 1 : 3));
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(); start.setUTCDate(Math.min(day, last));
  }
  if (period === 4) { end.setTime(start.getTime() - 1); start.setUTCDate(start.getUTCDate() - 1); }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
