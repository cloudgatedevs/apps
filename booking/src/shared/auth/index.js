// Auth surface for the app. Session handling (tokens, refresh, login
// redirects) comes from @cloudgatedevs/cloudgate-client via src/services/auth.
export { auth, loginUrl, redirectToLogin } from '@/shared/services/auth';
export { decodeJwt, isTokenValid } from '@cloudgatedevs/cloudgate-client';
export * from './idpProfileApi';
export { AuthContext, AuthProvider } from './AuthProvider';
export { useAuthContext } from './useAuthContext';
export { RequireAuth } from './RequireAuth';
export { ADMIN_ROLES, isAdminRole } from './roles';
