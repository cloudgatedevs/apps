import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthContext } from '@/shared/auth';
import { getProfileDisplayName } from '@/shared/auth';
import { Tooltip } from '@/shared/ui/menus';
import { Brand } from './Brand';
import { NAV, IconBack, IconClose, IconMenu, IconUser, backTargetFor, routeTitle } from './navConfig';
import { CommandPalette, useCommandPalette } from './CommandPalette';

function initialsFrom(user) {
  const a = (user?.name || '').trim()[0] || '';
  const b = (user?.surname || '').trim()[0] || '';
  const fallback = (user?.emailAddress || 'U').trim()[0] || 'U';
  return (a + b || fallback).toUpperCase();
}

const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);

const navItemClass = ({ isActive }) =>
  [
    'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all',
    isActive ? 'bg-accent-soft text-accent-600' : 'text-mist-muted hover:bg-ink-800 hover:text-mist',
  ].join(' ');

/** Nav links shared by the desktop sidebar and the mobile flyout. */
const NavLinks = ({ onNavigate }) => (
  <nav className="flex flex-col gap-1">
    <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-mist-dim">Store</p>
    {NAV.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} onClick={onNavigate} className={navItemClass}>
        {({ isActive }) => (
          <>
            <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-accent' : 'text-mist-dim group-hover:text-mist-muted'}`} />
            <span>{label}</span>
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

/** Signed-in user card with the sign-out action, used in both nav surfaces. */
const UserCard = ({ user, displayName, onLogout, onNavigate }) => (
  <div className="rounded-xl border border-ink-700 bg-white p-2.5 shadow-panel">
    <NavLink to="/profile" onClick={onNavigate} className="flex items-center gap-3 rounded-xl transition hover:opacity-90">
      {user?.photoUrl ? (
        <img src={user.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-grad text-[11px] font-semibold text-white">{initialsFrom(user)}</span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-mist">{displayName}</p>
        <p className="truncate text-xs text-mist-dim">{user?.emailAddress}</p>
      </div>
    </NavLink>
    <button type="button" onClick={onLogout} className="mt-2.5 w-full rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-mist-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-700">
      Sign out
    </button>
  </div>
);

const Layout = () => {
  const { headerUser, logout } = useAuthContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const location = useLocation();
  const navigate = useNavigate();

  const user = headerUser?.user;
  const displayName = getProfileDisplayName({ name: user?.name, surname: user?.surname, email: user?.emailAddress });
  const title = routeTitle(location.pathname);
  const backTarget = backTargetFor(location.pathname);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(backTarget ?? '/');
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      {/* Desktop sidebar — fixed within the shell; only the main column scrolls */}
      <aside className="app-sidebar hidden h-full w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 lg:flex">
        <div className="px-2"><Brand /></div>
        <button type="button" onClick={() => setPaletteOpen(true)} className="mt-5 flex items-center gap-2 rounded-lg border border-ink-600 bg-white px-2.5 py-1.5 text-left text-xs text-mist-dim shadow-panel transition hover:border-ink-500 hover:text-mist-muted">
          <IconSearch className="h-3.5 w-3.5" /><span className="grow">Search…</span><span className="kbd">Ctrl K</span>
        </button>
        <div className="mt-5"><NavLinks /></div>
        <div className="mt-auto"><UserCard user={user} displayName={displayName} onLogout={() => logout(true)} /></div>
      </aside>

      {/* Mobile flyout: an animated Radix dialog so the backdrop, focus trap and Escape come for free */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="ui-overlay fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content aria-label="Navigation" className="ui-drawer-left app-drawer fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] flex-col border-r border-ink-700 bg-white shadow-pop outline-none lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Back office sections</Dialog.Description>
            <div className="flex items-center justify-between gap-2 px-1">
              <Brand />
              <Dialog.Close asChild>
                <button type="button" aria-label="Close menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mist-muted transition hover:bg-ink-800 hover:text-mist"><IconClose className="h-5 w-5" /></button>
              </Dialog.Close>
            </div>
            <div className="mt-6 min-h-0 grow overflow-y-auto"><NavLinks onNavigate={() => setDrawerOpen(false)} /></div>
            <div className="mt-4 shrink-0"><UserCard user={user} displayName={displayName} onLogout={() => logout(true)} onNavigate={() => setDrawerOpen(false)} /></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Main column — the only scroll container */}
      <div className="flex min-w-0 grow flex-col overflow-hidden">
        <header className="app-bar z-20 flex shrink-0 items-center gap-1 border-b border-ink-700 bg-white lg:hidden">
          {backTarget ? (
            <button type="button" onClick={goBack} aria-label="Go back" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mist-muted transition active:bg-ink-800 active:text-mist"><IconBack className="h-5 w-5" /></button>
          ) : (
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mist-muted transition active:bg-ink-800 active:text-mist"><IconMenu className="h-5 w-5" /></button>
          )}
          <p className="min-w-0 grow truncate px-1 text-[15px] font-semibold text-mist">{title}</p>
          <Tooltip text="Search (Ctrl K)">
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mist-muted transition active:bg-ink-800 active:text-mist"><IconSearch className="h-5 w-5" /></button>
          </Tooltip>
          <NavLink to="/profile" aria-label="My account" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-mist-muted transition active:bg-ink-800 active:text-mist">
            {user?.photoUrl ? <img src={user.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-grad text-[11px] font-semibold text-white">{initialsFrom(user) || <IconUser className="h-4 w-4" />}</span>}
          </NavLink>
        </header>

        <main className="app-main grow overflow-y-auto">
          <div key={location.pathname} className="ui-page mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
};

export { Layout };
