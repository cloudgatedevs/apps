import { Outlet } from 'react-router-dom';
import { useAuthContext } from '@/shared/auth';

const ADMIN_ROLES = ['admin', 'administrator', 'owner'];

export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role ?? '').trim().toLowerCase());

/**
 * Gate the back office on the IdP role. The workflows enforce the same rule
 * server-side (require_admin in every admin action); this only keeps
 * non-admins from seeing a UI that would error on every call.
 */
const RequireAdmin = () => {
  const { currentUser, logout } = useAuthContext();
  const role = currentUser?.user?.role;

  if (isAdminRole(role)) return <Outlet />;

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="text-[15px] font-semibold text-mist">Back office access required</p>
        <p className="mt-2 text-sm text-mist-muted">
          You are signed in as <span className="text-mist">{currentUser?.user?.emailAddress || 'this account'}</span>
          {role ? <> with the role <span className="text-mist">{role}</span></> : ' without a role'}.
          Ask an administrator to give your IdP account the <span className="font-mono text-accent">admin</span> role in the
          Cloudgate hub (App Users), then sign in again.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <a href="/" className="btn-ghost">Go to the shop</a>
          <button type="button" onClick={() => logout(true)} className="btn-primary">Sign out</button>
        </div>
      </div>
    </div>
  );
};

export { RequireAdmin };
