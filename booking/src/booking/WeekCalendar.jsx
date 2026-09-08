import React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from './ui';
import { localDay } from './api';
import { weekEntries } from './calendar-model';

export function WeekCalendar({ data, date, person, open }) {
  const days = weekEntries(data, date, person);
  const today = localDay(0, data.settings.timezone);
  const time = n => new Intl.DateTimeFormat('en-GB', { timeZone: data.settings.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(n * 1000));
  return <><p className="week-caption">{days[0].day} – {days[6].day} · {data.settings.timezone}</p>
    <div className="calendar-scroll"><div className="week-board">
      {days.map(({ day, bookings, blocks }) => <section className={'week-day ' + (day === today ? 'today' : '')} key={day} aria-label={'Appointments for ' + day}>
        <header><strong>{new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })}</strong><span>{bookings.length} appointments</span></header>
        <div className="week-day-content">
          {blocks.map(b => <div className="week-block" key={b.Id}><Clock size={13}/><strong>{b.reason}</strong><small>{data.staff.find(p => p.Id === b.staff_id)?.name || data.resources.find(r => r.Id === b.resource_id)?.name || 'Whole studio'}</small></div>)}
          {bookings.map(b => <button className="week-appointment" key={b.reference} onClick={() => open(b)} style={{ borderLeftColor: data.staff.find(s => s.Id === b.items[0]?.staff_id)?.color || '#78816f' }}>
            <span className="week-time">{time(b.starts)} – {time(b.ends)}</span><strong>{b.customer.name}</strong>
            <span>{b.items.map(i => i.service_name).join(' + ')}</span><small>{b.items[0]?.staff_name}</small><Badge>{b.status}</Badge>
          </button>)}
          {!bookings.length && !blocks.length && <p className="muted">No appointments</p>}
        </div>
      </section>)}
    </div></div></>;
}
