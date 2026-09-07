/** IdP roles that unlock the back office. The workflows enforce the same rule server-side. */
export const ADMIN_ROLES = ['admin', 'administrator', 'owner'];

export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role ?? '').trim().toLowerCase());
