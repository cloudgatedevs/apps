// Keep the configured login origin while returning to the workspace that consumes IdP tokens.
export function adminReturnUrl(configured, current) {
  const target = new URL(configured || current);
  // The hosted IdP appends credentials as query parameters. A fragment would hide
  // them from the client's query parser and send the user back around the login loop.
  target.pathname = '/admin'; target.search = ''; target.hash = '';
  return target.href;
}
