export function dayOf(epoch, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(epoch * 1000));
}
export function weekDays(date) {
  const anchor = new Date(date + 'T12:00:00Z');
  anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86400000).toISOString().slice(0, 10));
}
export function weekEntries(data, date, person = 0, now = Date.now() / 1000) {
  const timezone = data.settings.timezone;
  return weekDays(date).map(day => ({ day,
    bookings: data.bookings.filter(b => dayOf(b.starts, timezone) === day
      && ['held', 'confirmed', 'arrived', 'completed', 'no_show', 'payment_review'].includes(b.status)
      && (b.status !== 'held' || b.expires > now)
      && (!person || b.items.some(item => item.staff_id === person))).sort((a, b) => a.starts - b.starts),
    blocks: data.blocks.filter(b => dayOf(b.starts, timezone) <= day && dayOf(b.ends - 1, timezone) >= day
      && (!person || !b.staff_id || b.staff_id === person)).sort((a, b) => a.starts - b.starts)
  }));
}
