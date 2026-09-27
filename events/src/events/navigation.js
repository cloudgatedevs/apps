import { LayoutDashboard, CalendarDays, Receipt, Ticket, ScanLine, ClipboardList, BarChart3, Users, Mail, Settings } from 'lucide-react';
export const EVENT_PAGES = [
  ['overview', 'Overview', LayoutDashboard], ['events', 'Events', CalendarDays],
  ['orders', 'Bookings', Receipt], ['attendees', 'Attendees', Ticket],
  ['checkin', 'Check-in', ScanLine], ['waitlist', 'Waitlist', ClipboardList],
  ['reports', 'Event reports', BarChart3], ['staff', 'Event staff', Users],
  ['refunds', 'Event refunds', Receipt], ['messages', 'Event emails', Mail],
  ['business', 'Event settings', Settings],
];
export const eventNavigation = EVENT_PAGES.map(([page, label, icon]) => ({
  to: page === 'overview' ? '/' : '/' + page, label, icon, group: 'Events', permission: 'backoffice.access',
}));
