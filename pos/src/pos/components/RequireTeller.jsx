import { Outlet } from 'react-router-dom';
import { useAuthContext } from '@/shared/auth';

const TELLER_ROLES = ['teller', 'cashier', 'manager'];
const ADMIN_ROLES = ['admin', 'administrator', 'owner'];

export const isTellerRole = (role) => TELLER_ROLES.includes(String(role ?? '').trim().toLowerCase());
export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role ?? '').trim().toLowerCase());

/**
 * The till is for tellers. Administrators run the back office and are pointed there; anyone
 * else needs the Teller role from the Cloudgate hub. The workflows enforce the same rule
 * server-side (require_teller), so this only keeps the wrong people from seeing a broken UI.
 */
const RequireTeller = () => {
  const { currentUser, logout } = useAuthContext();
  const role = currentUser?.user?.role;

  if (isTellerRole(role)) return <Outlet />;

  const admin = isAdminRole(role);
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-ink-950 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="text-[15px] font-semibold text-mist">{admin ? 'Administrators use the back office' : 'Teller access required'}</p>
        <p className="mt-2 text-sm text-mist-muted">
          You are signed in as <span className="text-mist">{currentUser?.user?.emailAddress || 'this account'}</span>
          {role ? <> with the role <span className="text-mist">{role}</span></> : ' without a role'}.{' '}
          {admin
            ? 'The till is used by staff with the Teller role; your account manages products, stock, sales and settings from the back office.'
            : <>Ask an administrator to give your account the <span className="font-mono text-accent">Teller</span> role in the Cloudgate hub (Identity → Users), then sign in again.</>}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {admin ? <a href="/admin" className="btn-primary">Open the back office</a> : null}
          <button type="button" onClick={() => logout(true)} className={admin ? 'btn-ghost' : 'btn-primary'}>Sign out</button>
        </div>
      </div>
    </div>
  );
};

export { RequireTeller };
