import { NavLink, Outlet } from 'react-router-dom';
import { Clock, LogOut, Receipt, RotateCcw, ShoppingCart, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAuthContext, getProfileDisplayName } from '@/shared/auth';
import { Tooltip } from '@/shared/ui/menus';
import { useTill } from '@/pos/state/TillProvider';
import { useLiveStatus, liveEnabled } from '@/admin/services/live';

const NAV = [
  { to: '/', label: 'Register', icon: ShoppingCart, end: true },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/shift', label: 'Shift', icon: Clock },
];

const navClass = ({ isActive }) =>
  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`;

const openedAgo = (iso) => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Till chrome: brand + nav on a bar in the store's primary colour; the page fills the rest. */
const Shell = () => {
  const { settings, shift, teller } = useTill();
  const { logout } = useAuthContext();
  const [live, setLive] = useState('idle');
  useLiveStatus(useCallback((s) => setLive(s), []));
  const name = getProfileDisplayName({ name: teller?.name, surname: teller?.surname, email: teller?.emailAddress });

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-ink-950">
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 text-white" style={{ background: 'rgb(var(--c-primary))' }}>
        <div className="flex min-w-0 items-center gap-2">
          {settings.store_icon_url || settings.store_logo_url
            ? <img src={settings.store_icon_url || settings.store_logo_url} alt="" className="h-8 w-8 rounded-lg bg-white/10 object-contain p-0.5" />
            : <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-sm font-bold">{(settings.store_name || 'P')[0]}</span>}
          <span className="hidden truncate text-sm font-semibold sm:block">{settings.store_name || 'POS'}</span>
        </div>
        <nav className="ml-2 flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="h-4 w-4" /><span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {shift
            ? <NavLink to="/shift" className="hidden items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-50 ring-1 ring-emerald-300/40 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{shift.RegisterName} · {openedAgo(shift.OpenedAt)}</NavLink>
            : <NavLink to="/shift" className="hidden rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-50 ring-1 ring-amber-300/40 sm:block">No open shift</NavLink>}
          {liveEnabled ? (
            <Tooltip text={live === 'open' || live === 'connected' ? 'Live updates connected' : 'Live updates offline'}>
              <span className="text-white/60">{live === 'open' || live === 'connected' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}</span>
            </Tooltip>
          ) : null}
          <div className="hidden min-w-0 text-right leading-tight lg:block">
            <p className="truncate text-[13px] font-medium">{name}</p>
            <p className="truncate text-[11px] text-white/60">{teller?.role || 'Teller'}</p>
          </div>
          <Tooltip text="Sign out">
            <button type="button" onClick={() => logout(true)} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </Tooltip>
        </div>
      </header>
      <main className="min-h-0 grow overflow-hidden"><Outlet /></main>
    </div>
  );
};

export { Shell };
