import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuthContext, redirectToLogin } from '@/shared/auth';
import { useStore } from '@/storefront/store/StoreProvider';
import { useCart, CART_BUMP_EVENT } from '@/storefront/cart/CartProvider';
import { CartDrawer } from '@/storefront/components/CartDrawer';
import { CookieConsent } from '@/storefront/components/CookieConsent';
import { VerifiedBadge } from '@/storefront/components/VerifiedBadge';

const icon = (paths) => (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>{paths}</svg>
);
const IconBag = icon(<><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>);
const IconSearch = icon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
const IconMenu = icon(<path d="M4 7h16M4 12h16M4 17h16" />);
const IconClose = icon(<path d="M6 6l12 12M18 6L6 18" />);
const IconUser = icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);
const IconArrow = icon(<path d="M5 12h14M13 6l6 6-6 6" />);

// Cloudgate's public home page for the "Powered by" credit (fixed on purpose: it is the platform's
// address, not this deployment's hub).
const CLOUDGATE_HOME = 'https://cloudgate.dev';

const SOCIAL_LABEL = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', tiktok: 'TikTok' };

const AccountMenu = ({ user, onLogout }) => {
  const navigate = useNavigate();
  if (!user) return <button type="button" onClick={() => redirectToLogin(window.location.href)} className="nav-link hidden items-center gap-1.5 sm:inline-flex"><IconUser className="h-4 w-4" />Sign in</button>;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Account" className="hidden h-10 w-10 place-items-center rounded-lg text-zinc-800 transition hover:bg-zinc-100 sm:grid"><IconUser className="h-5 w-5" /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="ui-menu menu z-40 min-w-[13rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenu.Label className="menu-label truncate normal-case tracking-normal">{user.emailAddress}</DropdownMenu.Label>
          <DropdownMenu.Item onSelect={() => navigate('/account')} className="menu-item">Your orders</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/contact')} className="menu-item">Contact us</DropdownMenu.Item>
          <DropdownMenu.Separator className="menu-sep" />
          <DropdownMenu.Item onSelect={onLogout} className="menu-item">Sign out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const Layout = () => {
  const { storeName, categories, settings, pages, social } = useStore();
  const { count, setOpen } = useCart();
  const { currentUser, logout } = useAuthContext();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [bump, setBump] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMenu(false); setSearchOpen(false); }, [location.pathname]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  useEffect(() => { if (searchOpen) setTimeout(() => searchRef.current?.focus(), 30); }, [searchOpen]);
  useEffect(() => {
    const onBump = () => { setBump(false); requestAnimationFrame(() => setBump(true)); setTimeout(() => setBump(false), 600); };
    window.addEventListener(CART_BUMP_EVENT, onBump);
    return () => window.removeEventListener(CART_BUMP_EVENT, onBump);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    setMenu(false);
    setSearchOpen(false);
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
  };

  const user = currentUser?.user;
  const top = categories.filter((c) => !c.ParentId);
  const navPages = pages.nav ?? [];
  const footerPages = pages.footer ?? [];
  const year = new Date().getFullYear();
  const navClass = ({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`;
  // One Shop entry: browsing, filtering and product pages all live under it.
  const shopActive = location.pathname.startsWith('/shop') || location.pathname.startsWith('/p/');

  return (
    <div className="flex min-h-[100dvh] w-full flex-col">
      {settings.announcement_text ? (
        <div className="bg-secondary text-center text-[12px] font-semibold tracking-wide text-secondary-fg" style={{ paddingTop: 'var(--safe-top)' }}>
          {settings.announcement_url ? <Link to={settings.announcement_url} className="block px-4 py-2 hover:opacity-90">{settings.announcement_text}</Link> : <p className="px-4 py-2">{settings.announcement_text}</p>}
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur-md" style={settings.announcement_text ? undefined : { paddingTop: 'var(--safe-top)' }}>
        <div className="container-x flex h-[4.25rem] items-center gap-3">
          <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-lg text-zinc-800 hover:bg-zinc-100 lg:hidden"><IconMenu className="h-5 w-5" /></button>

          <Link to="/" className="flex items-center gap-2.5" aria-label={`${storeName} home`}>
            {settings.store_logo_url || settings.store_icon_url ? <img src={settings.store_logo_url || settings.store_icon_url} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">{storeName.slice(0, 1)}</span>}
            <span className="font-display text-lg text-zinc-900">{storeName}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            <NavLink to="/shop" className={() => `nav-link ${shopActive ? 'nav-link-active' : ''}`} aria-current={shopActive ? 'page' : undefined}>Shop</NavLink>
            {navPages.map((p) => <NavLink key={p.Slug} to={`/pages/${p.Slug}`} className={navClass}>{p.Title}</NavLink>)}
            <NavLink to="/contact" className={navClass}>Contact</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <form onSubmit={submitSearch} role="search" className={`hidden items-center overflow-hidden transition-all md:flex ${searchOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setSearchOpen(false)} placeholder="Search products" aria-label="Search products" className="input h-10 py-0" />
            </form>
            <button type="button" onClick={() => (searchOpen && q ? submitSearch({ preventDefault() {} }) : setSearchOpen((o) => !o))} aria-label="Search" className="hidden h-10 w-10 place-items-center rounded-lg text-zinc-800 transition hover:bg-zinc-100 md:grid"><IconSearch className="h-5 w-5" /></button>
            <AccountMenu user={user} onLogout={() => logout(false)} />
            <button type="button" onClick={() => setOpen(true)} aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} className={`relative grid h-10 w-10 place-items-center rounded-lg text-zinc-800 transition hover:bg-zinc-100 ${bump ? 'ui-bounce-once' : ''}`}>
              <IconBag className="h-5 w-5" />
              {count > 0 ? <span key={count} className="ui-pulse-once absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-secondary px-1 text-[11px] font-semibold text-white">{count}</span> : null}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="ui-overlay fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content aria-label="Menu" className="ui-drawer-left fixed inset-y-0 left-0 z-40 flex w-[19rem] max-w-[88vw] flex-col bg-white shadow-2xl outline-none lg:hidden" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Browse the store</Dialog.Description>
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <span className="font-display text-xl text-zinc-900">{storeName}</span>
              <Dialog.Close asChild><button type="button" aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-zinc-600 hover:bg-zinc-100"><IconClose className="h-5 w-5" /></button></Dialog.Close>
            </div>
            <div className="min-h-0 grow overflow-y-auto px-3 py-4">
              <form onSubmit={submitSearch} role="search" className="mb-4 px-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="input rounded-full" /></form>
              <NavLink to="/shop" className={({ isActive }) => `flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] hover:bg-zinc-100 ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-800'}`}>Shop <IconArrow className="h-4 w-4 text-zinc-400" /></NavLink>
              {navPages.map((p) => <NavLink key={p.Slug} to={`/pages/${p.Slug}`} className="block rounded-xl px-3 py-2.5 text-[15px] text-zinc-800 hover:bg-zinc-100">{p.Title}</NavLink>)}
              <NavLink to="/contact" className="block rounded-xl px-3 py-2.5 text-[15px] text-zinc-800 hover:bg-zinc-100">Contact</NavLink>
              <div className="my-3 h-px bg-zinc-200" />
              {user ? (
                <>
                  <NavLink to="/account" className="block rounded-xl px-3 py-2.5 text-[15px] text-zinc-800 hover:bg-zinc-100">Your orders</NavLink>
                  <button type="button" onClick={() => logout(false)} className="block w-full rounded-xl px-3 py-2.5 text-left text-[15px] text-zinc-800 hover:bg-zinc-100">Sign out</button>
                </>
              ) : (
                <button type="button" onClick={() => redirectToLogin(window.location.href)} className="block w-full rounded-xl px-3 py-2.5 text-left text-[15px] text-zinc-800 hover:bg-zinc-100">Sign in</button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="grow" style={{ paddingBottom: 'calc(2rem + var(--safe-bottom))' }}>
        {/* Remount (and replay the page fade) per page, but treat every catalog URL as one page so
            switching category keeps the grid mounted and animates the cards instead of the whole page. */}
        <div key={location.pathname.startsWith('/shop') ? '/shop' : location.pathname} className="ui-page"><Outlet /></div>
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="flex flex-col gap-3">
            <p className="font-display text-2xl text-zinc-900">{storeName}</p>
            {settings.store_tagline ? <p className="max-w-xs text-sm leading-6 text-zinc-500">{settings.store_tagline}</p> : null}
            {Object.keys(social).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(social).map(([k, url]) => <a key={k} href={url} target="_blank" rel="noreferrer" className="chip text-xs">{SOCIAL_LABEL[k]}</a>)}
              </div>
            ) : null}
            <a href={CLOUDGATE_HOME} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-fit items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-2.5 pl-3 pr-4 transition hover:border-zinc-900">
              <img src="/cloudgate-mark.svg" alt="" className="h-7 w-auto" />
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Powered by</span>
                <span className="block text-sm font-semibold text-zinc-900">Cloudgate</span>
              </span>
            </a>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="eyebrow mb-1">Shop</p>
            <Link to="/shop" className="text-zinc-600 hover:text-zinc-900">All products</Link>
            {top.slice(0, 5).map((c) => <Link key={c.Id} to={`/shop/${c.Slug}`} className="text-zinc-600 hover:text-zinc-900">{c.Name}</Link>)}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="eyebrow mb-1">Help</p>
            <Link to="/contact" className="text-zinc-600 hover:text-zinc-900">Contact us</Link>
            <Link to="/account" className="text-zinc-600 hover:text-zinc-900">Track an order</Link>
            {footerPages.map((p) => <Link key={p.Slug} to={`/pages/${p.Slug}`} className="text-zinc-600 hover:text-zinc-900">{p.Title}</Link>)}
          </div>
          <div className="flex flex-col gap-2 text-sm text-zinc-600">
            <p className="eyebrow mb-1">Get in touch</p>
            {settings.support_email ? <a href={`mailto:${settings.support_email}`} className="hover:text-zinc-900">{settings.support_email}</a> : null}
            {settings.contact_phone ? <a href={`tel:${settings.contact_phone}`} className="hover:text-zinc-900">{settings.contact_phone}</a> : null}
            {settings.contact_hours ? <p>{settings.contact_hours}</p> : null}
            {settings.contact_address ? <p className="whitespace-pre-line">{settings.contact_address}</p> : null}
            <VerifiedBadge className="mt-3" />
          </div>
        </div>
        <div className="border-t border-zinc-200">
          <div className="container-x flex flex-col gap-2 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {storeName}. {settings.footer_note || 'All rights reserved.'}
              <span className="mx-2 text-zinc-300" aria-hidden="true">·</span>
              <a href={CLOUDGATE_HOME} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 align-middle font-medium text-zinc-600 hover:text-zinc-900">Powered by <img src="/cloudgate-mark.svg" alt="" className="h-4 w-auto" /><span className="font-semibold">Cloudgate</span></a>
            </p>
            <div className="flex flex-wrap gap-4">
              {footerPages.filter((p) => /terms|privacy|cookie/i.test(p.Slug)).map((p) => <Link key={p.Slug} to={`/pages/${p.Slug}`} className="hover:text-zinc-900">{p.Title}</Link>)}
              <a href="/admin" className="hover:text-zinc-900">Back office</a>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <CookieConsent />
    </div>
  );
};

export { Layout };
