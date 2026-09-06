// Navigation model shared by the desktop sidebar and the mobile flyout, plus
// the helpers the mobile top bar uses to title itself and decide whether the
// current route is a drill-down that deserves a back button.

const icon = (paths) => (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {paths}
  </svg>
);

export const IconDashboard = icon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);
export const IconProducts = icon(
  <>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </>,
);
export const IconCategories = icon(
  <>
    <path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z" />
  </>,
);
export const IconInventory = icon(
  <>
    <path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" /><path d="M3 9h18M9 14h6" />
  </>,
);
export const IconOrders = icon(
  <>
    <path d="M6 3h12l2 5H4l2-5z" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M9 12a3 3 0 0 0 6 0" />
  </>,
);
export const IconCustomers = icon(
  <>
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 4.5" />
  </>,
);
export const IconMedia = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" />
  </>,
);
export const IconPages = icon(
  <>
    <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6" />
  </>,
);
export const IconMessages = icon(
  <>
    <path d="M4 5h16v11H8l-4 4V5z" /><path d="M8 9h8M8 12h5" />
  </>,
);
export const IconSettings = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
);
export const IconUser = icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);
export const IconMenu = icon(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconClose = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const IconBack = icon(<path d="M15 5l-7 7 7 7" />);

export const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/products', label: 'Products', icon: IconProducts },
  { to: '/categories', label: 'Categories', icon: IconCategories },
  { to: '/inventory', label: 'Inventory', icon: IconInventory },
  { to: '/orders', label: 'Orders', icon: IconOrders },
  { to: '/customers', label: 'Customers', icon: IconCustomers },
  { to: '/pages', label: 'Pages', icon: IconPages },
  { to: '/messages', label: 'Messages', icon: IconMessages },
  { to: '/media', label: 'Media', icon: IconMedia },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

// Routes that are not top-level nav destinations: each names the title shown
// in the mobile bar and the parent to fall back to when there is no history
// to pop (e.g. the user opened a deep link directly).
const DETAIL_ROUTES = [
  { match: /^\/products\/new$/, title: 'New product', parent: '/products' },
  { match: /^\/products\/[^/]+$/, title: 'Edit product', parent: '/products' },
  { match: /^\/orders\/[^/]+$/, title: 'Order', parent: '/orders' },
  { match: /^\/customers\/[^/]+$/, title: 'Customer', parent: '/customers' },
  { match: /^\/pages\/new$/, title: 'New page', parent: '/pages' },
  { match: /^\/pages\/[^/]+$/, title: 'Edit page', parent: '/pages' },
  { match: /^\/profile$/, title: 'My account', parent: '/' },
];

/** Title for the mobile top bar — nav label, detail title, or a fallback. */
export const routeTitle = (pathname) => {
  const detail = DETAIL_ROUTES.find((d) => d.match.test(pathname));
  const nav = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return detail?.title ?? nav?.label ?? 'Back office';
};

/**
 * Where "back" should land when the history stack can't be popped.
 * null means this route is a top-level destination — show no back button.
 */
export const backTargetFor = (pathname) =>
  DETAIL_ROUTES.find((d) => d.match.test(pathname))?.parent ?? null;
