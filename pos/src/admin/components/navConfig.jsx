// Navigation model shared by the desktop sidebar and the mobile flyout, plus the helpers the
// mobile top bar uses to title itself and decide whether the current route deserves a back button.
import {
  BarChart3, Boxes, Clock, Image, LayoutDashboard, Monitor, Package, Receipt, Settings, Tags, Truck, UserRound, Users, ChevronLeft, Menu, X,
} from 'lucide-react';

export const IconUser = UserRound;
export const IconMenu = Menu;
export const IconClose = X;
export const IconBack = ChevronLeft;
export const IconCategories = Tags;
export const IconMedia = Image;
export const IconProducts = Package;

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
  { to: '/sales', label: 'Sales', icon: Receipt, group: 'Overview' },
  { to: '/shifts', label: 'Shifts', icon: Clock, group: 'Overview' },
  { to: '/reports', label: 'Reports', icon: BarChart3, group: 'Overview' },
  { to: '/products', label: 'Products', icon: Package, group: 'Catalogue' },
  { to: '/categories', label: 'Categories', icon: Tags, group: 'Catalogue' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, group: 'Catalogue' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, group: 'Catalogue' },
  { to: '/customers', label: 'Customers', icon: Users, group: 'People' },
  { to: '/tellers', label: 'Tellers', icon: UserRound, group: 'People' },
  { to: '/registers', label: 'Registers', icon: Monitor, group: 'Setup' },
  { to: '/media', label: 'Media', icon: Image, group: 'Setup' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Setup' },
];

const DETAIL_ROUTES = [
  { match: /^\/products\/new$/, title: 'New product', parent: '/products' },
  { match: /^\/products\/[^/]+$/, title: 'Edit product', parent: '/products' },
  { match: /^\/sales\/[^/]+$/, title: 'Sale', parent: '/sales' },
  { match: /^\/shifts\/[^/]+$/, title: 'Shift', parent: '/shifts' },
  { match: /^\/customers\/[^/]+$/, title: 'Customer', parent: '/customers' },
  { match: /^\/inventory\/receive$/, title: 'Receive stock', parent: '/inventory' },
  { match: /^\/inventory\/count$/, title: 'Stock take', parent: '/inventory' },
  { match: /^\/inventory\/receipts\/[^/]+$/, title: 'Goods received', parent: '/inventory' },
  { match: /^\/profile$/, title: 'My account', parent: '/' },
];

/** Title for the mobile top bar — nav label, detail title, or a fallback. */
export const routeTitle = (pathname) => {
  const detail = DETAIL_ROUTES.find((d) => d.match.test(pathname));
  const nav = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return detail?.title ?? nav?.label ?? 'Back office';
};

/** Where "back" should land when the history stack can't be popped; null for top-level routes. */
export const backTargetFor = (pathname) => DETAIL_ROUTES.find((d) => d.match.test(pathname))?.parent ?? null;
