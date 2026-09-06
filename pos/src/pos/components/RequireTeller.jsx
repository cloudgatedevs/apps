import { Outlet } from 'react-router-dom';
import { useAuthContext } from '@/shared/auth';

const ADMIN_ROLES = ['admin', 'administrator', 'owner'];
export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role ?? '').trim().toLowerCase());

/**
 * Any signed-in IdP user can run the till, whatever their role (a plain "User" is enough, and so
 * is an Admin who wants to serve a customer). Only the back office is restricted to Admins. The
 * workflows apply the same rule server-side (require_teller / require_admin).
 */
const RequireTeller = () => {
  const { currentUser } = useAuthContext();
  if (!currentUser?.user) return null;
  return <Outlet />;
};

export { RequireTeller };
