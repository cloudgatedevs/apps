import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronRight, LogOut, Menu, RefreshCw, X } from 'lucide-react';
import { Brand, Badge } from './ui';
import { ProfileAvatar } from './profile';
import { brandIdentity } from './branding-model';

const GROUPS = [
  ['Workspace', ['overview', 'calendar', 'appointments', 'clients', 'waitlist']],
  ['Manage', ['services', 'team', 'resources', 'media', 'promotions']],
  ['Business', ['reports', 'messages', 'settings', 'profile']],
];

export function OfficeSidebar({ items, page, go, account, settings, open, onClose, onSignOut, preview, waiting = 0 }) {
  const ref = useRef(), close = useRef(onClose); close.current = onClose;
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)'), changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!open || !narrow) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.querySelector('[aria-current="page"]')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const controls = [...ref.current.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, narrow]);
  const name = [account.profile?.name, account.profile?.surname].filter(Boolean).join(' ') || brandIdentity(settings).shortName;
  return <>
    {open && narrow && <button className="office-nav-scrim" aria-label="Close navigation" onClick={onClose} tabIndex={-1}/>}
    <aside ref={ref} id="office-navigation" aria-label="Back office navigation" className={'sidebar ' + (open ? 'open' : '')} inert={narrow && !open ? '' : undefined}>
      <div className="office-brand"><Brand small/><button className="icon-button office-nav-close" aria-label="Close navigation" onClick={onClose}><X size={20}/></button></div>
      <nav aria-label="Workspace pages">{GROUPS.map(([label, ids]) => <div className="office-nav-group" key={label}><span className="workspace-label">{label}</span>{ids.map(id => {
        const [, text, Icon] = items.find(item => item[0] === id);
        return <button key={id} onClick={() => go(id)} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined}><Icon size={19}/><span>{text}</span>{id === 'waitlist' && waiting > 0 && <span className="nav-count">{waiting}</span>}{id === page && <ChevronRight className="office-nav-arrow" size={14}/>}</button>;
      })}</div>)}</nav>
      <a href="/" className="visit-site">View booking site <ArrowUpRight size={17}/></a>
      <div className="sidebar-user"><button type="button" className="sidebar-profile-link" onClick={() => go('profile')} aria-label="Open my profile"><ProfileAvatar className="avatar" name={name} url={account.profile?.photoUrl}/><div><strong>{preview ? 'Preview administrator' : account.profile?.name || 'Administrator'}</strong><small>Manage your profile</small></div></button>{!preview && <button aria-label="Sign out" className="icon-button" onClick={onSignOut}><LogOut size={18}/></button>}</div>
    </aside>
  </>;
}

export function OfficeHeader({ title, open, onMenu, refresh, busy, preview }) {
  return <header className="admin-header"><div className="office-breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" aria-expanded={open} aria-controls="office-navigation" onClick={onMenu}><Menu size={21}/></button><span>Back office</span><ChevronRight size={14}/><strong>{title}</strong></div><div className="actions">{preview && <Badge>Test environment</Badge>}<span className="header-date"><CalendarDays size={16}/>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}</span><button aria-label="Refresh data" title="Refresh data" className="icon-button office-refresh" onClick={refresh}><RefreshCw size={17} className={busy ? 'spin' : ''}/></button></div></header>;
}
