import { LayoutDashboard, CalendarDays, Clock, Users, Sparkles, UserRound, DoorOpen, Tag, BarChart3, Mail, Settings } from 'lucide-react';
export const BOOKING_PAGES = [
  ['overview', 'Overview', LayoutDashboard], ['calendar', 'Calendar', CalendarDays],
  ['appointments', 'Appointments', Clock], ['clients', 'Clients', Users],
  ['services', 'Services', Sparkles], ['team', 'Team & hours', UserRound],
  ['resources', 'Rooms & resources', DoorOpen], ['waitlist', 'Waitlist', Clock],
  ['promotions', 'Promotions', Tag], ['reports', 'Booking reports', BarChart3],
  ['messages', 'Booking emails', Mail], ['business', 'Business settings', Settings],
];
export const bookingNavigation = BOOKING_PAGES.map(([page, label, icon]) => ({
  to: page === 'overview' ? '/' : '/' + page, label, icon, group: 'Booking', permission: 'backoffice.access',
}));
