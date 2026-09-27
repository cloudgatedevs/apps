import { cloudgate } from './platform';
// Domain image editors use the SDK file library shown under Administration → Media.
export function saveBrandImage(blob, name, path = 'media') {
  const file = new File([blob], name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  return cloudgate.files.upload(file, path.includes('branding') ? 'branding' : 'media');
}
export function listBrandImages(skip = 0, path = 'media') {
  return cloudgate.files.list({ path: path.includes('branding') ? 'branding' : 'media', skip, take: 36 });
}
