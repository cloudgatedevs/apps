import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDays, weekEntries } from '../src/booking/calendar-model.js';

test('week navigation crosses year boundaries and always starts on Monday', () => {
  assert.deepEqual(weekDays('2027-01-01'), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});
test('business timezone determines the day, including overnight and inactive-staff appointments', () => {
  const start = Date.parse('2026-09-08T23:00:00Z') / 1000;
  const data = { settings: { timezone: 'Africa/Johannesburg' }, blocks: [], bookings: [
    { starts:start, status:'confirmed', items:[{staff_id:7}] },
    { starts:start, status:'held', expires:start-1, items:[{staff_id:7}] },
    { starts:start, status:'cancelled', items:[{staff_id:7}] }
  ] };
  const days=weekEntries(data,'2026-09-08',7,start);
  assert.equal(days.find(d=>d.day==='2026-09-09').bookings.length,1);
  assert.equal(weekEntries(data,'2026-09-08',8,start).flatMap(d=>d.bookings).length,0);
});
test('multi-day leave appears on every affected day but not on its midnight ending day', () => {
  const data={settings:{timezone:'Africa/Johannesburg'},bookings:[],blocks:[{staff_id:1,starts:Date.parse('2026-09-07T22:00:00Z')/1000,ends:Date.parse('2026-09-09T22:00:00Z')/1000}]};
  assert.deepEqual(weekEntries(data,'2026-09-08',1).filter(d=>d.blocks.length).map(d=>d.day),['2026-09-08','2026-09-09']);
});
