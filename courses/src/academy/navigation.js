import { LayoutDashboard, BookOpen, Users, CalendarDays, MessageCircle, BarChart3, GraduationCap, Receipt, Award, Mail, Settings } from 'lucide-react';
export const ACADEMY_PAGES = [
  ['overview', 'Overview', LayoutDashboard], ['courses', 'Courses', BookOpen],
  ['enrollments', 'Enrolments', Users], ['sessions', 'Live sessions', CalendarDays],
  ['discussions', 'Discussions', MessageCircle], ['reports', 'Learning reports', BarChart3],
  ['instructors', 'Instructors', GraduationCap], ['course-payments', 'Course payments', Receipt],
  ['certificates', 'Certificates', Award], ['messages', 'Academy emails', Mail],
  ['business', 'Academy settings', Settings],
];
export const academyNavigation = ACADEMY_PAGES.map(([page, label, icon]) => ({
  to: page === 'overview' ? '/' : '/' + page, label, icon, group: 'Academy', permission: 'backoffice.access',
}));
