export function customerReturnUrl(configured, current) {
  const url = new URL(configured || current);
  url.pathname = '/account/callback'; url.search = ''; url.hash = '';
  return url.href;
}
export function accountDestination(value) {
  try {
    const url = new URL(value, 'https://booking.invalid');
    if (url.origin !== 'https://booking.invalid' || !['/account', '/book', '/appointments'].includes(url.pathname)) return '/account';
    const query = new URLSearchParams();
    for (const key of ['service', 'ref']) if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
    return url.pathname + (query.size ? '?' + query.toString() : '');
  } catch { return '/account'; }
}
export function signupUrl(login) {
  const url = new URL(login);
  if (!url.pathname.endsWith('/login')) throw new Error('Customer authentication is not configured.');
  url.pathname = url.pathname.slice(0, -5) + 'signup';
  return url.href;
}
export function hasBackOfficeAccess(user) {
  // This controls navigation only. Cloudgate still authorizes every admin operation.
  const role = user?.claims?.role ?? user?.claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  return ['admin', 'administrator', 'owner'].includes(String(role || '').trim().toLowerCase());
}
