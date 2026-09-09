// Small-image URLs for Cloudgate-hosted uploads.
//
// The host stores a 400x400-max copy of every uploaded image next to the original and serves it
// from a sibling route. Uploads may be up to 5 MB, so a till grid or a product list pulls
// megabytes to fill 40px boxes unless it asks for the small copy.
//
// The upload/list API returns both URLs (`url` and `thumbUrl`), but a product only stores `url`,
// so the small one is derived from it here rather than migrating the schema.

const FULL_ROUTE = '/File/GetPublicFileById';
const SMALL_ROUTE = '/File/GetPublicFileByIdSmall';

/**
 * The small variant of a Cloudgate file URL. Anything else -- a data: URI, a QR code, an external
 * avatar, an already-small URL -- is returned untouched, so this is safe to apply anywhere and
 * safe to apply twice.
 *
 * @param {string} url
 * @returns {string} the small URL, or `url` unchanged when it is not a Cloudgate file URL
 */
export function smallImageUrl(url) {
  if (typeof url !== 'string' || url === '') return url;
  // Matching the '?' keeps this off URLs that already point at the small route, whose path
  // continues past "GetPublicFileById" instead of ending there.
  const at = url.indexOf(`${FULL_ROUTE}?`);
  if (at < 0) return url;
  return url.slice(0, at) + SMALL_ROUTE + url.slice(at + FULL_ROUTE.length);
}
