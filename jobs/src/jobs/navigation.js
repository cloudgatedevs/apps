import { LayoutDashboard, ClipboardList, FileText, BriefcaseBusiness, CalendarDays, Users, Receipt, Repeat2, BarChart3, Wrench, Settings } from 'lucide-react';
export const JOB_PAGES = [
  ['overview', 'Overview', LayoutDashboard], ['requests', 'Requests', ClipboardList],
  ['quotes', 'Quotes', FileText], ['jobs', 'Jobs', BriefcaseBusiness],
  ['calendar', 'Schedule', CalendarDays], ['customers', 'Customers', Users],
  ['invoices', 'Invoices & payments', Receipt], ['recurring', 'Recurring work', Repeat2],
  ['reports', 'Job reports', BarChart3], ['services', 'Services', Wrench],
  ['team', 'Job team', Users], ['business', 'Business settings', Settings],
];
export const jobNavigation = JOB_PAGES.map(([page, label, icon]) => ({
  to: page === 'overview' ? '/' : '/' + page, label, icon, group: 'Jobs', permission: 'backoffice.access',
}));
