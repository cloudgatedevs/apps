import { cloudgate } from '@/platform';
export { useAuthContext, RequireAuth, getProfileDisplayName, getProfilePictureSrc } from '@cloudgatedevs/cloudgate-client-react/react';
export { isAdminRole, ADMIN_ROLES } from './roles';
export const redirectToLogin = returnUrl => cloudgate.auth.login(returnUrl);
