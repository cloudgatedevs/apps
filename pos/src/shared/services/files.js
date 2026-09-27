import { cloudgate } from '@/platform';
// Product editors use SDK media storage. Native branding uses its own SDK folder.
const folder = path => String(path).includes('branding') ? 'branding' : 'media';
export const uploadImage = (file, { path = 'media' } = {}) => cloudgate.files.upload(file, folder(path));
export const listImages = ({ path = 'media', skip = 0, take = 100 } = {}) => cloudgate.files.list({ path: folder(path), skip, take });
export const deleteImage = id => cloudgate.files.delete(id);
